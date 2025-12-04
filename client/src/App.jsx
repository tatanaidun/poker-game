// src/App.jsx
import React, { useEffect, useState } from "react";
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

// Helper to read ?room=... from URL
function getInitialRoomId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "";
}

export default function App() {
  // ─────────────────────────────────────────────
  // ROOM HANDLING
  // ─────────────────────────────────────────────
  const [roomId, setRoomId] = useState(getInitialRoomId);
  const [roomInput, setRoomInput] = useState("");

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
    serverHandLength,
    lastDrawnCardId,
    opponentLeft,
    gameOver,
    winner,
    opponentRematch,
    requestRematch,
    setHand,
    setGroups,
    sendMessage,
  } = useWebSocket(roomId || null);

  const [selectedIds, setSelectedIds] = useState([]);
  const [cardPicked, setCardPicked] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showAnimatedMsg, setShowAnimatedMsg] = useState(false);
  const groupedCount = groups.flat().length;
  const isMyTurn = playerIndex !== null && turn === playerIndex;

  // --- Button conditions based purely on SERVER hand length ---
  const canDraw =
    isMyTurn &&
    !cardPicked &&
    gameStarted &&
    playersConnected === 2 &&
    serverHandLength === 13 &&
    deckCount > 0;

  const canPickDiscard =
    isMyTurn &&
    gameStarted &&
    !cardPicked &&
    playersConnected === 2 &&
    serverHandLength === 13 &&
    discardPile.length > 0;

  const canDiscard =
    isMyTurn &&
    gameStarted &&
    playersConnected === 2 &&
    serverHandLength === 14 &&
    selectedIds.length === 1;

  const canDeclare =
    isMyTurn &&
    gameStarted &&
    playersConnected === 2 &&
    groupedCount === 13 &&
    serverHandLength === 1;

  useEffect(() => {
    if (turn === playerIndex) {
      // reset "card picked" at start of each of MY turns
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCardPicked(false);
    }
  }, [turn, playerIndex]);

  // ─────────────────────────────────────────────
  // LOBBY: CREATE / JOIN ROOM
  // ─────────────────────────────────────────────
  const handleCreateRoom = () => {
    const newId = `room-${Math.random().toString(36).slice(2, 8)}`;
    const params = new URLSearchParams(window.location.search);
    params.set("room", newId);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
    setRoomId(newId);
  };

  const handleJoinRoom = () => {
    const id = roomInput.trim();
    if (!id) return;
    const params = new URLSearchParams(window.location.search);
    params.set("room", id);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
    setRoomId(id);
  };

  // ─────────────────────────────────────────────
  // Selection in hand
  // ─────────────────────────────────────────────
  const handleToggleSelect = (cardId) => {
    setSelectedIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleDiscardSelected = () => {
    if (!canDiscard) return;
    const cardId = selectedIds[0];
    const card = hand.find((c) => c.id === cardId);
    if (!card) return;

    sendMessage({ type: "discard", cardId: card.id });
    setSelectedIds([]);
  };

  // ─────────────────────────────────────────────
  // DnD: hand → groups (multi-select)
  // ─────────────────────────────────────────────
  const handleMoveCardsFromHandToGroup = (ids, targetGroupIndex) => {
    const movingCards = hand.filter((c) => ids.includes(c.id));
    if (!movingCards.length) return;

    const remainingHand = hand.filter((c) => !ids.includes(c.id));
    const newGroups = groups.map((g, idx) =>
      idx === targetGroupIndex ? [...g, ...movingCards] : g
    );

    setHand(remainingHand);
    setGroups(newGroups);
    setSelectedIds([]);

    // Sync with server
    sendMessage({ type: "sync_hand", hand: remainingHand.map((c) => c.id) });
    sendMessage({ type: "group", groups: newGroups });
  };

  // ─────────────────────────────────────────────
  // Hand ↔ hand reorder (single card drag within hand)
  // ─────────────────────────────────────────────
  const handleReorderHand = (fromIndex, toIndex) => {
    const updated = [...hand];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    setHand(updated);
    sendMessage({ type: "reorder", order: updated.map((c) => c.id) });
  };

  // ─────────────────────────────────────────────
  // group → hand (click card in group)
  // ─────────────────────────────────────────────
  const handleReturnCardToHand = (card, fromGroupIndex) => {
    if (!isConnected) return;

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
  // Sort hand button
  // ─────────────────────────────────────────────
  const handleSortHand = () => {
    if (!isConnected) return;

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
    if (!isConnected || !isMyTurn) return;

    if (groupedCount !== 13 || serverHandLength !== 1) {
      // eslint-disable-next-line no-alert
      alert(
        "To declare: 13 cards must be grouped and exactly 1 card left in hand."
      );
      return;
    }

    sendMessage({
      type: "declare",
      groups,
      finalDiscard: hand[0] || null,
    });
  };

  // When gameMessage changes → fade in, auto fade out
  useEffect(() => {
    if (!gameMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAnimatedMsg(false);
      return;
    }

    // Fade in
    setShowAnimatedMsg(true);

    // Auto fade out after 3 seconds
    const t = setTimeout(() => {
      setShowAnimatedMsg(false);
    }, 3000);

    return () => clearTimeout(t);
  }, [gameMessage]);

  // ─────────────────────────────────────────────
  // RENDER: if no room → lobby
  // ─────────────────────────────────────────────
  if (!roomId) {
    return (
      <div className={styles.appContainer}>
        <Header playersConnected={0} />
        <div className={styles.waitingBox}>
          <h2>Start a Private Rummy Table</h2>
          <p>Create a room and share the link with your friend.</p>

          <button
            type="button"
            onClick={handleCreateRoom}
            className={styles.sortButton}
          >
            Create New Room
          </button>

          <div style={{ marginTop: "16px" }}>
            <p>Or join an existing room:</p>
            <input
              type="text"
              placeholder="Enter room id"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              style={{ padding: "6px 8px", minWidth: "220px" }}
            />
            <button
              type="button"
              onClick={handleJoinRoom}
              style={{ marginLeft: "8px" }}
            >
              Join Room
            </button>
          </div>

          <p style={{ marginTop: "16px", fontSize: "12px", color: "#666" }}>
            Once you are in a room, copy the URL from the browser and send it to
            your friend.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: main game
  // ─────────────────────────────────────────────
  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}>
        {gameMessage && (
          <div
            className={`${styles.animatedMessage} ${
              showAnimatedMsg ? styles.show : ""
            }`}
          >
            {gameMessage}
          </div>
        )}
        <Header playersConnected={playersConnected} />
        <button
          className={styles.leaveButton}
          onClick={() => setShowLeaveConfirm(true)}
        >
          Leave Game
        </button>
        <button
          onClick={() => {
            const url = window.location.href;

            if (navigator.share) {
              navigator.share({
                title: "Join my Rummy game!",
                text: "Click to join my Rummy game table",
                url,
              });
            } else {
              navigator.clipboard.writeText(url);
              alert("Link copied! Share it with your friend.");
            }
          }}
          className={styles.shareButton}
        >
          Share Game Link
        </button>

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

        {gameStarted && isConnected && (
          <main className={styles.main}>
            <TurnIndicator
              turn={turn}
              playerIndex={playerIndex}
              gameMessage={gameMessage}
            />

            {gameOver && (
              <div className="rematch-box">
                <h2>Player {winner + 1} wins!</h2>

                <button className="green-btn" onClick={requestRematch}>
                  Play Again
                </button>

                <button
                  className="red-btn"
                  onClick={() => {
                    sendMessage({ type: "leave" });
                    window.location.href = "/";
                  }}
                >
                  Leave Room
                </button>

                {opponentRematch !== null && (
                  <p>Player {opponentRematch + 1} wants a rematch…</p>
                )}
              </div>
            )}
            <OpponentStatus playerIndex={playerIndex} turn={turn} />

            <section className={styles.topRow}>
              <DeckActions
                deckCount={deckCount}
                canDraw={canDraw}
                canPickDiscard={canPickDiscard}
                sendMessage={sendMessage}
                setCardPicked={setCardPicked}
              />

              <DiscardPile
                discardPile={discardPile}
                canPick={canPickDiscard}
                specialJoker={specialJoker}
                sendMessage={sendMessage}
                setCardPicked={setCardPicked}
              />

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
                  className={
                    canDiscard
                      ? styles.discardSelected
                      : styles.discardSelectedDisabled
                  }
                  type="button"
                  onClick={handleDiscardSelected}
                  disabled={!canDiscard}
                >
                  Discard Selected
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
              onDropCardsFromHand={handleMoveCardsFromHandToGroup}
              onReturnCardToHand={handleReturnCardToHand}
            />

            <Hand
              hand={hand}
              turn={turn}
              playerIndex={playerIndex}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onReorderHand={handleReorderHand}
              highlightCardId={lastDrawnCardId}
            />
          </main>
        )}
      </div>
      {showLeaveConfirm && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3>Leave Game?</h3>
            <p>If you leave, the game ends for both players.</p>

            <button
              className={styles.confirmButton}
              onClick={() => {
                sendMessage({ type: "leave" }); // send only once
                window.location.href = "/";
              }}
            >
              Yes, Leave
            </button>

            <button
              className={styles.cancelButton}
              onClick={() => setShowLeaveConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {opponentLeft && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3>Opponent Left</h3>
            <p>Your opponent left the game. Returning to home…</p>

            <button
              className={styles.confirmButton}
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      )}
    </DndProvider>
  );
}
