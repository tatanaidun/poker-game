// src/components/Groups.jsx
import React from "react";
import { useDrop } from "react-dnd";
import styles from "./styles/Groups.module.css";

const CARD_ITEM = "HAND_CARD";

function GroupBucket({
  cards,
  groupIndex,
  onDropCardsFromHand,
  onReturnCardToHand,
}) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.source !== "hand") return;

      // Prefer multi-ids (new flow)
      let ids = Array.isArray(item.ids) ? item.ids : [];

      // Fallback: old style with item.card
      if (!ids.length && item.card && item.card.id) {
        ids = [item.card.id];
      }

      if (!ids.length) return;

      onDropCardsFromHand(ids, groupIndex);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={dropRef}
      className={`${styles.group} ${isOver ? styles.groupHover : ""}`}
    >
      {cards.length === 0 && (
        <div className={styles.placeholder}>Drop cards here</div>
      )}

      {cards.map((card) => (
        <div
          key={card.id}
          className={styles.card}
          onClick={() => onReturnCardToHand(card, groupIndex)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.rank}>{card.rank}</div>
          <div className={styles.suit}>{card.suit}</div>
        </div>
      ))}
    </div>
  );
}

export default function Groups({
  groups,
  onDropCardsFromHand,
  onReturnCardToHand,
}) {
  const bucketCount = 4;
  const buckets = Array.from(
    { length: bucketCount },
    (_, idx) => groups[idx] || []
  );

  return (
    <div className={styles.container}>
      <div className={styles.title}>Groups</div>
      <div className={styles.groupRow}>
        {buckets.map((cards, idx) => (
          <GroupBucket
            key={idx}
            cards={cards}
            groupIndex={idx}
            onDropCardsFromHand={onDropCardsFromHand}
            onReturnCardToHand={onReturnCardToHand}
          />
        ))}
      </div>
    </div>
  );
}
