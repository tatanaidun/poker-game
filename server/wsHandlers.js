const { room, send, broadcast } = require("./gameState");
const deckModule = require("./deck");
const {
  startGame,
  handleDraw,
  handlePickDiscard,
  handleDiscard,
  handleDeclaration,
  broadcastState,
  handleMoveGroupToHand,
} = require("./actions");

function onConnection(ws) {
  console.log("🔵 Client connected");
  if (room.players.length >= 2) {
    send(ws, { type: "full" });
    ws.close();
    return;
  }

  const slot = room.players.length;
  room.players.push({ ws, index: slot });
  ws.playerIndex = slot;

  send(ws, { type: "assigned", player: slot, players: room.players.length });
  broadcast(room, { type: "players", players: room.players.length });

  if (room.players.length === 2) {
    startGame(room, deckModule);
  }

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const pi = ws.playerIndex;
    if (pi == null) return;

    if (room.state !== "playing" && msg.type !== "join_room") return;

    switch (msg.type) {
      case "draw":
        return handleDraw(room, pi);
      case "pick_discard":
        return handlePickDiscard(room, pi);
      case "discard":
        return handleDiscard(room, pi, msg.cardId);
      case "declare":
        return handleDeclaration(room, pi, ws);

      case "group": {
        if (Array.isArray(msg.groups)) {
          room.groups[pi] = msg.groups;
          broadcastState(room);
        }
        break;
      }

      case "reorder": {
        if (!Array.isArray(msg.order)) break;

        const map = {};
        room.hands[pi].forEach((c) => (map[c.id] = c));

        const newHand = msg.order.filter((id) => map[id]).map((id) => map[id]);

        room.hands[pi] = newHand;
        broadcastState(room);
        break;
      }

      case "move_group_to_hand": {
        handleMoveGroupToHand(room, pi, msg);
        break;
      }

      case "sync_hand": {
        const inv = [...room.hands[pi], ...room.groups[pi].flat()];
        const map = new Map(inv.map((c) => [c.id, c]));

        const verified = msg.hand
          .filter((id) => map.has(id))
          .map((id) => map.get(id));

        room.hands[pi] = verified;
        broadcastState(room);
        break;
      }
    }
  });

  ws.on("close", () => {
    const left = ws.playerIndex;
    room.players = room.players.filter((p) => p.ws !== ws);

    Object.assign(room, {
      hands: [[], []],
      deck: [],
      discardPile: [],
      turn: 0,
      groups: [[], []],
      specialJoker: null,
      state: "waiting",
      winner: null,
    });

    broadcast(room, { type: "players", players: room.players.length });
    broadcast(room, { type: "player_left", slot: left });
  });
}

module.exports = { onConnection };
