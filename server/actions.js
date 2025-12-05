// actions.js (multi-room version)
const state = require("./gameState");
const { shuffle } = require("./deck");

// ---------------------------
// ROOM HELPER
// ---------------------------
function getRoom(roomId) {
  if (!state.rooms[roomId]) {
    state.rooms[roomId] = {
      players: [],
      hands: [[], []],
      groups: [
        [[], [], [], []],
        [[], [], [], []],
      ],
      deck: [],
      discardPile: [],
      turn: 0,
      specialJoker: null,
      lastActionMessage: null,
      state: "waiting",
    };
  }
  return state.rooms[roomId];
}

// ---------------------------------------------------------
// DRAW LOGIC (FULLY FIXED FOR RESHUFFLE)
// ---------------------------------------------------------
function draw(roomId, pi) {
  const R = getRoom(roomId);
  if (!R || R.turn !== pi) return;
  if (R.hands[pi].length !== 13) return;

  // CASE 1 → Deck already empty → reshuffle immediately
  if (R.deck.length === 0) {
    if (R.discardPile.length > 1) {
      const top = R.discardPile[0];
      const rest = R.discardPile.slice(1);
      R.deck = shuffle([...rest]);
      R.discardPile = [top];
      R.lastActionMessage = "reshuffled";
    }
    return;
  }

  // CASE 2 → Deck has EXACTLY 1 card left (after drawing it becomes empty)
  if (R.deck.length === 1) {
    const lastCard = R.deck.pop();
    R.hands[pi].push(lastCard);

    // Now deck becomes empty → reshuffle discard pile (except top)
    if (R.discardPile.length > 1) {
      const top = R.discardPile[0];
      const rest = R.discardPile.slice(1);
      R.deck = shuffle([...rest]);
      R.discardPile = [top];
      R.lastActionMessage = "reshuffled";
    }
    return;
  }

  // CASE 3 → Normal draw
  const card = R.deck.pop();
  R.hands[pi].push(card);
}

// ---------------------------------------------------------
// PICK DISCARD
// ---------------------------------------------------------
function pickDiscard(roomId, pi) {
  const R = getRoom(roomId);

  if (R.turn !== pi) return;
  if (R.hands[pi].length !== 13) return;
  if (!R.discardPile.length) return;

  const card = R.discardPile.shift();
  R.hands[pi].push(card);
}

// ---------------------------------------------------------
// DISCARD
// ---------------------------------------------------------
function discard(roomId, pi, cardId) {
  const R = getRoom(roomId);

  if (R.turn !== pi) return;
  if (R.hands[pi].length !== 14) return;

  const idx = R.hands[pi].findIndex((c) => c.id === cardId);
  if (idx === -1) return;

  const [card] = R.hands[pi].splice(idx, 1);
  R.discardPile.unshift(card);

  R.turn = R.turn === 0 ? 1 : 0;
}

// ---------------------------------------------------------
// UPDATE GROUPS
// ---------------------------------------------------------
function updateGroups(roomId, pi, groups) {
  const R = getRoom(roomId);

  const normalized = Array.from({ length: 4 }, (_, i) =>
    Array.isArray(groups[i]) ? [...groups[i]] : []
  );

  const groupedIds = new Set(normalized.flat().map((c) => c.id));

  R.hands[pi] = R.hands[pi].filter((c) => !groupedIds.has(c.id));
  R.groups[pi] = normalized;
}

// ---------------------------------------------------------
// MOVE GROUP → HAND
// ---------------------------------------------------------
function moveGroupToHand(roomId, pi, cardId, fromGroupIndex, newHandOrder) {
  const R = getRoom(roomId);
  let card = null;

  if (typeof fromGroupIndex === "number") {
    const g = R.groups[pi][fromGroupIndex];
    const i = g.findIndex((c) => c.id === cardId);
    if (i !== -1) [card] = g.splice(i, 1);
  }

  if (!card) {
    for (const g of R.groups[pi]) {
      const i = g.findIndex((c) => c.id === cardId);
      if (i !== -1) {
        [card] = g.splice(i, 1);
        break;
      }
    }
  }

  if (!card) return;

  R.hands[pi] = R.hands[pi].filter((c) => c.id !== cardId);

  const map = new Map();
  map.set(card.id, card);
  for (const c of R.hands[pi]) map.set(c.id, c);

  const newHand = [];

  if (Array.isArray(newHandOrder)) {
    for (const id of newHandOrder) {
      const f = map.get(id);
      if (f) {
        newHand.push(f);
        map.delete(id);
      }
    }
  }

  for (const c of map.values()) newHand.push(c);

  R.hands[pi] = newHand;
}

// ---------------------------------------------------------
// RESET ROOM
// ---------------------------------------------------------

function resetRoom(roomId) {
  const R = getRoom(roomId);

  // Keep players in the room
  const players = R.players;

  state.rooms[roomId] = {
    players,
    hands: [[], []],
    groups: [
      [[], [], [], []],
      [[], [], [], []],
    ],
    deck: [],
    discardPile: [],
    turn: 0,
    specialJoker: null,
    lastActionMessage: null,
    state: "waiting",
    rematch: [false, false],
  };
}

module.exports = {
  getRoom,
  draw,
  pickDiscard,
  discard,
  updateGroups,
  moveGroupToHand,
  resetRoom,
};
