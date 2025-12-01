const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

let state = {
  players: [null, null], // two slots
  scores: [0, 0],
  currentPlayer: 0,
  target: 20,
};

function connectedCount() {
  return state.players.filter(Boolean).length;
}

function sendSafe(ws, msg) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  } catch (err) {
    // ignore send errors
  }
}

function broadcast(msg) {
  const text = JSON.stringify(msg);
  state.players.forEach((p) => {
    try {
      if (p && p.readyState === WebSocket.OPEN) p.send(text);
    } catch (e) {}
  });
}

wss.on("connection", (ws) => {
  console.log("Player connected");

  // find first empty slot (0 or 1)
  const slot = state.players.findIndex((p) => p === null);

  if (slot === -1) {
    sendSafe(ws, { type: "full" });
    ws.close();
    return;
  }

  // assign slot
  state.players[slot] = ws;
  ws.playerIndex = slot;

  // inform this client about its slot and current players count
  sendSafe(ws, { type: "assigned", player: slot, players: connectedCount() });
  console.log(`Player assigned to slot ${slot}`);

  // if both players are present, start the game by broadcasting the state (include players count)
  if (connectedCount() === 2) {
    broadcast({ type: "state", state: state, players: connectedCount() });
  } else {
    // inform other (single) player about current players count/state
    broadcast({ type: "players", players: connectedCount() });
  }

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      return;
    }

    if (data.type === "choose") {
      const player = ws.playerIndex;

      // reject wrong turn or if opponent isn't connected
      if (player !== state.currentPlayer || connectedCount() < 2) return;

      state.scores[player] += data.value;

      if (state.scores[player] >= state.target) {
        broadcast({
          type: "win",
          winner: player,
          scores: state.scores,
          players: connectedCount(),
        });
        // you may want to reset state here or wait for manual reset
        return;
      }

      // switch turns
      state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;

      // broadcast updated state (include players count)
      broadcast({ type: "state", state: state, players: connectedCount() });
    }
  });

  ws.on("close", () => {
    console.log(`Player ${ws.playerIndex} left`);

    // clear slot
    if (typeof ws.playerIndex === "number") {
      state.players[ws.playerIndex] = null;
    }

    // reset game state (you can customize this)
    state.scores = [0, 0];
    state.currentPlayer = 0;

    // notify remaining clients who left and how many players remain
    broadcast({
      type: "player_left",
      slot: ws.playerIndex,
      players: connectedCount(),
    });
  });
});

console.log("WS server running on ws://localhost:8080");
