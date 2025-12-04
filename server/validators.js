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

// ----- Joker Helpers -----
function isPrintedJoker(card) {
  return card.rank === "JOKER";
}

function isWildJoker(card, special) {
  if (!special) return false;

  // Printed joker selected → all A's become wild
  if (special.rank === "A" && special.suit === "ALL") {
    return card.rank === "A";
  }

  // Otherwise any card of same rank becomes wild
  return card.rank === special.rank;
}

// ----- SEQUENCE CHECK -----
function checkSequence(group, special, treatWildAsJoker) {
  const printed = group.filter(isPrintedJoker);
  const wild = group.filter((c) => isWildJoker(c, special));

  const jokerCount = printed.length + (treatWildAsJoker ? wild.length : 0);

  // “Actual” cards that must follow sequence rules
  const actual = group.filter((c) => {
    if (isPrintedJoker(c)) return false;
    if (treatWildAsJoker && isWildJoker(c, special)) return false;
    return true;
  });

  if (actual.length === 0) return { valid: false, type: null };

  // Suit check
  const suits = actual.map((c) => c.suit);
  if (new Set(suits).size !== 1) return { valid: false, type: null };

  // Rank ordering (with Q-K-A)
  const base = actual.map((c) => RANK_ORDER.indexOf(c.rank));
  const hasA = base.includes(0);
  const hasQ = base.includes(11);
  const hasK = base.includes(12);

  const ranks = base
    .map((i) => (i === 0 && hasQ && hasK ? 13 : i))
    .sort((a, b) => a - b);

  // Count missing cards in sequence
  let needed = 0;
  for (let i = 0; i < ranks.length - 1; i++) {
    const d = ranks[i + 1] - ranks[i];
    if (d === 0) return { valid: false, type: null }; // duplicate rank
    if (d > 1) needed += d - 1;
  }

  if (needed > jokerCount) return { valid: false, type: null };

  const usesJoker = needed > 0;
  return { valid: true, type: usesJoker ? "impure" : "pure" };
}

// ----- SET CHECK -----
function checkSet(group, special) {
  const natural = group.filter(
    (c) => !isPrintedJoker(c) && !isWildJoker(c, special)
  );

  const jokers = group.length - natural.length;

  // Must have at least 1 natural card
  if (natural.length === 0) return { valid: false, type: null };

  // Natural cards must be same rank
  const rank = natural[0].rank;
  if (!natural.every((c) => c.rank === rank))
    return { valid: false, type: null };

  // Natural suits must be unique (max 4 natural)
  const suits = new Set(natural.map((c) => c.suit));
  if (suits.size !== natural.length) return { valid: false, type: null };
  if (natural.length > 4) return { valid: false, type: null }; // suit rule

  // Jokers can be unlimited — allowed
  const jokerUsed = jokers > 0;

  return {
    valid: true,
    type: jokerUsed ? "impure" : "pure",
  };
}

// ----- MAIN GROUP VALIDATOR -----
function checkGroupValidity(group, special) {
  if (group.length < 3) return { valid: false, type: null };

  // 1. Try sequence treating wild as NORMAL cards
  const seq1 = checkSequence(group, special, false);
  if (seq1.valid) return seq1;

  // 2. Try sequence treating wild as JOKERS
  const seq2 = checkSequence(group, special, true);
  if (seq2.valid) return seq2;

  // 3. Try set
  const set = checkSet(group, special);
  if (set.valid) return set;

  return { valid: false, type: null };
}

// ----- DECLARATION VALIDATOR -----
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

module.exports = {
  checkGroupValidity,
  isValidRummyDeclaration,
};
