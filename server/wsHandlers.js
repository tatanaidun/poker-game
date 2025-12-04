// wsHandlers.js
const { createDeck, shuffle } = require("./deck");
const { isValidRummyDeclaration } = require("./validators");
const {
  getRoom,
  draw,
  pickDiscard,
  discard,
  updateGroups,
  moveGroupToHand,
  resetRoom,
} = require("./actions");

// Send helper
function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(roomId, msg) {
  const R = getRoom(roomId);
  R.players.forEach((p) => send(p.ws, { ...msg, playerIndex: p.index }));
}

function broadcastState(roomId) {
  const R = getRoom(roomId);

  broadcast(roomId, {
    type: "update",
    hands: R.hands,
    groups: R.groups,
    deckCount: R.deck.length,
    discardPile: R.discardPile,
    turn: R.turn,
    players: R.players.length,
    reshuffled: R.lastActionMessage === "reshuffled",
  });

  R.lastActionMessage = null;
}

// -----------------------------------------------
// START GAME
// -----------------------------------------------
function startGame(roomId) {
  const R = getRoom(roomId);

  const deck = shuffle(createDeck());
  const hands = [[], []];

  for (let i = 0; i < 13; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }

  const mid = Math.floor(deck.length / 2);
  let special = deck[mid];
  deck.splice(mid, 1); // remove special joker

  // SPECIAL JOKER RULE
  if (special.rank === "JOKER") {
    R.specialJoker = { rank: "A", suit: "ALL" }; // all A become special joker
  } else {
    R.specialJoker = { rank: special.rank, suit: "ANY" }; // all same-rank cards are jokers
  }

  const firstOpen = deck.pop();
  R.discardPile = [firstOpen];

  R.deck = deck;
  R.hands = hands;
  R.groups = [
    [[], [], [], []],
    [[], [], [], []],
  ];
  R.turn = 0;
  R.state = "playing";

  broadcast(roomId, {
    type: "game_start",
    hands: R.hands,
    deckCount: deck.length,
    discardPile: R.discardPile,
    turn: 0,
    specialJoker: R.specialJoker,
    players: R.players.length,
  });
}

// -----------------------------------------------
// CONNECTION HANDLER
// -----------------------------------------------
function onConnection(ws, roomId) {
  const R = getRoom(roomId);

  // Limit room to 2 players
  if (R.players.length >= 2) {
    send(ws, { type: "full" });
    ws.close();
    return;
  }

  const slot = R.players.length;
  R.players.push({ ws, index: slot });

  send(ws, { type: "assigned", player: slot, players: R.players.length });
  broadcast(roomId, { type: "players", players: R.players.length });

  if (R.players.length === 2) startGame(roomId);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const player = R.players.find((p) => p.ws === ws);
    if (!player) return;
    const pi = player.index;

    switch (msg.type) {
      case "draw":
        draw(roomId, pi);
        broadcastState(roomId);
        break;

      case "pick_discard":
        pickDiscard(roomId, pi);
        broadcastState(roomId);
        break;

      case "discard":
        discard(roomId, pi, msg.cardId);
        broadcastState(roomId);
        break;

      case "group":
        updateGroups(roomId, pi, msg.groups);
        broadcastState(roomId);
        break;

      case "move_group_to_hand":
        moveGroupToHand(
          roomId,
          pi,
          msg.cardId,
          msg.fromGroupIndex,
          msg.toHandOrder
        );
        broadcastState(roomId);
        break;

      case "reorder": {
        const Rm = getRoom(roomId);
        const order = msg.order;
        const map = new Map(Rm.hands[pi].map((c) => [c.id, c]));
        Rm.hands[pi] = order.map((id) => map.get(id)).filter(Boolean);
        broadcastState(roomId);
        break;
      }

      case "sync_hand": {
        const Rm = getRoom(roomId);
        const order = msg.hand;
        const map = new Map(Rm.hands[pi].map((c) => [c.id, c]));
        Rm.hands[pi] = order.map((id) => map.get(id)).filter(Boolean);
        broadcastState(roomId);
        break;
      }

      case "leave": {
        console.log(`Player ${pi} left room ${roomId}`);
        send(ws, { type: "left_confirmed" });
        broadcast(roomId, { type: "player_left", slot: pi });
        resetRoom(roomId);

        try {
          ws.close();
        } catch (e) {
          console.log(e);
        }
        break;
      }

      case "declare": {
        const Rm = getRoom(roomId);

        const ok = isValidRummyDeclaration(msg.groups, Rm.specialJoker);

        if (!ok) {
          send(ws, { type: "invalid_declare" });
          Rm.turn = Rm.turn === 0 ? 1 : 0;
          broadcastState(roomId);
          break;
        }

        broadcast(roomId, {
          type: "win",
          winner: pi,
          groups: msg.groups,
          specialJoker: Rm.specialJoker,
        });

        resetRoom(roomId);
        break;
      }

      default:
        break;
    }
  });

  ws.on("close", () => {
    resetRoom(roomId);
  });
}

module.exports = { onConnection };
