import styles from "./styles/DiscardPile.module.css";
// DiscardPile.jsx
export default function DiscardPile({
  discardPile,
  canPick,
  sendMessage,
  specialJoker,
}) {
  const top = discardPile[0] || null;

  return (
    <div className={styles.container}>
      <div className={styles.title}>Discard</div>

      {top ? (
        <div className={styles.card}>
          <div className={styles.rank}>{top.rank}</div>
          <div className={styles.suit}>{top.suit}</div>
        </div>
      ) : (
        <div className={styles.empty}>Empty</div>
      )}

      <button
        type="button"
        disabled={!canPick}
        onClick={() => sendMessage({ type: "pick_discard" })}
        className={styles.button}
      >
        Pick Top
      </button>

      {specialJoker && (
        <div className={styles.specialBox}>
          <span className={styles.specialLabel}>Special Joker:</span>
          <span className={styles.specialCard}>
            {specialJoker.rank} {specialJoker.suit}
          </span>
        </div>
      )}
    </div>
  );
}
