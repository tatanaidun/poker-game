// wsHandlers.js
const state = require("./gameState");
const { createDeck, shuffle } = require("./deck");
const {
  draw,
  pickDiscard,
  discard,
  updateGroups,
  moveGroupToHand,
} = require("./actions");

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

function startGame() {
  const deck = shuffle(createDeck());
  const hands = [[], []];

  // --- Deal 13 cards each ---
  for (let i = 0; i < 13; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }

  // --- Choose Special Joker (must REMOVE from deck!) ---
  const mid = Math.floor(deck.length / 2);
  const special = deck[mid];

  // Remove special joker from deck completely
  deck.splice(mid, 1);

  if (special.rank === "JOKER") {
    special = { id: uuidv4(), suit: null, rank: "A" };
  }
  state.specialJoker = special;
  // --- First open discard ---
  const firstOpen = deck.pop();
  state.discardPile = [firstOpen];

  // --- Remaining deck after joker & first discard removed ---
  state.deck = deck;

  // --- Hands & groups ---
  state.hands = hands;
  state.groups = [
    [[], [], [], []],
    [[], [], [], []],
  ];

  state.turn = 0;
  state.state = "playing";

  // --- Broadcast game start ---
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

    const player = state.players.find((p) => p.ws === ws);
    if (!player) return;
    const pi = player.index;

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

      // Reorder within hand (sorting / drag)
      case "reorder": {
        const order = Array.isArray(msg.order) ? msg.order : [];
        if (!order.length) break;

        const map = new Map(state.hands[pi].map((c) => [c.id, c]));
        state.hands[pi] = order.map((id) => map.get(id)).filter(Boolean);

        broadcastState();
        break;
      }

      // Sync hand after multi-move from hand to groups
      case "sync_hand": {
        const order = Array.isArray(msg.hand) ? msg.hand : [];
        if (!order.length) break;

        const map = new Map(state.hands[pi].map((c) => [c.id, c]));
        state.hands[pi] = order.map((id) => map.get(id)).filter(Boolean);

        broadcastState();
        break;
      }

      case "declare": {
        const groups = msg.groups;
        const finalDiscard = msg.finalDiscard;

        // Must be the player's turn
        if (state.turn !== pi) {
          send(ws, { type: "invalid_declare", reason: "Not your turn." });
          break;
        }

        // Validate groups format
        if (!Array.isArray(groups) || groups.length !== 4) {
          send(ws, { type: "invalid_declare", reason: "Bad groups format." });
          break;
        }

        // Must have placed exactly 13 cards in groups
        const totalGrouped = groups.flat().length;
        if (totalGrouped !== 13) {
          send(ws, {
            type: "invalid_declare",
            reason: "Exactly 13 cards must be grouped.",
          });
          break;
        }

        // Must have exactly 1 card left in hand (final discard)
        if (state.hands[pi].length !== 1) {
          send(ws, {
            type: "invalid_declare",
            reason: "Exactly 1 card must remain in hand.",
          });
          break;
        }

        const { isValidRummyDeclaration } = require("./validators");

        // Validate rummy rules (1 pure + 1 more sequence required)
        const ok = isValidRummyDeclaration(groups, state.specialJoker);

        if (!ok) {
          send(ws, {
            type: "invalid_declare",
            reason: "Rummy rules not satisfied.",
          });

          // After invalid declare, pass turn
          state.turn = state.turn === 0 ? 1 : 0;
          broadcastState();
          break;
        }

        // If everything is valid => declare win!
        broadcast({
          type: "win",
          winner: pi,
          groups,
          finalDiscard,
          specialJoker: state.specialJoker,
        });

        // Reset game state
        state.state = "waiting";
        state.deck = [];
        state.discardPile = [];
        state.hands = [[], []];
        state.groups = [
          [[], [], [], []],
          [[], [], [], []],
        ];
        state.turn = 0;
        state.specialJoker = null;

        break;
      }

      default:
        break;
    }
  });

  ws.on("close", () => {
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
