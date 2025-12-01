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

/**
 * Checks if a group is a valid Set or Sequence.
 * Returns { valid: boolean, type: 'pure' | 'impure' | 'set' | null }
 */
function checkGroupValidity(group, specialJoker) {
  const len = group.length;
  if (len < 3) return { valid: false, type: null }; // Min 3 cards for set/sequence

  // Identify Jokers: includes two printed Jokers and the Special Joker rank
  const isJoker = (card) =>
    card.rank === "JOKER" || (specialJoker && card.rank === specialJoker.rank);

  const jokers = group.filter(isJoker);
  const jokerCount = jokers.length;
  const actualCards = group.filter((c) => !isJoker(c));

  // --- A. CHECK FOR SET (Triplets/Quads: same rank, different suits) ---
  if (
    actualCards.length > 0 &&
    actualCards.every((c) => c.rank === actualCards[0].rank)
  ) {
    // Check suits: must be different for actual cards (Jokers don't affect suit check)
    const suitSet = new Set(actualCards.map((c) => c.suit));
    // Must have unique suits among non-jokers, AND total cards <= 4 (Triplets/Quads rule)
    if (suitSet.size === actualCards.length && len <= 4) {
      return { valid: true, type: "set" };
    }
  }

  // --- B. CHECK FOR SEQUENCE ---
  // Sequences must all be the same suit among non-Joker cards.
  const suits = actualCards.map((c) => c.suit).filter(Boolean);
  if (suits.length > 0 && new Set(suits).size !== 1) {
    // If actual cards are mixed suits, it cannot be a sequence
    return { valid: false, type: null };
  }

  // Sort actual cards by rank order
  const sortedCards = [...actualCards].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );

  // Calculate required Jokers to fill gaps
  let requiredJokers = 0;
  for (let i = 0; i < sortedCards.length - 1; i++) {
    const currentRank = RANK_ORDER.indexOf(sortedCards[i].rank);
    const nextRank = RANK_ORDER.indexOf(sortedCards[i + 1].rank);

    const rankDiff = nextRank - currentRank;

    if (rankDiff === 1) {
      continue; // Consecutive
    } else if (rankDiff > 1) {
      requiredJokers += rankDiff - 1; // Gap needs filling
    } else {
      return { valid: false, type: null }; // Duplicate rank in sequence is invalid
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
 * Main validation for Rummy declaration (1 Pure + 1 Second Sequence).
 */
function isValidRummyDeclaration(groups, specialJoker) {
  let hasPureSequence = false;
  let hasSecondSequence = false; // Tracks the second required sequence

  // Track total cards placed in valid groups
  let totalCardsInGroups = 0;

  for (const group of groups) {
    if (group.length === 0) continue;

    totalCardsInGroups += group.length;

    const { valid, type } = checkGroupValidity(group, specialJoker);

    if (!valid) {
      // Rule: All groups must be valid (Sequences or Sets).
      return false;
    }

    if (type === "pure") {
      // A pure sequence can fulfill either requirement.
      if (!hasPureSequence) {
        hasPureSequence = true;
      } else if (!hasSecondSequence) {
        hasSecondSequence = true;
      }
    }

    if (type === "impure") {
      // An impure sequence fulfills the second sequence requirement.
      if (!hasSecondSequence && hasPureSequence) {
        hasSecondSequence = true;
      }
    }
  }

  // The final card must have been discarded, meaning the remaining 13 cards
  // must be in the groups, and the hand must be empty.

  // Final Check:
  // 1. Must have exactly 13 cards distributed in groups (if hand is empty).
  // 2. Both sequence requirements must be met.
  return totalCardsInGroups === 13 && hasPureSequence && hasSecondSequence;
}

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
  const middleIndex = Math.floor(deck.length / 2);
  const specialJoker = deck[middleIndex];
  // Note: Usually we leave the joker in the deck or set it aside.
  // Your current logic leaves it in deck[middleIndex]. That is fine.

  // --- FIX: Open one card to start the Discard Pile ---
  const firstOpenCard = deck.pop();
  const discardPile = [firstOpenCard];

  room.deck = deck;
  room.hands = hands;
  room.discardPile = discardPile; // Set the pile
  room.turn = 0;
  room.specialJoker = specialJoker;
  room.groups = [[], []];

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

function validateGroups(groups) {
  let hasPure = false;
  let hasDummy = false;

  groups.forEach((g) => {
    if (!Array.isArray(g)) return;
    if (g.length < 3) return;
    const nonJoker = g.filter((c) => c.rank !== "JOKER");
    const suits = nonJoker.map((c) => c.suit).filter(Boolean);
    if (suits.length > 0 && new Set(suits).size === 1) hasPure = true;
    else hasDummy = true;
  });

  return hasPure && hasDummy;
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

    switch (msg.type) {
      case "draw": {
        // enforce turn
        if (room.turn !== pi) return;
        if (!room.deck || room.deck.length === 0) return;
        const card = room.deck.pop();
        room.hands[pi].push(card);
        broadcastState();
        break;
      }

      case "pick_discard": {
        if (room.turn !== pi) return;
        // The check below ensures the player is in the 'draw' phase.
        if (room.hands[pi].length !== 13) return;
        if (room.discardPile.length === 0) return;

        // 1. Take the top card from the discard pile
        const card = room.discardPile.shift();

        // 2. Add it to the player's hand
        room.hands[pi].push(card);

        // 3. Broadcast new state
        broadcastState();
        break;
      }

      case "discard": {
        if (room.turn !== pi) return;
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
        if (Array.isArray(msg.groups)) {
          room.groups[pi] = msg.groups;
        }
        broadcastState();
        break;
      }

      case "reorder": {
        // "Soft" reorder: Sorts what is already in hand.
        // If cards are missing from the list, it appends them.
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
        // append any remaining cards
        Object.values(map).forEach((c) => newHand.push(c));
        room.hands[pi] = newHand;
        broadcastState();
        break;
      }

      case "move_group_to_hand": {
        if (
          !msg.cardId ||
          typeof msg.fromGroupIndex !== "number" ||
          !Array.isArray(msg.toHandOrder)
        )
          return;

        const fromGroupIndex = msg.fromGroupIndex;
        const cardId = msg.cardId;

        // 1. Find the card object in the specified group.
        const group = room.groups[pi][fromGroupIndex];
        if (!group) return; // Group doesn't exist

        const cardIndexInGroup = group.findIndex((c) => c.id === cardId);
        if (cardIndexInGroup === -1) {
          // This is a crucial anti-cheat check: does the card really exist in that group?
          console.warn(
            `Card ID ${cardId} not found in Group ${fromGroupIndex} for Player ${pi}.`
          );
          return;
        }

        // 2. Perform the atomic move on the server state:
        // a) Remove card from the group
        const [cardToMove] = group.splice(cardIndexInGroup, 1);

        // b) Reconstruct the new Hand based on the order sent by the client (msg.toHandOrder).
        // This is where we need to ensure the cardToMove is correctly inserted.

        // Pool of all cards owned by player (Hand + Groups)
        // IMPORTANT: The cardToMove is currently NOT in room.groups, but we have the object.
        const totalInventory = [
          ...room.hands[pi],
          ...room.groups[pi].flat(),
          cardToMove,
        ];
        const inventoryMap = new Map(totalInventory.map((c) => [c.id, c]));

        const newHand = [];
        msg.toHandOrder.forEach((id) => {
          const cardObject = inventoryMap.get(id);
          if (cardObject) {
            newHand.push(cardObject);
            // Remove from map to prevent duplicates (essential anti-cheat)
            inventoryMap.delete(id);
          }
        });

        // 3. Update the player's hand and groups state on the server
        room.hands[pi] = newHand;

        // 4. Broadcast the new game state
        broadcastState();
        break;
      }

      case "sync_hand": {
        // This is now primarily used only for reordering.
        if (!Array.isArray(msg.hand)) break;

        // Pool of all cards owned by player (Hand + Groups)
        // NOTE: This pool now correctly omits the card that was moved
        // to the hand via 'move_group_to_hand', as the card is already
        // established in room.hands[pi] by that prior, atomic handler.
        const totalInventory = [...room.hands[pi], ...room.groups[pi].flat()];
        const inventoryMap = new Map(totalInventory.map((c) => [c.id, c]));

        const verifiedHand = [];
        msg.hand.forEach((id) => {
          if (inventoryMap.has(id)) {
            verifiedHand.push(inventoryMap.get(id));
            inventoryMap.delete(id); // Prevent duplicates (Anti-cheat)
          }
        });

        room.hands[pi] = verifiedHand;
        broadcastState();
        break;
      }

      case "declare": {
        const valid = validateGroups(room.groups[pi] || []);
        if (valid) {
          broadcast({ type: "win", winner: pi });
          if (room.players.length === 2) {
            startGame();
          } else {
            room.hands = [[], []];
            room.deck = [];
            room.discardPile = [];
            room.turn = 0;
            room.groups = [[], []];
            room.specialJoker = null;
            broadcast({ type: "players", players: room.players.length });
          }
        } else {
          room.turn = room.turn === 0 ? 1 : 0;
          broadcastState();
          send(ws, { type: "invalid_declare" });
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
    room.hands = [[], []];
    room.deck = [];
    room.discardPile = [];
    room.turn = 0;
    room.groups = [[], []];
    room.specialJoker = null;
    broadcast({ type: "players", players: room.players.length });
    broadcast({ type: "player_left", slot: leftSlot });
  });
});
