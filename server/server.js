const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
// Global Rank Order array used for sequence validation
const RANK_ORDER = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: uuidv4(), suit, rank });
    }
  }
  // two printed jokers
  deck.push({ id: uuidv4(), suit: null, rank: "JOKER" });
  deck.push({ id: uuidv4(), suit: null, rank: "JOKER" });
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const room = {
  players: [], // array of { ws, index }
  hands: [[], []],
  deck: [],
  discardPile: [],
  turn: 0,
  specialJoker: null,
  groups: [[], []],
  // Add winner and state to track game status
  state: "waiting", // 'waiting', 'playing', 'game_over'
  winner: null,
};

function send(ws, msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  room.players.forEach((p) => {
    send(p.ws, { ...msg, players: room.players.length });
  });
}

function broadcastToPlayers(msg) {
  room.players.forEach((p, idx) => {
    send(p.ws, { ...msg, playerIndex: idx, players: room.players.length });
  });
}

function startGame() {
  const deck = shuffle(createDeck());
  const hands = [[], []];

  // deal 13 cards to each player
  for (let i = 0; i < 13; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }

  // Reveal Special Joker from middle
  // Note: We use the middle card as the special Joker, but leave it in the deck.
  const middleIndex = Math.floor(deck.length / 2);
  const specialJoker = deck[middleIndex];

  // Open one card to start the Discard Pile
  const firstOpenCard = deck.pop();
  const discardPile = [firstOpenCard];

  room.deck = deck;
  room.hands = hands;
  room.discardPile = discardPile;
  room.turn = 0;
  room.specialJoker = specialJoker;
  room.groups = [[], []];
  room.state = "playing";
  room.winner = null;

  broadcastToPlayers({
    type: "game_start",
    hands: room.hands,
    deckCount: room.deck.length,
    discardPile: room.discardPile,
    turn: room.turn,
    specialJoker,
  });
}

function broadcastState() {
  broadcastToPlayers({
    type: "update",
    hands: room.hands,
    deckCount: room.deck.length,
    discardPile: room.discardPile,
    turn: room.turn,
    groups: room.groups,
  });
}

/**
 * Checks if a group is a valid Set or Sequence (includes Ace wrap-around fix).
 * Returns { valid: boolean, type: 'pure' | 'impure' | 'set' | null }
 */
function checkGroupValidity(group, specialJoker) {
  const len = group.length;
  if (len < 3) return { valid: false, type: null };

  // Identify Jokers: includes two printed Jokers and the Special Joker rank
  const isJoker = (card) =>
    card.rank === "JOKER" ||
    (specialJoker &&
      card.rank === specialJoker.rank &&
      card.suit !== specialJoker.suit);

  const jokers = group.filter(isJoker);
  const jokerCount = jokers.length;
  const actualCards = group.filter((c) => !isJoker(c));

  // --- A. CHECK FOR SET (Triplets/Quads: same rank, different suits) ---
  if (
    actualCards.length > 0 &&
    actualCards.every((c) => c.rank === actualCards[0].rank)
  ) {
    const suitSet = new Set(actualCards.map((c) => c.suit));
    // Check for unique suits among non-jokers and group size <= 4
    if (suitSet.size === actualCards.length && len <= 4) {
      return { valid: true, type: "set" };
    }
  }

  // --- B. CHECK FOR SEQUENCE ---
  // Sequences must all be the same suit among non-Joker cards.
  const suits = actualCards.map((c) => c.suit).filter(Boolean);
  if (suits.length > 0 && new Set(suits).size !== 1) {
    return { valid: false, type: null };
  }

  // Sort actual cards by rank order
  const sortedCards = [...actualCards].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );

  let requiredJokers = 0;

  // Map card ranks to numerical index (0-12) and handle the Q-K-A wrap-around
  const ranksToCheck = sortedCards.map((c) => RANK_ORDER.indexOf(c.rank));

  // Check if Q, K, A are present to activate Ace high logic
  const hasQ = sortedCards.some((c) => c.rank === "Q");
  const hasK = sortedCards.some((c) => c.rank === "K");
  const hasA = sortedCards.some((c) => c.rank === "A");

  // If Q, K, A are present, temporarily treat Ace's index (0) as 13 for sorting/diff
  const adjustedRanks = ranksToCheck
    .map((rankIndex) => (rankIndex === 0 && hasQ && hasK ? 13 : rankIndex))
    .sort((a, b) => a - b);

  // Calculate required Jokers based on consecutive ranks
  for (let i = 0; i < adjustedRanks.length - 1; i++) {
    const rankDiff = adjustedRanks[i + 1] - adjustedRanks[i];

    if (rankDiff === 1) {
      continue; // Consecutive
    } else if (rankDiff > 1) {
      requiredJokers += rankDiff - 1; // Gap needs filling
    } else {
      return { valid: false, type: null }; // Duplicates or invalid order
    }
  }

  // Can the Jokers fill the gaps?
  if (requiredJokers <= jokerCount) {
    // Sequence is valid
    const sequenceType = jokerCount === 0 ? "pure" : "impure";
    return { valid: true, type: sequenceType };
  }

  return { valid: false, type: null };
}

