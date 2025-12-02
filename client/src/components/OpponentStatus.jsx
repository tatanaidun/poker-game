import styles from "./styles/OpponentStatus.module.css";

export default function OpponentStatus({ playerIndex, turn }) {
  const isOpponentTurn = turn !== playerIndex;

  return (
    <div className={styles.card}>
      <div className={styles.label}>Opponent</div>
      <div className={isOpponentTurn ? styles.active : styles.idle}>
        {isOpponentTurn ? "Playing…" : "Idle"}
      </div>
    </div>
  );
}
