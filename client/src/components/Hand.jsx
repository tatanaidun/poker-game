// src/components/Hand.jsx
import React, { useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import styles from "./styles/Hand.module.css";

const CARD_ITEM = "HAND_CARD";

function HandCard({
  card,
  index,
  isSelected,
  onToggleSelect,
  onReorderHand,
  selectedIds,
  highlightCardId,
}) {
  const [{ isDragging }, dragRef] = useDrag({
    type: CARD_ITEM,
    item: () => ({
      source: "hand",
      ids: selectedIds.length > 0 ? selectedIds : [card.id],
      singleId: card.id,
      card,
      fromIndex: index,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.source !== "hand") return;
      if (!item.singleId || item.ids.length !== 1) return;
      if (item.fromIndex === index) return;
      onReorderHand(item.fromIndex, index);
      item.fromIndex = index;
    },
  });

  const setRef = useCallback(
    (node) => {
      if (!node) return;
      dragRef(dropRef(node));
    },
    [dragRef, dropRef]
  );

  const isHighlighted = highlightCardId === card.id;

  return (
    <div
      ref={setRef}
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${
        isHighlighted ? styles.cardHighlighted : ""
      }`}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      onClick={() => onToggleSelect(card.id)}
      role="button"
      tabIndex={0}
    >
      <div className={styles.rank}>{card.rank}</div>
      <div className={styles.suit}>{card.suit}</div>
    </div>
  );
}

export default function Hand({
  hand,
  turn,
  playerIndex,
  selectedIds,
  onToggleSelect,
  onReorderHand,
  highlightCardId,
}) {
  const isMyTurn = turn === playerIndex;

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
            isSelected={selectedIds.includes(card.id)}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onReorderHand={onReorderHand}
            highlightCardId={highlightCardId}
          />
        ))}

        {hand.length === 0 && (
          <div className={styles.empty}>Waiting for cards…</div>
        )}
      </div>

      {isMyTurn && (
        <div className={styles.hint}>
          Click to select cards. Drag selected cards to groups.
        </div>
      )}
    </div>
  );
}
