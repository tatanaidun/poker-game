import styles from "./styles/Header.module.css";

export default function Header({ playersConnected, specialJoker }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Rummy Table</h1>

      <div className={styles.rightBox}>
        <span className={styles.players}>
          {playersConnected}/2 Players Connected
        </span>

        {specialJoker && (
          <div className={styles.jokerBox}>
            <div className={styles.jokerLabel}>Special Joker:</div>
            <div className={styles.jokerCard}>
              <div className={styles.rank}>{specialJoker.rank}</div>
              <div className={styles.suit}>{specialJoker.suit}</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
