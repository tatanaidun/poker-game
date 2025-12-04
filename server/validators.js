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

function rankIndex(rank) {
  return RANK_ORDER.indexOf(rank);
}

function isJokerCard(card, special) {
  // Printed joker
  if (card.rank === "JOKER") return true;

  // Printed joker chosen → all Aces are jokers
  if (special.rank === "A" && special.suit === "ALL") {
    return card.rank === "A";
  }

  // Otherwise → all cards with same rank as special become jokers
  return card.rank === special.rank;
}

function checkGroupValidity(group, special) {
  if (group.length < 3) return { valid: false };

  const jokers = group.filter((c) => isJokerCard(c, special));
  const actual = group.filter((c) => !isJokerCard(c, special));

  // ------------------------------
  // 1) CHECK SET
  // ------------------------------
  if (actual.length > 0 && actual.every((c) => c.rank === actual[0].rank)) {
    const suits = new Set(actual.map((c) => c.suit));
    if (suits.size === actual.length && group.length <= 4) {
      return { valid: true, type: "set" };
    }
  }

  // ------------------------------
  // 2) CHECK SEQUENCE
  // ------------------------------

  // Actual cards must all be same suit
  const suitSet = new Set(actual.map((c) => c.suit));
  if (actual.length > 0 && suitSet.size !== 1) {
    return { valid: false };
  }

  const suit = actual.length > 0 ? actual[0].suit : null;

  // Sort actual ranks numerically
  const actualRanks = actual.map((c) => rankIndex(c.rank));
  actualRanks.sort((a, b) => a - b);

  // Special handling for Q-K-A
  const containsA = actual.some((c) => c.rank === "A");
  const containsK = actual.some((c) => c.rank === "K");
  const containsQ = actual.some((c) => c.rank === "Q");

  let ranks = [...actualRanks];

  if (containsA && containsK && containsQ) {
    // Treat Ace as 14 in Q-K-A sequence
    ranks = ranks.map((i) => (i === 0 ? 13 : i));
    ranks.sort((a, b) => a - b);
  }

  // Count gaps
  let neededJokers = 0;
  for (let i = 0; i < ranks.length - 1; i++) {
    const diff = ranks[i + 1] - ranks[i];
    if (diff === 1) continue;
    if (diff > 1) neededJokers += diff - 1;
    else return { valid: false };
  }

  if (neededJokers <= jokers.length) {
    return {
      valid: true,
      type: jokers.length === 0 ? "pure" : "impure",
    };
  }

  return { valid: false };
}

function isValidRummyDeclaration(groups, special) {
  let total = 0;
  let hasPure = false;
  let hasSecondSeq = false;

  for (const g of groups) {
    if (g.length === 0) continue;

    total += g.length;

    const res = checkGroupValidity(g, special);
    if (!res.valid) return false;

    if (res.type === "pure") {
      if (!hasPure) hasPure = true;
      else if (!hasSecondSeq) hasSecondSeq = true;
    }

    if (res.type === "impure" && hasPure && !hasSecondSeq) {
      hasSecondSeq = true;
    }
  }

  return total === 13 && hasPure && hasSecondSeq;
}

module.exports = { checkGroupValidity, isValidRummyDeclaration };
