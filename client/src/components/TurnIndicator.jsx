import styles from "./styles/TurnIndicator.module.css";

export default function TurnIndicator({ turn, playerIndex, gameMessage }) {
  return (
    <div className={styles.wrapper}>
      {gameMessage ? (
        <div className={styles.messageError}>{gameMessage}</div>
      ) : turn === playerIndex ? (
        <div className={styles.messageTurn}>Your Turn</div>
      ) : (
        <div className={styles.messageWait}>Waiting for Opponent…</div>
      )}
    </div>
  );
}
