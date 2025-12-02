// src/components/Groups.jsx
import React from "react";
import { useDrop } from "react-dnd";
import styles from "./styles/Groups.module.css";

// MUST MATCH Hand.jsx
const CARD_ITEM = "HAND_CARD";

function GroupBucket({
  cards,
  groupIndex,
  onDropCardToGroup,
  onReturnCardToHand,
}) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (!item.card) return;
      onDropCardToGroup(item.card, groupIndex);
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
        <button
          key={card.id}
          type="button"
          className={styles.card}
          onClick={() => onReturnCardToHand(card, groupIndex)}
        >
          <div className={styles.rank}>{card.rank}</div>
          <div className={styles.suit}>{card.suit}</div>
        </button>
      ))}
    </div>
  );
}

export default function Groups({
  groups,
  onDropCardToGroup,
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
            onDropCardToGroup={onDropCardToGroup}
            onReturnCardToHand={onReturnCardToHand}
          />
        ))}
      </div>
    </div>
  );
}
