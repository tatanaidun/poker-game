const WebSocket = require("ws");
const { onConnection } = require("./wsHandlers");

const wss = new WebSocket.Server({ port: 8080 }, () =>
  console.log("WebSocket server on ws://localhost:8080")
);

wss.on("connection", onConnection);
