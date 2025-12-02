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

function checkGroupValidity(group, specialJoker) {
  if (group.length < 3) return { valid: false, type: null };

  const isJoker = (card) =>
    card.rank === "JOKER" ||
    (specialJoker &&
      card.rank === specialJoker.rank &&
      card.suit !== specialJoker.suit);

  const jokers = group.filter(isJoker);
  const actual = group.filter((c) => !isJoker(c));

  // SET
  if (actual.length > 0 && actual.every((c) => c.rank === actual[0].rank)) {
    const suits = new Set(actual.map((c) => c.suit));
    if (suits.size === actual.length && group.length <= 4) {
      return { valid: true, type: "set" };
    }
  }

  // SEQUENCE
  const suits = actual.map((c) => c.suit).filter(Boolean);
  if (suits.length && new Set(suits).size !== 1)
    return { valid: false, type: null };

  const sorted = [...actual].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );

  const hasQ = sorted.some((c) => c.rank === "Q");
  const hasK = sorted.some((c) => c.rank === "K");
  const hasA = sorted.some((c) => c.rank === "A");

  const ranks = sorted
    .map((c) => RANK_ORDER.indexOf(c.rank))
    .map((i) => (i === 0 && hasQ && hasK ? 13 : i))
    .sort((a, b) => a - b);

  let required = 0;
  for (let i = 0; i < ranks.length - 1; i++) {
    const diff = ranks[i + 1] - ranks[i];
    if (diff === 1) continue;
    if (diff > 1) required += diff - 1;
    else return { valid: false, type: null };
  }

  if (required <= jokers.length) {
    return { valid: true, type: jokers.length ? "impure" : "pure" };
  }

  return { valid: false, type: null };
}

function isValidRummyDeclaration(groups, joker) {
  let hasPure = false;
  let hasSecond = false;
  let total = 0;

  for (const g of groups) {
    if (g.length === 0) continue;
    total += g.length;

    const { valid, type } = checkGroupValidity(g, joker);
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
