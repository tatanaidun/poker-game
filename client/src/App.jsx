// client/src/App.jsx
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
        margin: 4,
        padding: 8,
        border: isJoker ? "2px solid orange" : "1px solid #ccc",
        borderRadius: 8,
        cursor: onClick ? "pointer" : "default",
        minWidth: 52,
        minHeight: 68,
        textAlign: "center",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        userSelect: "none",
        ...style,
      }}
    >
      <div style={{ fontWeight: 700 }}>{card.rank}</div>
      <div style={{ fontSize: 14 }}>{card.suit}</div>
      {isJoker && <div style={{ fontSize: 12 }}>★</div>}
    </div>
  );
}

/*
  DraggableCard:
  - drag source: item contains { card, fromGroup (null for hand), index (for hand index) }
  - also acts as drop target for hand-slot reordering (we handle reorder on drop)
*/
function DraggableCard({
  card,
  fromGroup = null, // null → hand, number → group index
  index = null, // card index inside hand or group
  onClick,
  onDropToHand,
}) {
  // Drag source
  const [{ isDragging }, dragRef] = useDrag({
    type: CARD_ITEM,
    item: { card, fromGroup, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Accept drop ON TOP of this card (hand reordering)
  const [, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      // Both must be from hand to reorder
      if (
        item.fromGroup === null &&
        fromGroup === null &&
        typeof item.index === "number" &&
        typeof index === "number"
      ) {
        if (item.index !== index) {
          onDropToHand?.(item.index, index);
        }
      }
      // groups handled elsewhere
      return undefined;
    },
  });

  // merge drag & drop refs
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
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(1.04)" : "none",
        transition: "transform 120ms ease, opacity 120ms ease",
      }}
    >
      <CardView card={card} isJoker={card.rank === "JOKER"} onClick={onClick} />
    </div>
  );
}

/*
  HandSlot: an empty slot area between cards which acts as a drop target.
  We render these between items to allow dropping at ends or between cards.
*/
function HandSlot({ targetIndex, onDropHere }) {
  const [, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.fromGroup === null) {
        // from hand → reorder
        onDropHere({
          fromHandIndex: item.index,
          toHandIndex: targetIndex,
        });
      } else {
        // from group → hand insert
        onDropHere({
          fromGroupIndex: item.fromGroup,
          toHandIndex: targetIndex,
          card: item.card,
        });
      }
    },
  });

  return (
    <div
      ref={dropRef}
      style={{
        width: 10,
        minHeight: 70,
        margin: "0 3px",
        display: "inline-block",
        background: "transparent",
      }}
    />
  );
}

/*
  Bucket (group) drop target:
  - Accepts CARD_ITEM drops. On drop we call addCard(item.card, item.fromGroup, bucketIndex)
  - Visual highlight when hovered.
*/
function Bucket({ cards, index, addCard }) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      addCard(item.card, item.fromGroup, index);
    },
    collect: (m) => ({ isOver: m.isOver({ shallow: true }) }),
  });

  return (
    <div
      ref={dropRef}
      style={{
        minWidth: 160,
        minHeight: 92,
        border: `2px dashed ${isOver ? "#40a9ff" : "#bbb"}`,
        margin: 6,
        padding: 8,
        borderRadius: 8,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "flex-start",
        background: isOver ? "#f0fbff" : "#fafafa",
        transition: "border-color 120ms, background 120ms",
      }}
    >
      {cards.length === 0 ? (
        <div style={{ color: "#999", padding: 8 }}>Drop here</div>
      ) : (
        cards.map((c) => (
          <div key={c.id} style={{ margin: 4 }}>
            <CardView card={c} isJoker={c.rank === "JOKER"} />
          </div>
        ))
      )}
    </div>
  );
}

/* ---------- Main App ---------- */

