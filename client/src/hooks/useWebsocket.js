import { useEffect, useRef, useState } from "react";

export default function useWebSocket() {
  const wsRef = useRef(null);

  // Refs to avoid stale closures
  const playerIndexRef = useRef(null);
  const gameStartedRef = useRef(false);
  const playersConnectedRef = useRef(0);

  // Public state
  const [playerIndex, setPlayerIndex] = useState(null);
  const [playersConnected, setPlayersConnected] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [turn, setTurn] = useState(null);

  const [hand, setHand] = useState([]);
  const [groups, setGroups] = useState([[], [], [], []]);

  const [deckCount, setDeckCount] = useState(0);
  const [discardPile, setDiscardPile] = useState([]);
  const [specialJoker, setSpecialJoker] = useState(null);

  const [gameMessage, setGameMessage] = useState(null);

  // NEW: connection health
  const [isConnected, setIsConnected] = useState(false);

  // keep refs in sync
  useEffect(() => {
    playerIndexRef.current = playerIndex;
  }, [playerIndex]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  useEffect(() => {
    playersConnectedRef.current = playersConnected;
  }, [playersConnected]);

  // Safe send wrapper – never throws when WS is down
  const sendMessage = (data) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WS not open. Dropping message:", data);
      return;
    }
    ws.send(JSON.stringify(data));
  };

  // Create WebSocket once
  useEffect(() => {
    console.log("Creating WebSocket connection to ws://localhost:8080");
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      setIsConnected(true); // ✅ mark healthy

      ws.send(
        JSON.stringify({
          type: "join_room",
          room: "table-1",
          playerId: null,
        })
      );
    };

    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (e) {
        console.warn("Invalid WS message:", e, evt.data);
        return;
      }

      console.log("[WS MESSAGE]", msg);

      switch (msg.type) {
        case "assigned": {
          setPlayerIndex(msg.player);
          setPlayersConnected(msg.players || 1);
          break;
        }

        case "players": {
          setPlayersConnected(msg.players || 0);
          if (!gameStartedRef.current && msg.players === 2) {
            setGameMessage("2 players connected. Getting game ready…");
          }
          break;
        }

        case "player_left": {
          setGameMessage(`Player ${msg.slot + 1} left. Game reset.`);
          setGameStarted(false);
          setHand([]);
          setGroups([[], [], [], []]);
          setDeckCount(0);
          setDiscardPile([]);
          setTurn(null);
          setSpecialJoker(null);
          break;
        }

        case "game_start": {
          setGameStarted(true);
          setGameMessage(null);

          setSpecialJoker(msg.specialJoker || null);
          setDeckCount(msg.deckCount || 0);
          setDiscardPile(msg.discardPile || []);
          setTurn(typeof msg.turn === "number" ? msg.turn : 0);

          const myIndex = playerIndexRef.current;
          if (msg.hands && typeof myIndex === "number") {
            setHand(msg.hands[myIndex] || []);
          } else {
            setHand([]);
          }

          setGroups([[], [], [], []]);
          break;
        }

        case "update": {
          const myIndex = playerIndexRef.current;

          setDeckCount(msg.deckCount || 0);
          setDiscardPile(msg.discardPile || []);
          setPlayersConnected(msg.numPlayers || playersConnectedRef.current);

          if (typeof msg.turn === "number") setTurn(msg.turn);

          if (gameStartedRef.current && typeof myIndex === "number") {
            if (msg.hands?.[myIndex]) {
              setHand(msg.hands[myIndex]);
            }
            if (msg.groups?.[myIndex]) {
              setGroups(msg.groups[myIndex]);
            }
          }
          break;
        }

        case "win": {
          setGameMessage(`Player ${msg.winner + 1} wins!`);
          setGameStarted(false);
          setTurn(null);
          break;
        }

        case "invalid_declare": {
          setGameMessage(
            "Invalid declaration! 1 Pure + 1 Sequence required. Turn passed."
          );
          break;
        }

        case "error": {
          setGameMessage("Server error: " + msg.error);
          break;
        }

        default:
          console.warn("Unhandled WS message:", msg);
      }
    };

    ws.onerror = (err) => {
      console.warn("[WS ERROR]", err);
      // transient errors are common in dev (Vite HMR), don't scare the user
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.warn("[WS] Disconnected", event.code, event.reason || "");
      setIsConnected(false);

      // Only show a user-facing error if we were actually in a game
      if (gameStartedRef.current) {
        setGameMessage("Connection lost. Please refresh.");
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    // connection status
    isConnected,

    // game state
    playerIndex,
    playersConnected,
    gameStarted,
    turn,
    hand,
    groups,
    deckCount,
    discardPile,
    specialJoker,
    gameMessage,

    // setters used by App for local DnD updates
    setHand,
    setGroups,

    // safe sender
    sendMessage,
  };
}
