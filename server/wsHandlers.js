const state = require("./gameState");
const { createDeck, shuffle } = require("./deck");
const {
  draw,
  pickDiscard,
  discard,
  updateGroups,
  moveGroupToHand,
} = require("./actions");

// --------------------------------------------------------
// Broadcast helpers
// --------------------------------------------------------
function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  state.players.forEach((p) => send(p.ws, { ...msg, playerIndex: p.index }));
}

function broadcastState() {
  broadcast({
    type: "update",
    hands: state.hands,
    groups: state.groups,
    deckCount: state.deck.length,
    discardPile: state.discardPile,
    turn: state.turn,
    players: state.players.length,
  });
}

// --------------------------------------------------------
// Game Start
// --------------------------------------------------------
function startGame() {
  const deck = shuffle(createDeck());
  const hands = [[], []];

  for (let i = 0; i < 13; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }

  const mid = Math.floor(deck.length / 2);
  state.specialJoker = deck[mid];

  const firstOpen = deck.pop();
  state.discardPile = [firstOpen];

  state.deck = deck;
  state.hands = hands;
  state.groups = [
    [[], [], [], []],
    [[], [], [], []],
  ];
  state.turn = 0;
  state.state = "playing";

  broadcast({
    type: "game_start",
    hands: state.hands,
    deckCount: deck.length,
    discardPile: state.discardPile,
    turn: 0,
    specialJoker: state.specialJoker,
    players: state.players.length,
  });
}

// --------------------------------------------------------
// onConnection
// --------------------------------------------------------
function onConnection(ws) {
  if (state.players.length >= 2) {
    send(ws, { type: "full" });
    ws.close();
    return;
  }

  const slot = state.players.length;
  state.players.push({ ws, index: slot });

  send(ws, { type: "assigned", player: slot, players: state.players.length });
  broadcast({ type: "players", players: state.players.length });

  if (state.players.length === 2) startGame();

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const pi = state.players.find((p) => p.ws === ws)?.index;
    if (pi == null) return;

    switch (msg.type) {
      case "draw":
        draw(pi);
        broadcastState();
        break;

      case "pick_discard":
        pickDiscard(pi);
        broadcastState();
        break;

      case "discard":
        discard(pi, msg.cardId);
        broadcastState();
        break;

      case "group":
        updateGroups(pi, msg.groups);
        broadcastState();
        break;

      case "move_group_to_hand":
        moveGroupToHand(pi, msg.cardId, msg.fromGroupIndex, msg.toHandOrder);
        broadcastState();
        break;

      case "sync_hand":
        // Safe reorder without duplication
        state.hands[pi] = msg.hand
          .map((id) =>
            [...state.hands[pi], ...state.groups[pi].flat()].find(
              (c) => c.id === id
            )
          )
          .filter(Boolean);
        broadcastState();
        break;

      case "declare":
        // leaving declare for later — not relevant now
        break;
    }
  });

  ws.on("close", () => {
    // full reset
    state.players = [];
    state.hands = [[], []];
    state.groups = [
      [[], [], [], []],
      [[], [], [], []],
    ];
    state.deck = [];
    state.discardPile = [];
    state.turn = 0;
    state.specialJoker = null;
    state.state = "waiting";

    broadcast({ type: "players", players: 0 });
  });
}

module.exports = { onConnection };
