module.exports = {
  room: {
    players: [], // { ws, index }
    hands: [[], []],
    deck: [],
    discardPile: [],
    turn: 0,
    specialJoker: null,
    groups: [[], []],
    state: "waiting", // waiting | playing | game_over
    winner: null,
  },

  send(ws, msg) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(msg));
  },

  broadcast(room, msg) {
    room.players.forEach((p) => {
      module.exports.send(p.ws, { ...msg, players: room.players.length });
    });
  },

  broadcastToPlayers(room, msg) {
    room.players.forEach((p, idx) => {
      module.exports.send(p.ws, {
        ...msg,
        playerIndex: idx,
        players: room.players.length,
      });
    });
  },
};
