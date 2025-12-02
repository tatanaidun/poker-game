// src/components/DeckActions.jsx
import styles from "./styles/DeckActions.module.css";

export default function DeckActions({
  deckCount,
  canDraw,
  sendMessage,
  setCardPicked,
}) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Deck</div>

      <div className={styles.countBox}>{deckCount}</div>

      <button
        className={`${styles.btn} ${!canDraw ? styles.btnDisabled : ""}`}
        disabled={!canDraw}
        onClick={() => {
          sendMessage({ type: "draw" });
          setCardPicked(true);
        }}
        type="button"
      >
        Draw Card
      </button>
    </div>
  );
}
