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
  onReturnEntireGroup, // NEW
}) {
  const [{ isOver }, dropRef] = useDrop({
    accept: CARD_ITEM,
    drop: (item) => {
      if (item.source !== "hand") return;

      let ids = Array.isArray(item.ids) ? item.ids : [];

      if (!ids.length && item.card?.id) {
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
      {/* 🔥 NEW BUTTON (Return entire group to hand) */}
      {cards.length > 0 && (
        <button
          className={styles.returnAllButton}
          onClick={() => onReturnEntireGroup(groupIndex)}
          title="Return all cards to hand"
        >
          ⟲
        </button>
      )}

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
  onReturnEntireGroup,
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
            onReturnEntireGroup={onReturnEntireGroup} // NEW
          />
        ))}
      </div>
    </div>
  );
}
