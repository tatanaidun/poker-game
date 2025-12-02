// Paste this entire file to replace your existing App.jsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const CARD_ITEM = "CARD";
// Corrected Suit order: Spades, Hearts, Diamonds, Clubs
const SUIT_ORDER = ["♠", "♥", "♦", "♣"];
const RANK_ORDER = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "JOKER",
];

// --- Style Constants ---
const PRIMARY_COLOR = "#1d4ed8"; // Blue-700
const SUCCESS_COLOR = "#10b981"; // Green-600
const WARNING_COLOR = "#f59e0b"; // Yellow-600
const BACKGROUND_COLOR = "#f9fafb"; // Gray-50
const CARD_WIDTH = "52px";
const CARD_HEIGHT = "72px";
const BORDER_RADIUS = "0.5rem";

// Helper for common styles
const styles = {
  cardBase: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px",
    borderRadius: BORDER_RADIUS,
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    transition: "all 0.15s ease-in-out",
    userSelect: "none",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    textAlign: "center",
    fontFamily: "Inter, sans-serif",
  },
  sectionCard: {
    padding: "1rem",
    borderRadius: "0.75rem",
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
  },
  buttonBase: {
    padding: "8px 16px",
    borderRadius: "0.5rem",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    transition: "all 0.15s",
    cursor: "pointer",
    fontWeight: "500",
    border: "none",
  },
  waitingBox: {
    margin: "40px auto",
    padding: "32px",
    textAlign: "center",
    borderRadius: "1rem",
    backgroundColor: "#ffffff",
    boxShadow:
      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    maxWidth: "500px",
  },
};
// -----------------------

function CardView({ card, onClick, isJoker, isSpecialJoker, style }) {
  if (!card) return null;

  const isRedSuit = card.suit === "♥" || card.suit === "♦";
  const suitColor = isRedSuit ? "#dc2626" : "#1f2937"; // Red-600 or Gray-900

  let cardStyle = {
    ...styles.cardBase,
    border: "1px solid #d1d5db", // Gray-300
    backgroundColor: "#ffffff",
  };

  if (isJoker) {
    cardStyle = {
      ...cardStyle,
      border: "2px solid #f97316", // Orange-500
      backgroundColor: "#fffbeb", // Yellow-50
    };
  }
  if (isSpecialJoker) {
    cardStyle = {
      ...cardStyle,
      border: "4px solid #10b981", // Green-500
      backgroundColor: "#d1fae5", // Green-100
    };
  }

  return (
    <div
      onClick={onClick}
      style={{
        ...cardStyle,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: "16px", color: suitColor }}>
        {card.rank}
      </div>
      <div style={{ fontSize: "20px", lineHeight: "1", color: suitColor }}>
        {card.suit}
      </div>
      {(isJoker || isSpecialJoker) && (
        <div style={{ fontSize: "10px", fontWeight: "600" }}>★ JOKER</div>
      )}
    </div>
  );
}

/* DraggableCard */
function DraggableCard({
  card,
  fromGroup = null,
  index = null,
  onClick,
  onDropToHand,
  style = {},
  specialJokerCard,
}) {
  const isSpecialJoker =
    specialJokerCard && card.rank === specialJokerCard.rank;
  const isPrintedJoker = card.rank === "JOKER";

  const [{ isDragging }, dragRef] = useDrag({
    type: CARD_ITEM,
    item: { card, fromGroup, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      // Hand Reorder
      if (item.fromGroup === null && fromGroup === null) {
        if (item.index !== index) {
          onDropToHand({ fromHandIndex: item.index, toHandIndex: index });
        }
      }
      // Group -> Hand (Dropped ON TOP of a card, which sets the index for insertion)
      else if (item.fromGroup !== null && fromGroup === null) {
        onDropToHand({
          fromGroupIndex: item.fromGroup,
          toHandIndex: index,
          card: item.card,
        });
      }
      return undefined;
    },
  });

  const attachRef = useCallback(
    (node) => {
      dragRef(node);
      dropRef(node);
    },
    [dragRef, dropRef]
  );

  return (
    <div
      ref={attachRef}
      style={{
        display: "inline-block",
        transition: "transform 0.12s",
        opacity: isDragging ? 0.35 : 1,
        cursor: "grab",
        verticalAlign: "top",
        margin: "0",
        ...style,
      }}
    >
      <CardView
        card={card}
        isJoker={isPrintedJoker}
        isSpecialJoker={isSpecialJoker}
        onClick={onClick}
      />
    </div>
  );
}

