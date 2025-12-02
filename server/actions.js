const { broadcastToPlayers } = require("./gameState");
const { isValidRummyDeclaration } = require("./validators");

function startGame(room, deckModule) {
  const deck = deckModule.shuffle(deckModule.createDeck());
  const hands = deckModule.dealHands(deck);

  const middleIndex = Math.floor(deck.length / 2);
  const specialJoker = deck[middleIndex];
  const discardPile = [deck.pop()];

  Object.assign(room, {
    deck,
    hands,
    discardPile,
    specialJoker,
    turn: 0,
    groups: [[], []],
    state: "playing",
    winner: null,
  });

  broadcastToPlayers(room, {
    type: "game_start",
    hands,
    deckCount: deck.length,
    discardPile,
    turn: 0,
    specialJoker,
  });
}

function broadcastState(room) {
  broadcastToPlayers(room, {
    type: "update",
    hands: room.hands,
    deckCount: room.deck.length,
    discardPile: room.discardPile,
    turn: room.turn,
    groups: room.groups,
  });
}

function handleDraw(room, pi) {
  if (room.turn !== pi) return;
  if (!room.deck.length) return;

  room.hands[pi].push(room.deck.pop());
  broadcastState(room);
}

function handlePickDiscard(room, pi) {
  if (room.turn !== pi) return;
  if (room.hands[pi].length !== 13) return;
  if (!room.discardPile.length) return;

  const card = room.discardPile.shift();
  room.hands[pi].push(card);
  broadcastState(room);
}

function handleMoveGroupToHand(room, pi, msg) {
  const { cardId, fromGroupIndex, toHandOrder } = msg;

  if (
    !cardId ||
    typeof fromGroupIndex !== "number" ||
    !Array.isArray(toHandOrder)
  ) {
    console.warn("move_group_to_hand: invalid payload", msg);
    return;
  }

  const playerGroups = room.groups[pi];
  const playerHand = room.hands[pi];

  // -----------------------------------------------------
  // STEP 1 — Find card in specified group
  // -----------------------------------------------------
  let cardToMove = null;

  if (playerGroups[fromGroupIndex]) {
    const idx = playerGroups[fromGroupIndex].findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const [removed] = playerGroups[fromGroupIndex].splice(idx, 1);
      cardToMove = removed;
    }
  }

  // -----------------------------------------------------
  // STEP 2 — Try to locate card in any group (fallback)
  // -----------------------------------------------------
  if (!cardToMove) {
    for (let gi = 0; gi < playerGroups.length; gi++) {
      const idx = playerGroups[gi].findIndex((c) => c.id === cardId);
      if (idx !== -1) {
        const [removed] = playerGroups[gi].splice(idx, 1);
        cardToMove = removed;
        break;
      }
    }
  }

  // -----------------------------------------------------
  // STEP 3 — Try to find card in player's hand (fallback)
  // -----------------------------------------------------
  if (!cardToMove) {
    const idx = playerHand.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      cardToMove = playerHand[idx];
    }
  }

  // -----------------------------------------------------
  // STEP 4 — Final fallback: create placeholder
  // -----------------------------------------------------
  if (!cardToMove) {
    console.warn(
      `move_group_to_hand: card ${cardId} not found, creating placeholder.`
    );
    cardToMove = { id: cardId, rank: "UNKNOWN", suit: null };
  }

  // -----------------------------------------------------
  // STEP 5 — Build total inventory (hand + groups + card)
  // -----------------------------------------------------
  const fullInventory = [...playerHand, ...playerGroups.flat(), cardToMove];
  const inventoryMap = new Map(fullInventory.map((c) => [c.id, c]));

  // -----------------------------------------------------
  // STEP 6 — Rebuild hand using toHandOrder
  // -----------------------------------------------------
  const newHand = [];
  for (const id of toHandOrder) {
    if (inventoryMap.has(id)) {
      newHand.push(inventoryMap.get(id));
      inventoryMap.delete(id);
    }
  }

  // -----------------------------------------------------
  // STEP 7 — Make sure moved card is in hand
  // -----------------------------------------------------
  if (!newHand.some((c) => c.id === cardToMove.id)) {
    newHand.push(cardToMove);
  }

  // -----------------------------------------------------
  // STEP 8 — Append any remaining inventory to avoid losses
  // -----------------------------------------------------
  for (const leftover of inventoryMap.values()) {
    newHand.push(leftover);
  }

  // -----------------------------------------------------
  // STEP 9 — Remove duplicates (just in case)
  // -----------------------------------------------------
  const seen = new Set();
  const deduped = [];
  for (const c of newHand) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      deduped.push(c);
    }
  }

  // -----------------------------------------------------
  // FINAL — Update state
  // -----------------------------------------------------
  room.hands[pi] = deduped;
}

function handleDiscard(room, pi, cardId) {
  if (room.turn !== pi) return;
  if (room.hands[pi].length !== 14) return;

  const idx = room.hands[pi].findIndex((c) => c.id === cardId);
  if (idx === -1) return;

  const [card] = room.hands[pi].splice(idx, 1);
  room.discardPile.unshift(card);

  room.turn = room.turn === 0 ? 1 : 0;
  broadcastState(room);
}

function handleDeclaration(room, pi, ws) {
  if (room.turn !== pi) return;

  if (room.hands[pi].length !== 1) {
    ws.send(JSON.stringify({ type: "invalid_declare" }));
    return;
  }
  const totalGrouped = (room.groups[pi] || []).flat().length;

  if (totalGrouped !== 13) {
    ws.send(ws, { type: "invalid_declare" });
    return;
  }

  const valid = isValidRummyDeclaration(room.groups[pi], room.specialJoker);

  if (!valid) {
    ws.send(JSON.stringify({ type: "invalid_declare" }));
    room.turn = room.turn ? 0 : 1;
    broadcastState(room);
    return;
  }

  room.state = "game_over";
  room.winner = pi;

  broadcastToPlayers(room, { type: "win", winner: pi });

  // reset
  Object.assign(room, {
    hands: [[], []],
    deck: [],
    discardPile: [],
    groups: [[], []],
    turn: 0,
    specialJoker: null,
    state: "waiting",
  });
}

module.exports = {
  startGame,
  broadcastState,
  handleDraw,
  handlePickDiscard,
  handleDiscard,
  handleDeclaration,
  handleMoveGroupToHand,
};
