import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import useWebSocket from "./hooks/useWebsocket";

import Header from "./components/Header";
import TurnIndicator from "./components/TurnIndicator";
import OpponentStatus from "./components/OpponentStatus";
import DeckActions from "./components/DeckActions";
import DiscardPile from "./components/DiscardPile";
import Groups from "./components/Groups";
import Hand from "./components/Hand";

import styles from "./App.module.css";

export default function App() {
  const {
    isConnected,
    playerIndex,
    playersConnected,
    gameStarted,
    turn,
    hand,
    groups,
    deckCount,
    discardPile,
    specialJoker,
    gameMessage,
    setHand,
    setGroups,
    sendMessage,
  } = useWebSocket();

  const isMyTurn = playerIndex !== null && turn === playerIndex;
  const canDeclare =
    isMyTurn &&
    isConnected &&
    hand.length + groups.flat().length === 14 &&
    groups.flat().length === 13 &&
    hand.length === 1;
  // ─────────────────────────────────────────────
  // DnD: hand → group
  // ─────────────────────────────────────────────
  const handleMoveCardToGroup = (card, targetGroupIndex) => {
    if (!isConnected) return;

    // remove from hand
    const newHand = hand.filter((c) => c.id !== card.id);

    // add to groups
    const newGroups = groups.map((g, idx) =>
      idx === targetGroupIndex ? [...g, card] : g
    );

    setHand(newHand);
    setGroups(newGroups);

    // Sync to server
    sendMessage({ type: "sync_hand", hand: newHand.map((c) => c.id) });
    sendMessage({ type: "group", groups: newGroups });
  };
  // ─────────────────────────────────────────────
  // Hand → Hand reordering (drag inside hand)
  // ─────────────────────────────────────────────
  const handleReorderHand = (newOrderIds) => {
    if (!isConnected) return;

    const map = new Map(hand.map((c) => [c.id, c]));
    const reordered = newOrderIds.map((id) => map.get(id)).filter(Boolean);

    setHand(reordered);
    sendMessage({ type: "reorder", order: newOrderIds });
  };

  // ─────────────────────────────────────────────
  // group → hand (click)
  // ─────────────────────────────────────────────
  const handleReturnCardToHand = (card, fromGroupIndex) => {
    if (!isConnected) {
      console.warn("Ignoring move group→hand: WS not connected");
      return;
    }

    const newGroups = groups.map((g, idx) =>
      idx === fromGroupIndex ? g.filter((c) => c.id !== card.id) : g
    );
    const newHand = [...hand, card];

    setGroups(newGroups);
    setHand(newHand);

    sendMessage({
      type: "move_group_to_hand",
      cardId: card.id,
      fromGroupIndex,
      toHandOrder: newHand.map((c) => c.id),
    });
  };

  // ─────────────────────────────────────────────
  // Sort hand
  // ─────────────────────────────────────────────
  const handleSortHand = () => {
    if (!isConnected) {
      console.warn("Ignoring sort: WS not connected");
      return;
    }

    const SUIT_ORDER = ["♠", "♥", "♦", "♣"];
    const RANK_ORDER = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
      "JOKER",
    ];

    const sorted = [...hand].sort((a, b) => {
      const sA = SUIT_ORDER.indexOf(a.suit || "");
      const sB = SUIT_ORDER.indexOf(b.suit || "");
      if (sA !== sB) return sA - sB;

      const rA = RANK_ORDER.indexOf(a.rank);
      const rB = RANK_ORDER.indexOf(b.rank);
      return rA - rB;
    });

    setHand(sorted);
    sendMessage({ type: "reorder", order: sorted.map((c) => c.id) });
  };

  // ─────────────────────────────────────────────
  // Declare
  // ─────────────────────────────────────────────
  const handleDeclare = () => {
    if (!isConnected) {
      console.warn("Ignoring declare: WS not connected");
      return;
    }
    if (!isMyTurn) return;

    const totalCards = hand.length + groups.flat().length;

    // Must have exactly 14 total cards
    if (totalCards !== 14) {
      alert("You must have exactly 14 cards before declaring.");
      return;
    }

    // Must have exactly 13 cards in groups
    if (groups.flat().length !== 13) {
      alert("13 cards must be arranged into groups before declaring.");
      return;
    }

    // Must have exactly 1 discardable card left in hand
    if (hand.length !== 1) {
      alert("Leave exactly one card in hand before declaring.");
      return;
    }

    sendMessage({
      type: "declare",
      groups,
      finalDiscard: hand[0], // the single card in hand
    });
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}>
        <Header playersConnected={playersConnected} />

        {/* Connection / waiting info */}
        {!isConnected && (
          <div className={styles.waitingBox}>
            <h2>Connecting to game server…</h2>
            <p>Please wait a moment.</p>
          </div>
        )}

        {!gameStarted && isConnected && (
          <div className={styles.waitingBox}>
            <h2>Waiting for Game to Start…</h2>
            <p>Players Connected: {playersConnected} / 2</p>
            {gameMessage && <p className={styles.infoMessage}>{gameMessage}</p>}
          </div>
        )}

        {/* MAIN GAME UI */}
        {gameStarted && isConnected && (
          <main className={styles.main}>
            <TurnIndicator
              turn={turn}
              playerIndex={playerIndex}
              gameMessage={gameMessage}
            />
            <OpponentStatus playerIndex={playerIndex} turn={turn} />
            <section className={styles.topRow}>
              <DeckActions
                deckCount={deckCount}
                canDraw={isMyTurn && hand.length === 13 && isConnected}
                sendMessage={sendMessage}
              />

              <DiscardPile
                discardPile={discardPile}
                canPick={
                  isMyTurn &&
                  hand.length === 13 &&
                  discardPile.length > 0 &&
                  isConnected
                }
                specialJoker={specialJoker}
                sendMessage={sendMessage}
              />

              {/* Sort & Declare */}
              <div className={styles.actionBox}>
                <button
                  type="button"
                  onClick={handleSortHand}
                  className={styles.sortButton}
                  disabled={!isConnected}
                >
                  Sort Hand
                </button>

                <button
                  type="button"
                  onClick={handleDeclare}
                  disabled={!canDeclare}
                  className={
                    canDeclare
                      ? styles.declareButton
                      : styles.declareButtonDisabled
                  }
                >
                  Declare
                </button>
              </div>
            </section>
            <Groups
              groups={groups}
              onDropCardToGroup={handleMoveCardToGroup}
              onReturnCardToHand={handleReturnCardToHand}
            />
            <Hand
              hand={hand}
              turn={turn}
              playerIndex={playerIndex}
              sendMessage={sendMessage}
              onReorderHand={handleReorderHand}
            />
          </main>
        )}
      </div>
    </DndProvider>
  );
}
