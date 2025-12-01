import { useCallback, useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const CARD_ITEM = "CARD";
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

function CardView({ card, onClick, isJoker, style }) {
  if (!card) return null;
  return (
    <div
      onClick={onClick}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        border: isJoker ? "2px solid orange" : "1px solid #ccc",
        borderRadius: 8,
        cursor: onClick ? "pointer" : "default",
        width: 52, // Fixed width to prevent collapsing
        height: 72, // Fixed height
        textAlign: "center",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        userSelect: "none",
        ...style,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16 }}>{card.rank}</div>
      <div style={{ fontSize: 18, lineHeight: 1 }}>{card.suit}</div>
      {isJoker && <div style={{ fontSize: 12 }}>★</div>}
    </div>
  );
}

// function DraggableDiscardCard({ card, canDrag, send }) {
//   const [{ isDragging }, dragRef] = useDrag({
//     type: CARD_ITEM,
//     item: { card, fromGroup: "discard", index: 0 },
//     canDrag: canDrag, // Set based on canPlay and hand.length === 13
//     collect: (monitor) => ({
//       isDragging: monitor.isDragging(),
//     }),
//   });

//   return (
//     <div
//       ref={dragRef}
//       style={{
//         opacity: isDragging ? 0.35 : 1,
//         cursor: canDrag ? "grab" : "default",
//         transform: isDragging ? "scale(1.04)" : "none",
//         transition: "transform 120ms ease, opacity 120ms ease",
//       }}
//     >
//       <CardView
//         card={card}
//         isJoker={card.rank === "JOKER"}
//         // This click handler is for fallback/non-DND picking
//         onClick={() => {
//           if (canDrag) send({ type: "pick_discard" });
//         }}
//       />
//     </div>
//   );
// }

/* DraggableCard 
  Added 'style' prop so parent components (Bucket) can control margins 
*/
function DraggableCard({
  card,
  fromGroup = null,
  index = null,
  onClick,
  onDropToHand,
  style = {},
}) {
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
      // 1. Hand Reorder
      if (
        item.fromGroup === null &&
        fromGroup === null &&
        typeof item.index === "number" &&
        typeof index === "number"
      ) {
        if (item.index !== index) {
          onDropToHand(item.index, index);
        }
      }
      // 2. Group -> Hand (Dropped ON TOP of a card)
      else if (item.fromGroup !== null && fromGroup === null) {
        onDropToHand(item.fromGroup, index, item.card);
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
        // FIX: inline-block ensures it sits nicely in the Bucket row
        display: "inline-block",
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(1.04)" : "none",
        transition: "transform 120ms ease, opacity 120ms ease",
        verticalAlign: "top", // Aligns cards in bucket
        ...style,
      }}
    >
      <CardView card={card} isJoker={card.rank === "JOKER"} onClick={onClick} />
    </div>
  );
}

/* HandSlot */
function HandSlot({ targetIndex, onDropHere }) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.fromGroup === null) {
        onDropHere({
          fromHandIndex: item.index,
          toHandIndex: targetIndex,
        });
      } else {
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
        width: 12,
        height: 72,
        margin: "0 2px",
        display: "inline-block",
        background: isOver ? "rgba(0,0,255,0.1)" : "transparent",
        borderRadius: 4,
        verticalAlign: "middle",
      }}
    />
  );
}