/**
 * Main validation for Rummy declaration (1 Pure + 1 Second Sequence, total 13 cards).
 */
function isValidRummyDeclaration(groups, specialJoker) {
  let hasPureSequence = false;
  let hasSecondSequence = false;
  let totalCardsInGroups = 0;

  for (const group of groups) {
    if (group.length === 0) continue;

    totalCardsInGroups += group.length;

    const { valid, type } = checkGroupValidity(group, specialJoker);

    if (!valid) {
      return false;
    }

    if (type === "pure") {
      if (!hasPureSequence) {
        hasPureSequence = true;
      } else if (!hasSecondSequence) {
        hasSecondSequence = true;
      }
    }

    if (type === "impure") {
      if (!hasSecondSequence && hasPureSequence) {
        hasSecondSequence = true;
      }
    }
  }

  // Final Check:
  // 1. Total 13 cards must be distributed in groups.
  // 2. Both mandatory sequence requirements must be met.
  return totalCardsInGroups === 13 && hasPureSequence && hasSecondSequence;
}

const wss = new WebSocket.Server({ port: 8080 }, () =>
  console.log("WebSocket server listening on ws://localhost:8080")
);

wss.on("connection", (ws) => {
  if (room.players.length >= 2) {
    send(ws, { type: "full" });
    ws.close();
    return;
  }

  const slot = room.players.length;
  room.players.push({ ws, index: slot });
  ws.playerIndex = slot;

  send(ws, { type: "assigned", player: slot, players: room.players.length });
  broadcast({ type: "players", players: room.players.length });

  if (room.players.length === 2) {
    startGame();
  }

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.warn("invalid json from client", raw);
      return;
    }

    const pi = ws.playerIndex;
    if (pi === undefined || pi === null) return;

    // Game state check
    if (room.state !== "playing" && msg.type !== "join_room") return;

    switch (msg.type) {
      case "draw": {
        if (room.turn !== pi) return;
        if (!room.deck || room.deck.length === 0) return;
        const card = room.deck.pop();
        room.hands[pi].push(card);
        broadcastState();
        break;
      }

      case "pick_discard": {
        if (room.turn !== pi) return;
        if (room.hands[pi].length !== 13) return;
        if (room.discardPile.length === 0) return;

        const card = room.discardPile.shift();
        room.hands[pi].push(card);

        broadcastState();
        break;
      }

      case "discard": {
        if (room.turn !== pi) return;
        // Must discard only when the player has 14 cards (after drawing)
        if (room.hands[pi].length !== 14) return;

        const cardId = (msg.card && msg.card.id) || msg.cardId;
        if (!cardId) return;

        const idx = room.hands[pi].findIndex((c) => c.id === cardId);
        if (idx === -1) return;

        const [card] = room.hands[pi].splice(idx, 1);
        room.discardPile.unshift(card);

        // pass turn
        room.turn = room.turn === 0 ? 1 : 0;
        broadcastState();
        break;
      }

      case "group": {
        // Player is synchronizing groups as they organize.
        if (Array.isArray(msg.groups)) {
          room.groups[pi] = msg.groups;
        }
        broadcastState();
        break;
      }

      case "reorder": {
        // Used for sorting cards already in hand.
        if (!Array.isArray(msg.order)) break;

        const map = {};
        room.hands[pi].forEach((c) => (map[c.id] = c));

        const newHand = [];
        msg.order.forEach((id) => {
          if (map[id]) {
            newHand.push(map[id]);
            delete map[id];
          }
        });

        // append any remaining cards (shouldn't happen if client sends full list)
        Object.values(map).forEach((c) => newHand.push(c));
        room.hands[pi] = newHand;
        broadcastState();
        break;
      }

      //   case "move_group_to_hand": {
      //     // Permanent fix for card retrieval from Group to Hand.
      //     if (
      //       !msg.cardId ||
      //       typeof msg.fromGroupIndex !== "number" ||
      //       !Array.isArray(msg.toHandOrder)
      //     )
      //       return;

      //     const fromGroupIndex = msg.fromGroupIndex;
      //     const cardId = msg.cardId;

      //     // 1. Find the card object in the specified group.
      //     const group = room.groups[pi][fromGroupIndex];
      //     if (!group) return;

      //     const cardIndexInGroup = group.findIndex((c) => c.id === cardId);
      //     if (cardIndexInGroup === -1) {
      //       console.warn(
      //         `Card ID ${cardId} not found in Group ${fromGroupIndex} for Player ${pi}.`
      //       );
      //       return;
      //     }

      //     // 2. Perform the atomic move:
      //     const [cardToMove] = group.splice(cardIndexInGroup, 1);

      //     // 3. Reconstruct the new Hand using a verified inventory pool.
      //     const totalInventory = [
      //       ...room.hands[pi],
      //       ...room.groups[pi].flat(),
      //       cardToMove, // Include the card being moved
      //     ];
      //     const inventoryMap = new Map(totalInventory.map((c) => [c.id, c]));

      //     const newHand = [];
      //     msg.toHandOrder.forEach((id) => {
      //       const cardObject = inventoryMap.get(id);
      //       if (cardObject) {
      //         newHand.push(cardObject);
      //         inventoryMap.delete(id);
      //       }
      //     });

      //     // 4. Update the player's hand and groups state on the server
      //     room.hands[pi] = newHand;
      //     broadcastState();
      //     break;
      //   }

      case "move_group_to_hand": {
        // Validate input
        if (
          !msg.cardId ||
          typeof msg.fromGroupIndex !== "number" ||
          !Array.isArray(msg.toHandOrder)
        ) {
          console.warn("move_group_to_hand: invalid payload", msg);
          return;
        }

        const fromGroupIndex = msg.fromGroupIndex;
        const cardId = msg.cardId;
        const myGroups = room.groups[pi] || [];

        // 1) Find and remove the card from the specified group (if present).
        let cardToMove = null;
        if (Array.isArray(myGroups[fromGroupIndex])) {
          const idxInGroup = myGroups[fromGroupIndex].findIndex(
            (c) => c.id === cardId
          );
          if (idxInGroup !== -1) {
            // remove and capture the card object
            const [removed] = myGroups[fromGroupIndex].splice(idxInGroup, 1);
            cardToMove = removed;
          }
        }

        // 2) If not found in claimed group, try to locate it in any group (defensive)
        if (!cardToMove) {
          for (let gi = 0; gi < myGroups.length && !cardToMove; gi++) {
            const idx = myGroups[gi].findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              const [removed] = myGroups[gi].splice(idx, 1);
              cardToMove = removed;
              console.warn(
                `move_group_to_hand: card ${cardId} not found in fromGroupIndex ${fromGroupIndex}, removed from group ${gi} instead.`
              );
            }
          }
        }

        // 3) If still not found, try to find it in the server hand (maybe client referenced an already-hand card)
        if (!cardToMove) {
          const idxInHand = room.hands[pi].findIndex((c) => c.id === cardId);
          if (idxInHand !== -1) {
            cardToMove = room.hands[pi][idxInHand];
            console.warn(
              `move_group_to_hand: card ${cardId} already in hand for player ${pi}.`
            );
          }
        }

        // 4) If we still don't have the card object, at least create a placeholder
        if (!cardToMove) {
          console.warn(
            `move_group_to_hand: card ${cardId} not found in inventory for player ${pi}. Creating placeholder.`
          );
          cardToMove = { id: cardId, suit: null, rank: "UNKNOWN" };
        }

        // 5) Build an inventory that contains everything server knows about this player's cards
        const totalInventory = [
          ...room.hands[pi],
          ...myGroups.flat(),
          cardToMove, // ensure moved card is present
        ];
        const inventoryMap = new Map(totalInventory.map((c) => [c.id, c]));

        // 6) Use client's toHandOrder to reconstruct hand, pulling card objects from inventoryMap
        const newHand = [];
        const missingIds = [];
        for (const id of msg.toHandOrder) {
          if (inventoryMap.has(id)) {
            newHand.push(inventoryMap.get(id));
            inventoryMap.delete(id);
          } else {
            // client referenced an id we don't know about
            missingIds.push(id);
            console.warn(
              `move_group_to_hand: toHandOrder contains unknown id ${id} for player ${pi}`
            );
          }
        }

        // 7) If cardToMove was not included in client's toHandOrder, insert it.
        if (!newHand.some((c) => c.id === cardToMove.id)) {
          // Try to find a reasonable insertion position:
          // if there is at least one card in newHand and client had a neighboring id in missingIds,
          // we could insert near that neighbor — but simplest: append to end.
          newHand.push(cardToMove);
          console.warn(
            `move_group_to_hand: card ${cardToMove.id} missing from toHandOrder; appending to reconstructed hand for player ${pi}.`
          );
        }

        // 8) Append any remaining inventory items (defensive — avoid losing cards)
        if (inventoryMap.size > 0) {
          // Append in stable order so nothing disappears
          for (const remaining of inventoryMap.values()) {
            newHand.push(remaining);
            console.warn(
              `move_group_to_hand: appending remaining inventory card ${remaining.id} to hand for player ${pi}`
            );
          }
        }

        // 9) Sanity: ensure no duplicates (by id)
        const seen = new Set();
        const deduped = [];
        for (const c of newHand) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            deduped.push(c);
          }
        }

        // 10) Persist the new hand and broadcast
        room.hands[pi] = deduped;
        broadcastState();
        break;
      }
      case "sync_hand": {
        // Used for client-initiated hand updates, mostly reordering.
        if (!Array.isArray(msg.hand)) break;

        const totalInventory = [...room.hands[pi], ...room.groups[pi].flat()];
        const inventoryMap = new Map(totalInventory.map((c) => [c.id, c]));

        const verifiedHand = [];
        msg.hand.forEach((id) => {
          if (inventoryMap.has(id)) {
            verifiedHand.push(inventoryMap.get(id));
            inventoryMap.delete(id);
          }
        });

        room.hands[pi] = verifiedHand;
        broadcastState();
        break;
      }

      case "declare": {
        if (room.turn !== pi) return;

        // 1. Check game requirement: Hand must be empty (13 cards must be arranged in groups).
        if (room.hands[pi].length !== 0) {
          send(ws, { type: "invalid_declare" });
          console.warn(`Player ${pi} declared with cards left in hand.`);
          return;
        }

        // 2. Check group validity (includes the 13 card count check and Two-Sequence rule)
        const isValid = isValidRummyDeclaration(
          room.groups[pi] || [],
          room.specialJoker
        );

        if (isValid) {
          // WIN CONDITION MET
          room.state = "game_over";
          room.winner = pi;

          broadcast({ type: "win", winner: pi });

          // Reset game state for cleanup / next game
          room.hands = [[], []];
          room.deck = [];
          room.discardPile = [];
          room.turn = 0;
          room.groups = [[], []];
          room.specialJoker = null;

          if (room.players.length === 2) {
            // startGame(); // If you want an immediate restart
          } else {
            broadcast({ type: "players", players: room.players.length });
          }
        } else {
          // INVALID DECLARATION: Penalty is to pass the turn.
          send(ws, { type: "invalid_declare" });
          console.log(`Player ${pi} declared invalidly.`);

          room.turn = room.turn === 0 ? 1 : 0;
          broadcastState();
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on("close", () => {
    const leftSlot = ws.playerIndex;
    room.players = room.players.filter((p) => p.ws !== ws);

    // Reset state fully if a player leaves
    room.hands = [[], []];
    room.deck = [];
    room.discardPile = [];
    room.turn = 0;
    room.groups = [[], []];
    room.specialJoker = null;
    room.state = "waiting";
    room.winner = null;

    broadcast({ type: "players", players: room.players.length });
    broadcast({ type: "player_left", slot: leftSlot });
  });
});
