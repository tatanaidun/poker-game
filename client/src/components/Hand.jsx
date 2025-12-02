// src/components/Hand.jsx
import React from "react";
import { useDrag, useDrop } from "react-dnd";
import styles from "./styles/Hand.module.css";

const CARD_ITEM = "HAND_CARD";

function HandCard({ card, index, onMove, onClick }) {
  // Make this card draggable
  const [{ isDragging }, dragRef] = useDrag({
    type: CARD_ITEM,
    item: { card, index }, // MUST include card
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Make this card a drop target (reorder in hand)
  const [, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.index === index) return;
      onMove(item.index, index);
      item.index = index; // keep index updated for subsequent drops
    },
  });

  // Combine drag + drop into one callback ref (no useRef, no lint issue)
  const setNodeRef = (node) => {
    if (!node) return;
    dragRef(dropRef(node));
  };
  console.log(card.rank);
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.card}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={onClick}
    >
      <div className={styles.rank}>{card.rank}</div>
      <div className={styles.suit}>{card.suit}</div>
    </button>
  );
}

export default function Hand({
  hand,
  turn,
  playerIndex,
  sendMessage,
  onReorderHand,
}) {
  const isMyTurn = turn === playerIndex;

  // Called when a card is dropped onto another card in hand
  const handleMoveInHand = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const updated = [...hand];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    const newOrderIds = updated.map((c) => c.id);

    // Let parent update state + inform server
    onReorderHand(newOrderIds);
  };

  const handleCardClick = (card) => {
    // click-to-discard only when it's your turn and you have 14 cards
    if (!isMyTurn) return;
    if (hand.length !== 14) return;

    sendMessage({
      type: "discard",
      cardId: card.id,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.title}>Your Hand</div>
        <div className={styles.count}>{hand.length} cards</div>
      </div>

      <div className={styles.scrollArea}>
        {hand.map((card, index) => (
          <HandCard
            key={card.id}
            card={card}
            index={index}
            onMove={handleMoveInHand}
            onClick={() => handleCardClick(card)}
          />
        ))}

        {hand.length === 0 && (
          <div className={styles.empty}>Waiting for cards…</div>
        )}
      </div>

      {isMyTurn && hand.length === 14 && (
        <div className={styles.hint}>Tap a card to discard.</div>
      )}
    </div>
  );
}
