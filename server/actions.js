// actions.js
const state = require("./gameState");

// ---------- DRAW ----------
function draw(pi) {
  if (state.turn !== pi) return;
  if (state.hands[pi].length !== 13) return;
  if (!state.deck.length) return;

  const card = state.deck.pop();
  state.hands[pi].push(card);
}

// ---------- PICK DISCARD ----------
function pickDiscard(pi) {
  if (state.turn !== pi) return;
  if (state.hands[pi].length !== 13) return;
  if (!state.discardPile.length) return;

  const card = state.discardPile.shift();
  state.hands[pi].push(card);
}

// ---------- DISCARD ----------
function discard(pi, cardId) {
  if (state.turn !== pi) return;
  if (state.hands[pi].length !== 14) return;

  const idx = state.hands[pi].findIndex((c) => c.id === cardId);
  if (idx === -1) return;

  const [card] = state.hands[pi].splice(idx, 1);
  state.discardPile.unshift(card);

  state.turn = state.turn === 0 ? 1 : 0;
}

// ---------- UPDATE GROUPS (HAND ↔ GROUP OWNERSHIP FIX) ----------
function updateGroups(pi, groups) {
  if (!Array.isArray(groups)) return;

  // Normalize groups to exactly 4 arrays
  const normalized = Array.from({ length: 4 }, (_, i) =>
    Array.isArray(groups[i]) ? [...groups[i]] : []
  );

  // All card ids that are now in groups
  const groupedIds = new Set(normalized.flat().map((c) => c.id));

  // Remove those from hand
  if (groupedIds.size > 0) {
    state.hands[pi] = state.hands[pi].filter((c) => !groupedIds.has(c.id));
  }

  // Save groups
  state.groups[pi] = normalized;
}

// ---------- MOVE GROUP → HAND (CLICK ON CARD IN GROUP) ----------
function moveGroupToHand(pi, cardId, fromGroupIndex, newHandOrder) {
  let card = null;

  // 1) Remove from specified group if present
  if (typeof fromGroupIndex === "number" && state.groups[pi][fromGroupIndex]) {
    const group = state.groups[pi][fromGroupIndex];
    const idx = group.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      [card] = group.splice(idx, 1);
    }
  }

  // 2) Fallback: remove from any group
  if (!card) {
    for (let gi = 0; gi < state.groups[pi].length; gi++) {
      const g = state.groups[pi][gi];
      const idx = g.findIndex((c) => c.id === cardId);
      if (idx !== -1) {
        [card] = g.splice(idx, 1);
        break;
      }
    }
  }

  if (!card) return;

  // 3) Ensure card is not in hand already
  state.hands[pi] = state.hands[pi].filter((c) => c.id !== cardId);

  // 4) Build new hand from order + existing cards
  const map = new Map();
  map.set(card.id, card);
  for (const c of state.hands[pi]) map.set(c.id, c);

  const newHand = [];
  if (Array.isArray(newHandOrder) && newHandOrder.length) {
    for (const id of newHandOrder) {
      const found = map.get(id);
      if (found) {
        newHand.push(found);
        map.delete(id);
      }
    }
  }

  // Append any leftovers (defensive; should usually be none)
  for (const c of map.values()) {
    if (!newHand.some((x) => x.id === c.id)) newHand.push(c);
  }

  state.hands[pi] = newHand;
}

module.exports = {
  draw,
  pickDiscard,
  discard,
  updateGroups,
  moveGroupToHand,
};
