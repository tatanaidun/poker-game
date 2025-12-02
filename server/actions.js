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

// ---------- UPDATE GROUPS ----------
function updateGroups(pi, groups) {
  // always deep replace
  state.groups[pi] = groups.map((g) => [...g]);
}

// ---------- MOVE GROUP → HAND ----------
function moveGroupToHand(pi, cardId, fromGroupIndex, newHandOrder) {
  let found = null;

  // remove card from groups
  const group = state.groups[pi][fromGroupIndex];
  const idx = group.findIndex((c) => c.id === cardId);
  if (idx !== -1) {
    [found] = group.splice(idx, 1);
  }

  if (!found) {
    // fallback search
    for (const g of state.groups[pi]) {
      const index = g.findIndex((c) => c.id === cardId);
      if (index !== -1) {
        [found] = g.splice(index, 1);
        break;
      }
    }
  }

  if (!found) return; // safety

  const inventory = [...state.hands[pi], ...state.groups[pi].flat(), found];

  const inventoryMap = new Map(inventory.map((c) => [c.id, c]));

  const newHand = [];
  for (const id of newHandOrder) {
    if (inventoryMap.has(id)) {
      newHand.push(inventoryMap.get(id));
      inventoryMap.delete(id);
    }
  }

  // append leftovers safely
  for (const c of inventoryMap.values()) {
    if (!newHand.some((x) => x.id === c.id)) newHand.push(c);
  }

  // dedupe
  const seen = new Set();
  state.hands[pi] = newHand.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

module.exports = {
  draw,
  pickDiscard,
  discard,
  updateGroups,
  moveGroupToHand,
};
