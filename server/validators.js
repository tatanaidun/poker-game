// validators.js

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
];

// Convert rank → number for sorting
function rankValue(rank) {
  return RANK_ORDER.indexOf(rank);
}

// Decide if card is a joker
function isJoker(card, special) {
  // Printed joker
  if (card.rank === "JOKER") return true;

  // If printed joker was chosen → all Aces are jokers
  if (special.rank === "A" && special.suit === "ALL") {
    return card.rank === "A";
  }

  // Otherwise → jokers are all cards with same rank as special
  return card.rank === special.rank;
}

function checkGroupValidity(group, specialJoker) {
  if (group.length < 3) return { valid: false, type: null };

  const jokers = group.filter((c) => isJoker(c, specialJoker));
  const actual = group.filter((c) => !isJoker(c, specialJoker));

  // --------------------------------------------------
  // 1) VALIDATE SET (AAAA or K♣ K♦ K♥ K♠)
  // --------------------------------------------------
  if (actual.length > 0 && actual.every((c) => c.rank === actual[0].rank)) {
    const suits = new Set(actual.map((c) => c.suit));
    if (suits.size === actual.length && group.length <= 4) {
      return { valid: true, type: "set" };
    }
  }

  // --------------------------------------------------
  // 2) VALIDATE SEQUENCE (same suit)
  // --------------------------------------------------
  if (actual.length > 0) {
    const suits = actual.map((c) => c.suit);
    if (new Set(suits).size !== 1) {
      return { valid: false, type: null }; // sequence must be same suit
    }
  }

  // Sort by rank
  const sorted = [...actual].sort(
    (a, b) => rankValue(a.rank) - rankValue(b.rank)
  );

  // A can be HIGH only if Q + K exist
  const hasQ = sorted.some((c) => c.rank === "Q");
  const hasK = sorted.some((c) => c.rank === "K");

  const values = sorted
    .map((card) => {
      // If Ace is high (Q-K-A)
      if (card.rank === "A" && hasQ && hasK) return 13;
      return rankValue(card.rank);
    })
    .sort((a, b) => a - b);

  // Calculate needed jokers to fill gaps
  let needed = 0;

  for (let i = 0; i < values.length - 1; i++) {
    const a = values[i];
    const b = values[i + 1];

    const diff = b - a;

    if (diff === 1) continue; // perfect adjacency
    if (diff < 1) return { valid: false, type: null }; // duplicate or reverse
    needed += diff - 1; // count missing ranks
  }

  if (needed > jokers.length) return { valid: false, type: null };

  return {
    valid: true,
    type: jokers.length ? "impure" : "pure",
  };
}

// --------------------------------------------------
// DECLARATION VALIDATION (13 cards, 1 pure + 1 more sequence)
// --------------------------------------------------

function isValidRummyDeclaration(groups, specialJoker) {
  let total = 0;
  let hasPure = false;
  let hasSecond = false;

  for (const g of groups) {
    if (g.length === 0) continue;
    total += g.length;

    const { valid, type } = checkGroupValidity(g, specialJoker);
    if (!valid) return false;

    if (type === "pure") {
      if (!hasPure) hasPure = true;
      else if (!hasSecond) hasSecond = true;
    }

    if (type === "impure") {
      if (hasPure && !hasSecond) hasSecond = true;
    }
  }

  return total === 13 && hasPure && hasSecond;
}

module.exports = { checkGroupValidity, isValidRummyDeclaration };
