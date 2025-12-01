// server/server.js
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
  room.players.forEach((p, idx) => {
    send(p.ws, { ...msg, players: room.players.length });
  });
}

/**
 * Send message to all players, and also include per-client playerIndex value
 * so client can use msg.playerIndex (prefer this when deciding which hand belongs to them).
 */
function broadcastToPlayers(msg) {
  room.players.forEach((p, idx) => {
    send(p.ws, { ...msg, playerIndex: idx, players: room.players.length });
  });
}

function startGame() {
  const deck = shuffle(createDeck());
  const hands = [[], []];

  // deal 13 cards to each player (pop from deck so deck reduces)
  for (let i = 0; i < 13; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }

  // special joker revealed from middle (do not remove from deck)
  const middleIndex = Math.floor(deck.length / 2);
  const specialJoker = deck[middleIndex];

  room.deck = deck;
  room.hands = hands;
  room.discardPile = [];
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

// very small validator (you can expand)
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
  // refuse if room full
  if (room.players.length >= 2) {
    send(ws, { type: "full" });
    ws.close();
    return;
  }

  // assign index
  const slot = room.players.length;
  room.players.push({ ws, index: slot });
  ws.playerIndex = slot;

  // send assigned to this socket (include current players count)
  send(ws, { type: "assigned", player: slot, players: room.players.length });

  // broadcast current players count
  broadcast({ type: "players", players: room.players.length });

  // start game when exactly 2 players present
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

    // Guard: ensure ws.playerIndex is defined
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
        // accept grouping updates from player (no strict turn enforcement for grouping)
        room.groups[pi] = Array.isArray(msg.groups) ? msg.groups : [];
        broadcastState();
        break;
      }

      case "reorder": {
        // reorder player's hand per id order if provided
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

      case "declare": {
        const valid = validateGroups(room.groups[pi] || []);
        if (valid) {
          broadcast({ type: "win", winner: pi });
          // restart if both players still connected
          if (room.players.length === 2) {
            startGame();
          } else {
            // reset room state if not both connected
            room.hands = [[], []];
            room.deck = [];
            room.discardPile = [];
            room.turn = 0;
            room.groups = [[], []];
            room.specialJoker = null;
            broadcast({ type: "players", players: room.players.length });
          }
        } else {
          // invalid: pass turn and inform client
          room.turn = room.turn === 0 ? 1 : 0;
          broadcastState();
          send(ws, { type: "invalid_declare" });
        }
        break;
      }

      default:
        // ignore unknown
        break;
    }
  });

  ws.on("close", () => {
    // save slot before removing
    const leftSlot = ws.playerIndex;
    // remove player
    room.players = room.players.filter((p) => p.ws !== ws);
    // reset game state
    room.hands = [[], []];
    room.deck = [];
    room.discardPile = [];
    room.turn = 0;
    room.groups = [[], []];
    room.specialJoker = null;
    // broadcast players count and player_left with correct slot
    broadcast({ type: "players", players: room.players.length });
    broadcast({ type: "player_left", slot: leftSlot });
  });
});
