import { useEffect, useRef, useState } from "react";

export default function App() {
  const wsRef = useRef(null);
  const playerIndexRef = useRef(null); // immediate, sync reference to assigned slot

  const [playerIndex, setPlayerIndex] = useState(null);
  const [scores, setScores] = useState([0, 0]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [info, setInfo] = useState("Connecting...");
  const [gameOver, setGameOver] = useState(false);
  const [playersConnected, setPlayersConnected] = useState(0);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    wsRef.current = socket;

    socket.onopen = () => {
      setInfo("Connected. Waiting for players...");
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      console.log("FE MSG: ", msg);

      // assigned slot (store immediately in ref for sync checks)
      if (msg.type === "assigned") {
        playerIndexRef.current = msg.player; // sync ref used by later state messages
        setPlayerIndex(msg.player);
        setPlayersConnected(
          typeof msg.players === "number" ? msg.players : playersConnected
        );
        setInfo(`You are Player ${msg.player + 1}`);
        return;
      }

      // server informs how many players are present
      if (msg.type === "players") {
        setPlayersConnected(msg.players);
        if (msg.players < 2) setInfo("Waiting for another player...");
        return;
      }

      // full room
      if (msg.type === "full") {
        setInfo("Game full, try again later.");
        return;
      }

      // main state update
      if (msg.type === "state") {
        // update visible state
        setScores(msg.state.scores);
        setCurrentPlayer(msg.state.currentPlayer);
        setPlayersConnected(
          typeof msg.players === "number" ? msg.players : playersConnected
        );

        // If less than 2 players, show waiting message
        if ((msg.players ?? playersConnected) < 2) {
          setInfo("Waiting for another player...");
          return;
        }

        // use the immediate ref (playerIndexRef.current) to decide whose turn it is
        const me = playerIndexRef.current;
        if (me === null || me === undefined) {
          // if for some reason we don't yet know our slot, default to generic message
          setInfo("Game in progress");
          return;
        }

        if (msg.state.currentPlayer === me) {
          setInfo("Your turn!");
        } else {
          setInfo("Opponent's turn...");
        }

        return;
      }

      // someone left
      if (msg.type === "player_left") {
        setPlayersConnected(msg.players);
        // if you are still connected and opponent left, show waiting state
        if (msg.players < 2) {
          setInfo("Opponent left — waiting for another player...");
        }
        // reset UI/game flags
        setGameOver(false);
        setScores([0, 0]);
        setCurrentPlayer(0);
        return;
      }

      // win message
      if (msg.type === "win") {
        setGameOver(true);
        setScores(msg.scores ?? scores);
        setInfo(`Player ${msg.winner + 1} WINS!`);
        return;
      }
    };

    socket.onerror = (err) => {
      console.error("WS error", err);
      setInfo("Connection error");
    };

    return () => {
      try {
        socket.close();
      } catch (e) {
        console.log(e);
      }
    };
  }, []); // run once

  function sendValue(value) {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "choose", value }));
  }

  // hide buttons if:
  // - game not full
  // - game over
  // - not your turn
  const canPlay =
    playersConnected === 2 &&
    !gameOver &&
    playerIndex !== null &&
    currentPlayer === playerIndex;

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h2>Multiplayer Number Battle</h2>

      <p>{info}</p>

      <p>
        Score — P1: {scores[0]} | P2: {scores[1]}
      </p>

      {canPlay && (
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => sendValue(n)}
              style={{ margin: 8, padding: "10px 20px" }}
            >
              +{n}
            </button>
          ))}
        </div>
      )}

      {playersConnected < 2 && <p>Waiting for another player…</p>}
    </div>
  );
}
