const { v4: uuidv4 } = require("uuid");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
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

function createDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: uuidv4(), suit, rank });
    }
  }

  // Printed jokers
  deck.push({ id: uuidv4(), suit: null, rank: "JOKER" });
  deck.push({ id: uuidv4(), suit: null, rank: "JOKER" });

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealHands(deck) {
  const hands = [[], []];
  for (let i = 0; i < 13; i++) {
    hands[0].push(deck.pop());
    hands[1].push(deck.pop());
  }
  return hands;
}

module.exports = { createDeck, shuffle, dealHands };
