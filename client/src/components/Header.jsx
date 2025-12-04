import styles from "./styles/Header.module.css";

export default function Header({ playersConnected }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Rummy Table</h1>

      <div className={styles.rightBox}>
        <span className={styles.players}>
          {playersConnected}/2 Players Connected
        </span>
      </div>
    </header>
  );
}