/* Bucket */
function Bucket({ cards, index, addCard }) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      console.log("I m, here", item);
      if (item.fromGroup === index) return;
      addCard(item.card, item.fromGroup, index);
    },
    collect: (m) => ({ isOver: m.isOver({ shallow: true }) }),
  });

  return (
    <div
      ref={dropRef}
      style={{
        minWidth: 140,
        minHeight: 100,
        border: `2px dashed ${isOver ? "#40a9ff" : "#ccc"}`,
        margin: "0 8px 8px 0",
        padding: 8,
        borderRadius: 8,
        background: isOver ? "#f0fbff" : "#fafafa",
        transition: "all 0.2s",
        // Flex container controls layout
        display: "flex",
        flexWrap: "wrap",
        alignContent: "flex-start",
        gap: 4, // Handles spacing between cards
      }}
    >
      {cards.length === 0 ? (
        <div
          style={{
            color: "#999",
            width: "100%",
            textAlign: "center",
            marginTop: 30,
          }}
        >
          Drop Group
        </div>
      ) : (
        cards.map((c, idx) => (
          // FIX: Pass margin via style directly to DraggableCard
          // Removed redundant wrapping <div> which was breaking flex layout
          <DraggableCard
            key={c.id}
            card={c}
            fromGroup={index}
            index={idx}
            onDropToHand={() => {}}
            style={{ margin: 0 }}
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
  const [gameOver, setGameOver] = useState(false);

  const [hand, setHand] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [discardPile, setDiscardPile] = useState([]);
  const [groups, setGroups] = useState([[], [], [], []]);

  const [turn, setTurn] = useState(0);
  const [specialJoker, setSpecialJoker] = useState(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", room: "table-1" }));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      if (msg.type === "assigned") {
        setPlayerIndex(msg.player);
        setPlayersConnected(msg.players || 1);
      }
      if (msg.type === "players") {
        setPlayersConnected(msg.players || 0);
      }
      if (msg.type === "player_left") {
        alert(`Player ${msg.slot + 1} left`);
        setGameStarted(false);
        setHand([]);
        setDeckCount(0);
        setDiscardPile([]);
        setGroups([[], [], [], []]);

        setTurn(0);
        setSpecialJoker(null);
      }
      if (msg.type === "game_start") {
        setGameStarted(true);
        setGameOver(false);
        setSpecialJoker(msg.specialJoker || null);
        setDeckCount(msg.deckCount || 0);
        setDiscardPile(msg.discardPile || []);
        setTurn(msg.turn || 0);
        setGroups([[], [], [], []]);

        const idx =
          typeof msg.playerIndex === "number"
            ? msg.playerIndex
            : msg.playerIndex;
        if (msg.hands && typeof idx === "number") {
          setHand(msg.hands[idx] || []);
        } else {
          setHand([]);
        }
      }
      if (msg.type === "update") {
        setDeckCount(msg.deckCount || 0);
        setDiscardPile(msg.discardPile || []);
        setTurn(typeof msg.turn === "number" ? msg.turn : turn);

        const playerGroups = msg.groups[playerIndex];
        if (playerGroups && Array.isArray(playerGroups)) {
          setGroups(playerGroups); // Use the player's groups directly
        }

        if (typeof msg.playerIndex === "number" && msg.hands) {
          setHand(msg.hands[msg.playerIndex] || []);
        } else if (msg.hands && typeof playerIndex === "number") {
          setHand(msg.hands[playerIndex] || []);
        }
      }
      if (msg.type === "win") {
        alert(`Player ${msg.winner + 1} wins!`);
        setGameOver(true);
        setGameStarted(false);
      }
      if (msg.type === "invalid_declare") {
        alert("Server says: invalid declaration.");
      }
    };

    return () => {
      try {
        ws.close();
      } catch (e) {
        console.log(e);
      }
    };
  }, []);

  const send = (payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  };

  const canPlay =
    gameStarted && !gameOver && playersConnected === 2 && playerIndex === turn;

  const onDraw = () => {
    if (!canPlay) return alert("Not your turn");
    send({ type: "draw" });
  };

  const onDiscard = (card) => {
    if (!canPlay) return alert("Not your turn");
    send({ type: "discard", card });
  };

  const reorderInHand = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newHand = [...hand];
    const [moving] = newHand.splice(fromIdx, 1);
    newHand.splice(toIdx, 0, moving);
    setHand(newHand);
    send({ type: "reorder", order: newHand.map((c) => c.id) });
  };

  const addCardToGroup = (card, fromGroup, toGroup) => {
    const newGroups = groups.map((g) => [...g]);

    // --- FIX 1: Explicitly handle removal from source group ---
    if (fromGroup !== null) {
      const sourceGroupIndex = newGroups[fromGroup].findIndex(
        (c) => c.id === card.id
      );
      if (sourceGroupIndex !== -1) {
        newGroups[fromGroup].splice(sourceGroupIndex, 1);
      }
    }
    console.log("toGroup", toGroup, newGroups);
    // Add to target group
    newGroups[toGroup].push(card);
    console.log(newGroups, "I am jhere 2");
    setGroups(newGroups);

    // If from hand, remove from hand locally (This part was correct)
    let newHand = [...hand];
    if (fromGroup === null) {
      newHand = hand.filter((c) => c.id !== card.id);
      setHand(newHand);
    }

    // Sync everything
    send({ type: "group", groups: newGroups });
    if (fromGroup === null) {
      send({ type: "sync_hand", hand: newHand.map((c) => c.id) });
    }
  };

  const addCardFromGroupToHandAt = (fromGroup, atIndex, card) => {
    const newGroups = groups.map((g) => [...g]);
    newGroups[fromGroup] = newGroups[fromGroup].filter((c) => c.id !== card.id);
    console.log("I ma here eaks", newGroups);
    setGroups(newGroups);

    const newHand = [...hand];
    newHand.splice(atIndex, 0, card);
    setHand(newHand);

    // send({ type: "group", groups: newGroups });
    // send({ type: "sync_hand", hand: newHand.map((c) => c.id) });
    send({
      type: "move_group_to_hand",
      cardId: card.id,
      fromGroupIndex: fromGroup,
      toHandOrder: newHand.map((c) => c.id), // Send the full resulting hand order
    });
  };

  const onDeclare = () => {
    send({ type: "declare" });
  };

  const sortHand = () => {
    const sorted = [...hand].sort((a, b) => {
      if (a.rank === "JOKER" && b.rank !== "JOKER") return 1;
      if (b.rank === "JOKER" && a.rank !== "JOKER") return -1;
      const rA = RANK_ORDER.indexOf(a.rank);
      const rB = RANK_ORDER.indexOf(b.rank);
      if (rA !== rB) return rA - rB;
      const sA = SUIT_ORDER.indexOf(a.suit);
      const sB = SUIT_ORDER.indexOf(b.suit);
      return sA - sB;
    });
    setHand(sorted);
    send({ type: "reorder", order: sorted.map((c) => c.id) });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        style={{
          padding: 20,
          fontFamily: "Inter, system-ui, Arial",
          background: "#f4f4f4",
          minHeight: "100vh",
        }}
      >
        <h2 style={{ marginTop: 0 }}>13-Card Rummy</h2>

        <div
          style={{
            marginBottom: 8,
            padding: 10,
            background: "#fff",
            borderRadius: 8,
          }}
        >
          <strong>
            Player {typeof playerIndex === "number" ? playerIndex + 1 : "?"}
          </strong>
          {" | "} Status: {gameStarted ? "Playing" : "Waiting"}
          {" | "} <small>{playersConnected}/2</small>
        </div>

        {!gameStarted ? (
          <div>Waiting for players...</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 18 }}>
                Turn:{" "}
                <strong
                  style={{ color: turn === playerIndex ? "green" : "red" }}
                >
                  {turn === playerIndex ? "YOUR TURN" : `Player ${turn + 1}`}
                </strong>
              </div>
              <div>Deck: {deckCount}</div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {/* Controls */}
              <button
                onClick={onDraw}
                disabled={!canPlay || deckCount === 0}
                style={{ padding: "8px 16px" }}
              >
                Draw Deck
              </button>
              <button onClick={sortHand} style={{ padding: "8px 16px" }}>
                Sort Hand
              </button>
              <button
                onClick={onDeclare}
                disabled={!canPlay}
                style={{
                  padding: "8px 16px",
                  background: "#ff4d4f",
                  color: "white",
                  border: "none",
                }}
              >
                Declare
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 30,
                alignItems: "flex-start",
                marginBottom: 20,
              }}
            >
              {/* Discard Pile */}
              <div style={{ minWidth: 120 }}>
                <h4 style={{ marginTop: 0 }}>Discard</h4>
                {discardPile.length > 0 ? (
                  <CardView
                    card={discardPile[0]}
                    isJoker={discardPile[0].rank === "JOKER"}
                    onClick={() => {
                      // --- FIX 2: Discard Pick Handler ---
                      if (canPlay && hand.length === 13) {
                        // Only allow picking discard if it's your turn AND you only have 13 cards (i.e., you haven't drawn yet)
                        send({ type: "pick_discard" });
                      } else if (canPlay) {
                        alert(
                          "You must draw only one card per turn. You may not pick the discard pile."
                        );
                      } else {
                        alert("It is not your turn.");
                      }
                    }}
                    style={{
                      cursor:
                        canPlay && hand.length === 13 ? "pointer" : "default",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 72,
                      border: "2px dashed #ccc",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                    }}
                  >
                    Empty
                  </div>
                )}
              </div>

              {/* Hand */}
              <div style={{ flex: 1, overflowX: "auto" }}>
                <h4 style={{ marginTop: 0 }}>Your Hand</h4>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    paddingBottom: 10,
                  }}
                >
                  <HandSlot
                    targetIndex={0}
                    onDropHere={(src, tgt, card) => {
                      if (card) addCardFromGroupToHandAt(src, tgt, card);
                      else reorderInHand(src, tgt);
                    }}
                  />
                  {hand.map((c, idx) => (
                    <span
                      key={c.id}
                      style={{ display: "flex", alignItems: "center" }}
                    >
                      <DraggableCard
                        card={c}
                        fromGroup={null}
                        index={idx}
                        onClick={() => canPlay && onDiscard(c)}
                        onDropToHand={(s, t, card) => {
                          if (card) addCardFromGroupToHandAt(s, t, card);
                          else reorderInHand(s, t);
                        }}
                      />
                      <HandSlot
                        targetIndex={idx + 1}
                        onDropHere={(src, tgt, card) => {
                          if (card) addCardFromGroupToHandAt(src, tgt, card);
                          else reorderInHand(src, tgt);
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Groups Area */}
            <div>
              <h4 style={{ marginTop: 0 }}>Groups (Drag to Organize)</h4>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {groups.map((g, i) => (
                  <Bucket
                    key={i}
                    index={i}
                    cards={g}
                    addCard={addCardToGroup}
                  />
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 10,
                background: "#fff",
                borderRadius: 8,
                display: "inline-block",
              }}
            >
              <strong>Special Joker: </strong>
              {specialJoker
                ? `${specialJoker.rank} ${specialJoker.suit || "★"}`
                : "None"}
            </div>
          </>
        )}
      </div>
    </DndProvider>
  );
}