export default function App() {
  const wsRef = useRef(null);

  const [playerIndex, setPlayerIndex] = useState(null);
  const [playersConnected, setPlayersConnected] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [hand, setHand] = useState([]);
  const [deckCount, setDeckCount] = useState(0);
  const [discardPile, setDiscardPile] = useState([]);
  const [groups, setGroups] = useState([[], [], [], []]); // 4 buckets by default
  const [turn, setTurn] = useState(0);
  const [specialJoker, setSpecialJoker] = useState(null);

  // Setup websocket once
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

        // server includes per-client playerIndex in each message; prefer that
        const idx =
          typeof msg.playerIndex === "number"
            ? msg.playerIndex
            : msg.playerIndex;
        if (msg.hands && typeof idx === "number") {
          setHand(msg.hands[idx] || []);
        } else {
          setHand([]); // will get update soon
        }
      }

      if (msg.type === "update") {
        setDeckCount(msg.deckCount || 0);
        setDiscardPile(msg.discardPile || []);
        setTurn(typeof msg.turn === "number" ? msg.turn : turn);
        setGroups(msg.groups || [[], [], [], []]);
        // msg.playerIndex is per-client; server already included it
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

    ws.onclose = () => {
      // connection closed
    };

    return () => {
      try {
        ws.close();
      } catch (e) {
        console.log(e);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify(payload));
  };

  const canPlay =
    gameStarted && !gameOver && playersConnected === 2 && playerIndex === turn;

  // Draw from deck (server authoritative)
  const onDraw = () => {
    if (!canPlay) return alert("Not your turn");
    send({ type: "draw" });
  };

  // Discard (server authoritative)
  const onDiscard = (card) => {
    if (!canPlay) return alert("Not your turn");
    send({ type: "discard", card });
  };

  // Reorder in-hand after drop: called when card dropped onto a HandSlot or onto another card
  // fromIdx: original index, toIdx: desired index (0..hand.length)
  const reorderInHand = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newHand = [...hand];
    const [moving] = newHand.splice(fromIdx, 1);
    newHand.splice(toIdx, 0, moving);
    setHand(newHand);
    // persist order on server (send IDs)
    send({ type: "reorder", order: newHand.map((c) => c.id) });
  };

  // Add card to group (move from hand or from another group to target group)
  // card: card object
  // fromGroup: null (hand) or index
  // toGroup: index
  const addCardToGroup = (card, fromGroup, toGroup) => {
    const newGroups = groups.map((g) => [...g]);

    // remove from source
    if (fromGroup === null) {
      // remove from hand locally (optimistic)
      setHand((prev) => prev.filter((c) => c.id !== card.id));
    } else {
      newGroups[fromGroup] = newGroups[fromGroup].filter(
        (c) => c.id !== card.id
      );
    }

    // add to dest
    newGroups[toGroup].push(card);
    setGroups(newGroups);

    // send grouping update to server
    send({ type: "group", groups: newGroups });
  };

  // Move card from group back into hand at position (drop into hand slot)
  // If card originates from a group, server grouping update will be sent when we call addCardToGroup with fromGroup and target as null.
  // We'll implement hand-slot drop behavior to accept cards from group: HandSlot handles that by passing fromGroup index
  const addCardFromGroupToHandAt = (fromGroup, atIndex, card) => {
    // remove from group locally
    const newGroups = groups.map((g) => [...g]);
    newGroups[fromGroup] = newGroups[fromGroup].filter((c) => c.id !== card.id);
    setGroups(newGroups);

    // insert into hand at atIndex
    const newHand = [...hand];
    newHand.splice(atIndex, 0, card);
    setHand(newHand);
    // notify server: mapping groups -> newGroups, and reorder -> new hand order
    send({ type: "group", groups: newGroups });
    send({ type: "reorder", order: newHand.map((c) => c.id) });
  };

  const onDeclare = () => {
    // local quick validation
    let hasPure = false,
      hasDummy = false;
    groups.forEach((g) => {
      if (g.length >= 3) {
        const suits = g
          .filter((c) => c.rank !== "JOKER")
          .map((c) => c.suit)
          .filter(Boolean);
        if (suits.length > 0 && new Set(suits).size === 1) hasPure = true;
        else hasDummy = true;
      }
    });
    if (!hasPure || !hasDummy) {
      if (
        !confirm(
          "Local check suggests declaration may be invalid. Send to server anyway?"
        )
      )
        return;
    }
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
      <div style={{ padding: 20, fontFamily: "Inter, system-ui, Arial" }}>
        <h2>13-Card Rummy (Two-Player)</h2>

        <div style={{ marginBottom: 8 }}>
          <strong>You are:</strong>{" "}
          {typeof playerIndex === "number"
            ? `Player ${playerIndex + 1}`
            : "..."}
          {"  "}
          <small style={{ color: "#666" }}>
            {playersConnected}/2 connected
          </small>
        </div>

        {!gameStarted ? (
          <div>
            <p>Waiting for both players to join...</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div>
                Turn: <strong>Player {turn + 1}</strong>
              </div>
              <div>Deck left: {deckCount}</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={onDraw} disabled={!canPlay || deckCount === 0}>
                Draw
              </button>
              <button onClick={sortHand} disabled={!gameStarted}>
                Sort Hand
              </button>
              <button onClick={onDeclare} disabled={!canPlay}>
                Declare
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 24,
                alignItems: "flex-start",
                marginBottom: 18,
              }}
            >
              <div style={{ minWidth: 180 }}>
                <h4>Discard (open)</h4>
                {discardPile.length > 0 ? (
                  <CardView
                    card={discardPile[0]}
                    isJoker={discardPile[0].rank === "JOKER"}
                  />
                ) : (
                  <div style={{ color: "#666" }}>Empty</div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h4>Your Hand</h4>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    paddingBottom: 8,
                  }}
                >
                  {/* Left slot (drop before first card) */}
                  <HandSlot
                    targetIndex={0}
                    onDropHere={(sourceGroupOrIndex, targetIndex, card) => {
                      const isFromHand =
                        typeof sourceGroupOrIndex === "number" && !card;
                      const isFromGroup =
                        typeof sourceGroupOrIndex === "number" && card;

                      if (isFromHand) {
                        // Reorder within hand
                        reorderInHand(sourceGroupOrIndex, targetIndex);
                      } else if (isFromGroup) {
                        // Move from group → hand
                        addCardFromGroupToHandAt(
                          sourceGroupOrIndex,
                          targetIndex,
                          card
                        );
                      }
                    }}
                  />

                  {hand.map((c, idx) => (
                    <span
                      key={c.id}
                      style={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <DraggableCard
                        card={c}
                        fromGroup={null}
                        index={idx}
                        onClick={() => canPlay && onDiscard(c)}
                        onDropToHand={(srcIndex, tgtIndex) =>
                          reorderInHand(srcIndex, tgtIndex)
                        }
                      />
                      {/* slot after this card */}
                      <HandSlot
                        targetIndex={idx + 1}
                        onDropHere={(sourceGroupOrIndex, targetIndex, card) => {
                          const isFromHand =
                            typeof sourceGroupOrIndex === "number" && !card;
                          const isFromGroup =
                            typeof sourceGroupOrIndex === "number" && card;

                          if (isFromHand) {
                            reorderInHand(sourceGroupOrIndex, targetIndex);
                          } else if (isFromGroup) {
                            addCardFromGroupToHandAt(
                              sourceGroupOrIndex,
                              targetIndex,
                              card
                            );
                          }
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <h4>Groups (Drag cards here)</h4>
              <div style={{ display: "flex", gap: 8 }}>
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

            <div style={{ marginTop: 12 }}>
              <h4>Special Joker</h4>
              {specialJoker ? (
                <CardView card={specialJoker} isJoker />
              ) : (
                <div>—</div>
              )}
            </div>
          </>
        )}
      </div>
    </DndProvider>
  );
}
