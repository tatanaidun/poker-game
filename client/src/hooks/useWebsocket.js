// src/hooks/useWebsocket.js
import { useEffect, useRef, useState } from "react";

export default function useWebSocket(roomId) {
  const wsRef = useRef(null);

  // Avoid stale closures
  const playerIndexRef = useRef(null);
  const gameStartedRef = useRef(false);
  const playersConnectedRef = useRef(0);
  const prevHandRef = useRef([]); // for detecting newly drawn card
  const pendingHandsRef = useRef(null); // hands received before playerIndex is known
  const [opponentLeft, setOpponentLeft] = useState(false);

  // Public state
  const [serverHandLength, setServerHandLength] = useState(0);
  const [lastDrawnCardId, setLastDrawnCardId] = useState(null);

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
  const [isConnected, setIsConnected] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const gameFinishedRef = useRef(false);

  useEffect(() => {
    gameFinishedRef.current = gameFinished;
  }, [gameFinished]);

  // Keep refs synced
  useEffect(() => {
    playerIndexRef.current = playerIndex;
  }, [playerIndex]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  useEffect(() => {
    playersConnectedRef.current = playersConnected;
  }, [playersConnected]);

  // Safe send
  const sendMessage = (data) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WS not open. Dropping message:", data);
      return;
    }
    console.log("[WS SEND]", data);
    ws.send(JSON.stringify(data));
  };

  // If we got full hands *before* playerIndex was known, apply them once we know it
  useEffect(() => {
    if (playerIndex !== null && pendingHandsRef.current) {
      const full = pendingHandsRef.current;
      if (full[playerIndex]) {
        setHand(full[playerIndex]);
        setServerHandLength(full[playerIndex].length);
        prevHandRef.current = full[playerIndex];
      }
      pendingHandsRef.current = null; // consume
    }
  }, [playerIndex]);

  // Initialize WebSocket WHEN roomId is present
  useEffect(() => {
    if (!roomId) {
      console.log("[WS] No roomId yet, not connecting");
      return;
    }

    console.log(
      `Creating WebSocket connection ws://localhost:8080/?room=${roomId}`
    );

    // Reset local state for new room
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerIndex(null);
    setPlayersConnected(0);
    setGameStarted(false);
    setTurn(null);
    setHand([]);
    setGroups([[], [], [], []]);
    setDeckCount(0);
    setDiscardPile([]);
    setSpecialJoker(null);
    setGameMessage(null);
    setServerHandLength(0);
    setLastDrawnCardId(null);
    prevHandRef.current = [];
    pendingHandsRef.current = null;

    const ws = new WebSocket(
      `ws://localhost:8080/?room=${encodeURIComponent(roomId)}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to room", roomId);
      setIsConnected(true);

      // Optional: you *can* still send a join message; server may ignore it
      ws.send(
        JSON.stringify({
          type: "join_room",
          room: roomId,
          playerId: null,
        })
      );
    };

    ws.onmessage = (evt) => {
      let msg = null;
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
          setGameMessage("Opponent left the game.");
          setGameStarted(false);
          setOpponentLeft(true);
          setHand([]);
          setGroups([[], [], [], []]);
          setDeckCount(0);
          setDiscardPile([]);
          setTurn(null);
          setSpecialJoker(null);
          setServerHandLength(0);
          setLastDrawnCardId(null);

          prevHandRef.current = [];
          break;
        }

        case "game_start": {
          setGameStarted(true);
          setGameMessage(null);

          setSpecialJoker(msg.specialJoker || null);
          setDeckCount(msg.deckCount || 0);
          setDiscardPile(msg.discardPile || []);
          setTurn(typeof msg.turn === "number" ? msg.turn : 0);

          // Store full hands until we know our exact index
          pendingHandsRef.current = msg.hands;

          const myIndex = playerIndexRef.current;

          if (typeof myIndex === "number") {
            // If playerIndex is already known → apply immediately
            const myHand = msg.hands[myIndex] || [];
            setHand(myHand);
            setServerHandLength(myHand.length);
            prevHandRef.current = myHand;
          } else {
            // Player index not known yet → wait for the effect to populate it
            setHand([]);
            setServerHandLength(0);
            prevHandRef.current = [];
          }

          // reset groups
          setGroups([[], [], [], []]);
          setLastDrawnCardId(null);

          break;
        }

        case "left_confirmed":
          console.log("Left room confirmed by server");
          ws.close();
          window.location.href = "/";
          break;

        case "update": {
          const myIndex = playerIndexRef.current;

          // Shared state
          setDeckCount(msg.deckCount || 0);
          setDiscardPile(msg.discardPile || []);
          setPlayersConnected(msg.players || playersConnectedRef.current);

          if (typeof msg.turn === "number") {
            setTurn(msg.turn);
          }

          if (typeof myIndex === "number") {
            // HAND
            if (msg.hands?.[myIndex]) {
              const newHand = msg.hands[myIndex] || [];
              const prevHand = prevHandRef.current || [];

              // Detect newly drawn card (for highlight)
              const prevIds = new Set(prevHand.map((c) => c.id));
              if (newHand.length > prevHand.length) {
                const added = newHand.find((c) => !prevIds.has(c.id));
                if (added) {
                  setLastDrawnCardId(added.id);
                }
              }

              setHand(newHand);
              setServerHandLength(newHand.length);
              prevHandRef.current = newHand;
            }

            // GROUPS
            if (msg.groups?.[myIndex]) {
              setGroups(msg.groups[myIndex]);
            }
          }
          // 🔥 UI notification AFTER state updates
          if (msg.reshuffled) {
            setTimeout(() => {
              setGameMessage("Draw pile empty — reshuffling discard pile…");
              setTimeout(() => setGameMessage(null), 3000);
            }, 10);
          }

          break;
        }

        case "win": {
          setGameFinished(true);
          setGameMessage(`Player ${msg.winner + 1} wins!`);
          setGameStarted(false);
          setTurn(null);
          setLastDrawnCardId(null);
          break;
        }

        case "invalid_declare": {
          setGameMessage(
            msg.reason ||
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
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.warn("[WS] Disconnected");
      setIsConnected(false);

      // Only show disconnect error if game didn't finish
      if (!gameFinishedRef.current) {
        setGameMessage("Connection lost. Please refresh.");
      }
    };

    return () => {
      try {
        ws.close();
      } catch (e) {
        console.error(e);
      }
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [roomId]);

  return {
    // Connection
    isConnected,

    // Game state
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
    serverHandLength,
    lastDrawnCardId,
    opponentLeft,
    // Local mutators used by App DnD logic
    setHand,
    setGroups,

    // Safe WS sender
    sendMessage,
  };
}