/* HandSlot - Drop target between cards in hand for insertion */
function HandSlot({ targetIndex, onDropHere }) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.fromGroup === null) {
        // Drop from hand to hand (reorder)
        onDropHere({
          fromHandIndex: item.index,
          toHandIndex: targetIndex,
        });
      } else {
        // Drop from group to hand (insertion)
        onDropHere({
          fromGroupIndex: item.fromGroup,
          toHandIndex: targetIndex,
          card: item.card,
        });
      }
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });

  return (
    <div
      ref={dropRef}
      style={{
        width: "12px",
        height: CARD_HEIGHT,
        margin: "0 4px", // mx-1
        display: "inline-block",
        verticalAlign: "middle",
        borderRadius: "2px",
        flexShrink: 0,
        background: isOver ? "rgba(37, 99, 235, 0.2)" : "transparent", // Blue-500 hover
      }}
    />
  );
}

/* Bucket - Grouping Area */
function Bucket({ cards, index, addCard, specialJoker }) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.fromGroup === index) return;
      addCard(item.card, item.fromGroup, index);
    },
    collect: (m) => ({ isOver: m.isOver({ shallow: true }) }),
  });

  return (
    <div
      ref={dropRef}
      style={{
        minWidth: "144px", // min-w-36
        minHeight: "96px", // min-h-24
        padding: "8px",
        borderRadius: "0.75rem",
        margin: "8px",
        boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.06)", // shadow-inner
        transition: "all 0.2s",
        display: "flex",
        flexWrap: "wrap",
        alignContent: "flex-start",
        gap: "4px",
        border: isOver ? "2px solid #3b82f6" : "2px dashed #d1d5db", // Blue-500 or Gray-300
        backgroundColor: isOver ? "#eff6ff" : "#f3f4f6", // Blue-50 or Gray-100 (Conditional is the correct one)
      }}
    >
      {cards.length === 0 ? (
        <div
          style={{
            color: "#6b7280",
            width: "100%",
            textAlign: "center",
            marginTop: "24px",
            fontSize: "14px",
          }}
        >
          Drop Group Here
        </div>
      ) : (
        cards.map((c, idx) => (
          <DraggableCard
            key={c.id}
            card={c}
            fromGroup={index}
            index={idx}
            onDropToHand={() => {}}
            specialJokerCard={specialJoker}
          />
        ))
      )}
    </div>
  );
}

