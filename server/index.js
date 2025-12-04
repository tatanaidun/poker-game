// server/index.js
const WebSocket = require("ws");
const url = require("url");
const { onConnection } = require("./wsHandlers");

const wss = new WebSocket.Server({ port: 8080 }, () =>
  console.log("WebSocket server running on ws://localhost:8080")
);

wss.on("connection", (ws, req) => {
  const parsed = url.parse(req.url, true);
  const roomId = parsed.query?.room;

  if (!roomId) {
    console.log("[WS] Rejected — no room id");
    ws.close();
    return;
  }

  console.log("[WS] Client joined room:", roomId);

  onConnection(ws, roomId); // ✔️ pass only roomId
});