/* Main App */
export default function App() {
  const wsRef = useRef(null);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [playersConnected, setPlayersConnected] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const [hand, setHand] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [discardPile, setDiscardPile] = useState([]);
  const [groups, setGroups] = useState([[], [], [], []]);

  const [turn, setTurn] = useState(null);
  const [specialJoker, setSpecialJoker] = useState(null);
  const [gameMessage, setGameMessage] = useState(null);

  const totalCardsInGroups = useMemo(() => groups.flat().length, [groups]);

  // Refs to keep latest state available inside ws handlers without re-creating handlers
  const playerIndexRef = useRef(playerIndex);
  const gameStartedRef = useRef(gameStarted);
  const playersConnectedRef = useRef(playersConnected);

  // keep refs in sync with state
  useEffect(() => {
    playerIndexRef.current = playerIndex;
  }, [playerIndex]);
  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);
  useEffect(() => {
    playersConnectedRef.current = playersConnected;
  }, [playersConnected]);

  // Custom function to render the turn status text
  const renderTurnStatus = useCallback(() => {
    if (playerIndex === null) {
      return "Waiting for assignment...";
    }

    if (turn === null || !gameStarted) {
      return "Game starting...";
    }

    if (turn === playerIndex) {
      return "YOUR TURN";
    } else if (turn >= 0) {
      // Display the correct opponent player number (index + 1)
      return `Player ${turn + 1}'s Turn`;
    }

    return "Waiting...";
  }, [playerIndex, turn, gameStarted]);

  // Reset function to clear state fully upon game reset/player leave
  const resetGameState = useCallback(() => {
    setGameStarted(false);
    setHand([]);
    setDeckCount(0);
    setDiscardPile([]);
    setGroups([[], [], [], []]);
    setTurn(null);
    setSpecialJoker(null);
  }, []);

  // Create websocket once on mount (do NOT depend on playerIndex/gameStarted)
  //   useEffect(() => {
  //     const ws = new WebSocket("ws://localhost:8080");
  //     wsRef.current = ws;

  //     ws.onopen = () => {
  //       console.log("[WS] Connected. Joining room.");

  //       // Send join message. Use the latest playerIndex if available (usually null on first join).
  //       ws.send(
  //         JSON.stringify({
  //           type: "join_room",
  //           room: "table-1",
  //           playerId: playerIndexRef.current,
  //         })
  //       );
  //     };

  //     ws.onmessage = (evt) => {
  //       let msg = null;
  //       try {
  //         msg = JSON.parse(evt.data);
  //       } catch (e) {
  //         console.warn("Invalid WS message", e, evt.data);
  //         return;
  //       }

  //       // assigned -> server gives you your player slot
  //       if (msg.type === "assigned") {
  //         const assignedPlayerIndex = msg.player;
  //         setPlayerIndex(assignedPlayerIndex);
  //         setPlayersConnected(msg.players || 1);
  //         console.log("[CLIENT ASSIGNED] Player Index:", assignedPlayerIndex);
  //         return;
  //       }

  //       // players -> reported number of connected players in room
  //       if (msg.type === "players") {
  //         setPlayersConnected(msg.players || 0);
  //         if (!gameStartedRef.current && msg.players === 2) {
  //           setGameMessage("2 players connected. Game ready to start.");
  //         }
  //         return;
  //       }

  //       if (msg.type === "player_left") {
  //         setGameMessage(`Player ${msg.slot + 1} left. Game reset.`);
  //         resetGameState(); // Reset all game state
  //         return;
  //       }

  //       // game_start -> server tells clients to show board + initial deal
  //       if (msg.type === "game_start") {
  //         console.log("[SERVER] Game Start Message Received.");

  //         // set authoritative shared bits
  //         setGameStarted(true);
  //         setGameMessage(null);
  //         setSpecialJoker(msg.specialJoker || null);
  //         setDeckCount(msg.deckCount || 0);
  //         setDiscardPile(msg.discardPile || []);
  //         setGroups([[], [], [], []]);
  //         setPlayersConnected(msg.numPlayers || 2);

  //         if (typeof msg.turn === "number") {
  //           setTurn(msg.turn);
  //         } else {
  //           setTurn(0);
  //         }

  //         // set hand if the server included hands and we already know our player slot
  //         const myIndex = playerIndexRef.current;
  //         if (typeof myIndex === "number" && msg.hands && msg.hands[myIndex]) {
  //           setHand(msg.hands[myIndex]);
  //         } else {
  //           // If we don't yet have an assigned player index, we'll rely on the 'assigned'
  //           // message that should come (server must ensure assigned arrives before game_start).
  //           setHand([]);
  //         }
  //         return;
  //       }

  //       // update -> incremental state updates
  //       if (msg.type === "update") {
  //         // Only process update when client has playerIndex assigned (otherwise we don't know which hand to read)
  //         const myIndex = playerIndexRef.current;
  //         if (typeof myIndex === "number") {
  //           console.log("[SERVER UPDATE] Received state for P" + (myIndex + 1), {
  //             deckCount: msg.deckCount,
  //             turn: msg.turn,
  //             gameStartedNow: gameStartedRef.current,
  //           });

  //           // Authoritative state updates
  //           setDeckCount(msg.deckCount || 0);
  //           setDiscardPile(msg.discardPile || []);
  //           setPlayersConnected(msg.numPlayers || playersConnectedRef.current);

  //           if (typeof msg.turn === "number") {
  //             setTurn(msg.turn);
  //           }

  //           // Only update hand/groups if the UI is showing the game board (server started)
  //           if (gameStartedRef.current) {
  //             const currentGroups = msg.groups?.[myIndex];
  //             if (currentGroups && Array.isArray(currentGroups)) {
  //               setGroups(currentGroups);
  //             }

  //             const currentHand = msg.hands?.[myIndex];
  //             if (currentHand) {
  //               setHand(currentHand);
  //             }
  //             setGameMessage(null);
  //           }
  //         } else {
  //           // Not assigned yet; ignore update (or you might console.log for debugging)
  //           console.debug("[UPDATE] Ignored update - client not assigned yet");
  //         }
  //         return;
  //       }

  //       if (msg.type === "win") {
  //         setGameMessage(
  //           `Player ${msg.winner + 1} wins! Game will restart shortly.`
  //         );
  //         setGameStarted(false);
  //         setTurn(null);
  //         return;
  //       }

  //       if (msg.type === "invalid_declare") {
  //         setGameMessage(
  //           "Invalid declaration! Check your groups (1 Pure + 1 Dummy required). Turn passed."
  //         );
  //         return;
  //       }

  //       if (msg.type === "error") {
  //         setGameMessage(`Server Error: ${msg.error}`);
  //         return;
  //       }
  //     };

  //     ws.onerror = (err) => {
  //       console.error("[WS] Error", err);
  //       setGameMessage("WebSocket error. Check server or reload.");
  //     };

  //     return () => {
  //       try {
  //         if (wsRef.current) {
  //           wsRef.current.close();
  //         }
  //         wsRef.current = null;
  //       } catch (e) {
  //         console.log(e);
  //       }
  //     };
  //     // IMPORTANT: empty dependency array -> create socket once
  //   }, []); // <-- create socket once

  //   // keep the refs in sync (we already do this above via small useEffects but repeating to be safe)
  //   useEffect(() => {
  //     playerIndexRef.current = playerIndex;
  //   }, [playerIndex]);
  //   useEffect(() => {
  //     gameStartedRef.current = gameStarted;
  //   }, [gameStarted]);
  //   useEffect(() => {
  //     playersConnectedRef.current = playersConnected;
  //   }, [playersConnected]);
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected.");

      ws.send(
        JSON.stringify({
          type: "join_room",
          room: "table-1",
        })
      );
    };

    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch (e) {
        console.warn("Invalid WS message", e, evt.data);
        return;
      }

      // -----------------------------
      // 1) ASSIGNED
      // -----------------------------
      if (msg.type === "assigned") {
        console.log("✔ Assigned player slot:", msg.player);
        setPlayerIndex(msg.player);
        setPlayersConnected(msg.players || 1);
        return;
      }

      // -----------------------------
      // 2) PLAYERS (count only)
      // -----------------------------
      if (msg.type === "players") {
        setPlayersConnected(msg.players || 0);
        return;
      }

      // -----------------------------
      // 3) PLAYER LEFT
      // -----------------------------
      if (msg.type === "player_left") {
        setGameMessage(`Player ${msg.slot + 1} left. Game reset.`);
        resetGameState();
        return;
      }

      // From here onward, we MUST know playerIndex.
      const myIndex = playerIndexRef.current;

      if (myIndex === null || myIndex === undefined) {
        console.log(
          "[WS] Ignoring message because playerIndex is not assigned yet.",
          msg
        );
        return; // 🔥 Prevents hand = []
      }

      // -----------------------------
      // 4) GAME START
      // -----------------------------
      if (msg.type === "game_start") {
        console.log("✔ Game Start Received");

        setGameStarted(true);
        setGameMessage(null);
        setSpecialJoker(msg.specialJoker || null);
        setDeckCount(msg.deckCount || 0);
        setDiscardPile(msg.discardPile || []);
        setGroups([[], [], [], []]); // 4 empty group buckets
        setPlayersConnected(msg.numPlayers || 2);

        setTurn(typeof msg.turn === "number" ? msg.turn : 0);

        // SAFELY set hand only for THIS player
        if (msg.hands && Array.isArray(msg.hands[myIndex])) {
          setHand(msg.hands[myIndex]);
        }

        return;
      }

      // -----------------------------
      // 5) UPDATE
      // -----------------------------
      if (msg.type === "update") {
        if (!gameStartedRef.current) {
          console.log("[WS UPDATE] Ignored because game not started yet");
          return;
        }

        setDeckCount(msg.deckCount || 0);
        setDiscardPile(msg.discardPile || []);
        setTurn(typeof msg.turn === "number" ? msg.turn : turn);
        setPlayersConnected(msg.players || playersConnectedRef.current);

        // update groups
        if (msg.groups && msg.groups[myIndex]) {
          setGroups(msg.groups[myIndex]);
        }

        // update hand (only your own hand)
        if (msg.hands && Array.isArray(msg.hands[myIndex])) {
          setHand(msg.hands[myIndex]);
        }

        return;
      }

      // -----------------------------
      // 6) DECLARE / ERROR / WIN
      // -----------------------------
      if (msg.type === "win") {
        setGameMessage(`Player ${msg.winner + 1} wins!`);
        setGameStarted(false);
        return;
      }

      if (msg.type === "invalid_declare") {
        setGameMessage("Invalid declaration! Turn passed.");
        return;
      }

      if (msg.type === "error") {
        setGameMessage(`Server Error: ${msg.error}`);
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error", err);
      setGameMessage("WebSocket error. Check server or reload.");
    };

    return () => {
      try {
        wsRef.current?.close();
        wsRef.current = null;
      } catch (e) {
        console.log(e);
      }
    };
  }, []);

  const send = (payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open. Cannot send payload:", payload);
      setGameMessage("Error: Connection lost. Please refresh.");
      return;
    }
    wsRef.current.send(JSON.stringify(payload));
  };

  // Turn checks for control flow
  const isMyTurn = playerIndex !== null && turn === playerIndex;
  const canPlay = gameStarted && playersConnected === 2 && isMyTurn;
  const isReadyToDiscard = hand.length === 14;
  const isReadyToDeclare = canPlay && hand.length === 1;

  const onDraw = () => {
    if (!canPlay) return setGameMessage("Not your turn!");
    if (hand.length !== 13)
      return setGameMessage(
        "You must discard a card before drawing again, or you already drew this turn."
      );
    send({ type: "draw" });
  };

  const onPickDiscard = () => {
    if (!canPlay) return setGameMessage("Not your turn!");
    if (hand.length !== 13)
      return setGameMessage(
        "You must have 13 cards in hand to draw from the discard pile."
      );
    send({ type: "pick_discard" });
  };

  const onDiscard = (card) => {
    if (!canPlay) return setGameMessage("Not your turn!");
    if (!isReadyToDiscard)
      return setGameMessage(
        "You must draw a card (14 cards total) before discarding."
      );

    // 1. Send action to server
    send({ type: "discard", card });

    // 2. Set a temporary message while waiting for the server update
    setGameMessage(
      `Discarding ${card.rank}${card.suit}. Waiting for opponent's turn...`
    );
  };

  const reorderInHand = ({ fromHandIndex, toHandIndex }) => {
    if (fromHandIndex === toHandIndex) return;
    const newHand = [...hand];
    const [moving] = newHand.splice(fromHandIndex, 1);
    newHand.splice(toHandIndex, 0, moving);
    setHand(newHand);
    // Send updated hand order to server for persistence/sync
    send({ type: "reorder", order: newHand.map((c) => c.id) });
  };

  const addCardToGroup = (card, fromGroup, toGroup) => {
    const newGroups = groups.map((g) => [...g]);

    if (fromGroup !== null && fromGroup !== undefined) {
      const sourceGroupIndex = newGroups[fromGroup].findIndex(
        (c) => c.id === card.id
      );
      if (sourceGroupIndex !== -1) {
        newGroups[fromGroup].splice(sourceGroupIndex, 1);
      }
    }

    newGroups[toGroup].push(card);
    setGroups(newGroups);

    let newHand = [...hand];
    if (fromGroup === null || fromGroup === undefined) {
      // Card moved from hand to group
      newHand = hand.filter((c) => c.id !== card.id);
      setHand(newHand);
      send({ type: "sync_hand", hand: newHand.map((c) => c.id) });
    }

    // Send updated groups state
    send({ type: "group", groups: newGroups });
  };

  const addCardFromGroupToHandAt = ({ fromGroupIndex, toHandIndex, card }) => {
    const newGroups = groups.map((g) => [...g]);

    // Remove from group
    newGroups[fromGroupIndex] = newGroups[fromGroupIndex].filter(
      (c) => c.id !== card.id
    );
    setGroups(newGroups);

    // Add to hand
    const newHand = [...hand];
    newHand.splice(toHandIndex, 0, card);
    setHand(newHand);

    // Sync state with server
    send({
      type: "move_group_to_hand",
      cardId: card.id,
      fromGroupIndex: fromGroupIndex,
      toHandOrder: newHand.map((c) => c.id),
      groups: newGroups, // Send the updated groups array too
    });
  };

  const onDeclare = () => {
    if (!isReadyToDeclare) {
      return setGameMessage(
        "You must have exactly 1 card left in hand to declare (the final discard)."
      );
    }
    // We send the current groups and the final discard (the card left in hand)
    send({
      type: "declare",
      groups: groups,
      finalDiscard: hand[0],
    });
    setGameMessage("Declaration sent to server for validation...");
  };

  const sortHand = () => {
    const sorted = [...hand].sort((a, b) => {
      // 1. Joker handling (Jokers always go to the end)
      const isASpecialJoker = specialJoker && a.rank === specialJoker.rank;
      const isBSpecialJoker = specialJoker && b.rank === specialJoker.rank;
      const isAPrintedJoker = a.rank === "JOKER";
      const isBPrintedJoker = b.rank === "JOKER";

      const isAJoker = isASpecialJoker || isAPrintedJoker;
      const isBJoker = isBSpecialJoker || isBPrintedJoker;

      if (isAJoker && !isBJoker) return 1; // a is joker, b is not -> a comes later
      if (isBJoker && !isAJoker) return -1; // b is joker, a is not -> b comes later
      if (isAJoker && isBJoker) {
        // If both are jokers, rely on their type (Printed/Special)
        if (isAPrintedJoker && !isBPrintedJoker) return 1;
        if (isBPrintedJoker && !isAPrintedJoker) return -1;
        return 0;
      }

      // 2. Suit sorting (Suit is the primary sort key)
      const sA = SUIT_ORDER.indexOf(a.suit);
      const sB = SUIT_ORDER.indexOf(b.suit);
      if (sA !== sB) return sA - sB;

      // 3. Rank sorting (Rank is the secondary sort key)
      const rA = RANK_ORDER.indexOf(a.rank);
      const rB = RANK_ORDER.indexOf(b.rank);
      return rA - rB;
    });
    setHand(sorted);
    send({ type: "reorder", order: sorted.map((c) => c.id) });
  };

  // Logic to generate the opponent status message
  const getOpponentStatusMessage = () => {
    if (!gameStarted && playersConnected < 2)
      return `Game is waiting for ${
        2 - playersConnected
      } more player(s) to start...`;

    if (isMyTurn) {
      if (hand.length === 14) {
        return "You drew a card. Please discard one card to end your turn.";
      }
      if (hand.length === 13) {
        return "It is your turn. Draw from the Deck or Pick Discard.";
      }
      if (hand.length === 1) {
        return "You are ready to Declare! Group your cards and click Declare.";
      }
      return "It is your turn. Make your move.";
    } else if (turn !== null && turn !== playerIndex) {
      // If it's the opponent's turn, 'turn' holds the opponent's index.
      const opponentPlayerNumber = turn + 1;
      return `Waiting for Player ${opponentPlayerNumber} to finish their turn.`;
    }
    return "Waiting for game state...";
  };

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Set width to 100% and overflowX: 'hidden' to prevent global scrollbar */}
      <div
        style={{
          padding: "16px", // p-4
          minHeight: "100vh",
          fontFamily: "Inter, sans-serif",
          backgroundColor: BACKGROUND_COLOR,
          color: "#1f2937", // Gray-800
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "30px", // text-3xl
            fontWeight: "bold",
            textAlign: "center",
            color: PRIMARY_COLOR, // Blue-700
            marginBottom: "16px", // mb-4
          }}
        >
          13-Card Rummy Table
        </h1>

        {/* Outer content wrapper for centering on large screens */}
        <div
          style={{
            maxWidth: "1200px", // Set a maximum width for desktop comfort
            width: "100%",
            margin: "0 auto", // Center content on large screens
            height: "100%",
          }}
        >
          {/* Status Area (Always visible) */}
          <div
            style={{
              margin: "0 auto 16px", // mx-auto mb-4
              ...styles.sectionCard,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              <span>
                You are Player:
                <span style={{ color: PRIMARY_COLOR, fontSize: "24px" }}>
                  {typeof playerIndex === "number" ? playerIndex + 1 : "?"}
                </span>
                of {playersConnected} connected
              </span>
              <span>
                Status:{" "}
                <span
                  style={{ color: gameStarted ? SUCCESS_COLOR : WARNING_COLOR }}
                >
                  {gameStarted
                    ? "Playing"
                    : playersConnected < 2
                    ? "Waiting for Opponent"
                    : "Ready to Start"}
                </span>
              </span>
            </div>
            {gameMessage && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  textAlign: "center",
                  borderRadius: "0.5rem",
                  backgroundColor:
                    gameMessage.includes("Error") ||
                    gameMessage.includes("Invalid")
                      ? "#fee2e2"
                      : "#d1fae5",
                  color:
                    gameMessage.includes("Error") ||
                    gameMessage.includes("Invalid")
                      ? "#b91c1c"
                      : "#10b981",
                  fontWeight: "500",
                }}
              >
                {gameMessage}
              </div>
            )}
          </div>

          {/* --- Waiting Screen (Displayed when gameStarted is false) --- */}
          {!gameStarted && (
            <div style={styles.waitingBox}>
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: PRIMARY_COLOR,
                  marginBottom: "16px",
                }}
              >
                Waiting for Game to Start...
              </h2>
              <p style={{ fontSize: "18px", marginBottom: "8px" }}>
                Current Players:{" "}
                <span style={{ fontWeight: "bold" }}>
                  {playersConnected} / 2
                </span>
              </p>
              {playersConnected < 2 ? (
                <p style={{ color: "#6b7280" }}>
                  Please share this link with another player to join the game.
                </p>
              ) : (
                <p style={{ color: SUCCESS_COLOR, fontWeight: "500" }}>
                  All players connected. Waiting for the server to initiate the
                  game start.
                </p>
              )}
            </div>
          )}

          {/* --- Main Game Content (Displayed when gameStarted is true) --- */}
          {gameStarted && (
            <>
              {/* Game Info and Controls */}
              <div
                style={{
                  margin: "0 auto 24px",
                  ...styles.sectionCard,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                    Turn:{" "}
                    <span
                      style={{ color: isMyTurn ? SUCCESS_COLOR : "#dc2626" }}
                    >
                      {renderTurnStatus()}
                    </span>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "600" }}>
                    Special Joker:{" "}
                    <span style={{ color: SUCCESS_COLOR, fontWeight: "bold" }}>
                      {specialJoker
                        ? `${specialJoker.rank} ${specialJoker.suit || "★"}`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={onDraw}
                    disabled={!canPlay || deckCount === 0 || hand.length !== 13}
                    style={{
                      ...styles.buttonBase,
                      backgroundColor: "#3b82f6",
                      color: "#ffffff",
                      boxShadow: "0 4px 6px rgba(59, 130, 246, 0.5)",
                      opacity:
                        !canPlay || deckCount === 0 || hand.length !== 13
                          ? 0.6
                          : 1,
                    }}
                  >
                    Draw from Deck ({deckCount})
                  </button>

                  <button
                    onClick={onPickDiscard}
                    disabled={
                      !canPlay || discardPile.length === 0 || hand.length !== 13
                    }
                    style={{
                      ...styles.buttonBase,
                      backgroundColor: "#3b82f6",
                      color: "#ffffff",
                      boxShadow: "0 4px 6px rgba(59, 130, 246, 0.5)",
                      opacity:
                        !canPlay ||
                        discardPile.length === 0 ||
                        hand.length !== 13
                          ? 0.6
                          : 1,
                    }}
                  >
                    Pick Discard
                  </button>

                  <button
                    onClick={sortHand}
                    style={{
                      ...styles.buttonBase,
                      backgroundColor: "#374151",
                      color: "#ffffff",
                    }}
                  >
                    Sort Hand
                  </button>

                  <button
                    onClick={onDeclare}
                    disabled={!isReadyToDeclare}
                    style={{
                      ...styles.buttonBase,
                      marginLeft: "auto",
                      fontSize: "18px",
                      fontWeight: "bold",
                      boxShadow: isReadyToDeclare
                        ? "0 8px 16px rgba(16, 185, 129, 0.4)"
                        : "none",
                      backgroundColor: isReadyToDeclare
                        ? SUCCESS_COLOR
                        : "#9ca3af",
                      color: isReadyToDeclare ? "#ffffff" : "#f3f4f6",
                      cursor: isReadyToDeclare ? "pointer" : "default",
                    }}
                  >
                    Declare (1 Card Left)
                  </button>
                </div>
              </div>

              {/* Card Areas (Responsive Flex Container) */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "24px",
                  alignItems: "flex-start",
                }}
              >
                {/* Left Column (Discard & Info) - Fixed/Min width */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                    flex: "1 1 200px",
                    maxWidth: "300px",
                  }}
                >
                  {/* Discard Pile */}
                  <div style={{ padding: "8px", ...styles.sectionCard }}>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        marginBottom: "8px",
                        textAlign: "center",
                      }}
                    >
                      Discard
                    </h3>
                    {discardPile.length > 0 ? (
                      <CardView
                        card={discardPile[0]}
                        isJoker={discardPile[0].rank === "JOKER"}
                        isSpecialJoker={
                          specialJoker &&
                          discardPile[0].rank === specialJoker.rank
                        }
                        onClick={() => {
                          if (canPlay && hand.length === 13) {
                            onPickDiscard();
                          } else {
                            setGameMessage(
                              canPlay
                                ? "You can only pick discard if you have 13 cards in hand."
                                : "It is not your turn."
                            );
                          }
                        }}
                        style={{
                          cursor:
                            canPlay && hand.length === 13
                              ? "pointer"
                              : "default",
                          margin: "0 auto",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: CARD_WIDTH,
                          height: CARD_HEIGHT,
                          border: "2px dashed #9ca3af",
                          borderRadius: BORDER_RADIUS,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          color: "#6b7280",
                          margin: "0 auto",
                        }}
                      >
                        Empty
                      </div>
                    )}
                  </div>

                  {/* Opponent Status - Fixed layout restored */}
                  <div
                    style={{
                      minHeight: "100px",
                      padding: "16px",
                      ...styles.sectionCard,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        marginBottom: "8px",
                      }}
                    >
                      Opponent Status
                    </h3>
                    <p style={{ fontSize: "14px", color: "#6b7280" }}>
                      {getOpponentStatusMessage()}
                    </p>
                  </div>
                </div>

                {/* Right Column (Hand & Groups) - Fluid width */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "24px",
                    flex: "3 1 400px",
                    minWidth: "min(100%, 400px)",
                    overflow: "hidden",
                  }}
                >
                  {/* Your Hand */}
                  <div
                    style={{
                      flex: 1,
                      padding: "16px",
                      ...styles.sectionCard,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        marginBottom: "8px",
                      }}
                    >
                      Your Hand ({hand.length} cards)
                    </h3>
                    {/* Horizontal scroll container */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        paddingBottom: "8px",
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        flexGrow: 1,
                      }}
                    >
                      {/* Leading drop slot */}
                      <HandSlot
                        targetIndex={0}
                        onDropHere={(src) => {
                          if (src.card) addCardFromGroupToHandAt(src);
                          else reorderInHand(src);
                        }}
                      />
                      {hand.map((c, idx) => (
                        <span
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <DraggableCard
                            card={c}
                            fromGroup={null}
                            index={idx}
                            onClick={() => {
                              // Discard logic for the 14th card
                              if (canPlay && isReadyToDiscard) {
                                onDiscard(c);
                              } else if (hand.length === 1) {
                                setGameMessage(
                                  "You are in declaration mode. Drag the 13 grouped cards or click Declare."
                                );
                              } else {
                                setGameMessage(
                                  "Discarding is only allowed when you have 14 cards."
                                );
                              }
                            }}
                            onDropToHand={(src) => {
                              if (src.card) addCardFromGroupToHandAt(src);
                              else reorderInHand(src);
                            }}
                            specialJokerCard={specialJoker}
                          />
                          {/* Trailing drop slot */}
                          <HandSlot
                            targetIndex={idx + 1}
                            onDropHere={(src) => {
                              if (src.card) addCardFromGroupToHandAt(src);
                              else reorderInHand(src);
                            }}
                          />
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Groups Area */}
                  <div style={{ padding: "16px", ...styles.sectionCard }}>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        marginBottom: "8px",
                      }}
                    >
                      Groups ({totalCardsInGroups} / 13 cards grouped)
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        height: "100%",
                        flexWrap: "wrap",
                      }}
                    >
                      {groups.map((g, i) => (
                        <Bucket
                          key={i}
                          index={i}
                          cards={g}
                          addCard={addCardToGroup}
                          specialJoker={specialJoker}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {/* End Right Column */}
              </div>
              {/* End Card Areas Flex Container */}
            </>
          )}
        </div>
        {/* End Outer Content Wrapper */}
      </div>
    </DndProvider>
  );
}
