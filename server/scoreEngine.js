// scoreEngine.js
// Verwaltet das Punktesystem fuer den Real-or-Fake-Modus.
// Punkte basieren auf:
//   1. Richtige Antwort
//   2. Wie frueh innerhalb der Runde abgestimmt wurde (frueherer Vote = mehr Punkte)
//
// Punkteformel:
//   Basispunkte = 1000
//   Zeitbonus = bis zu 500 extra Punkte (linear absteigend je spaeter der Vote kam)
//   Wer falsch liegt bekommt 0 Punkte

const EventEmitter = require('events');

const BASE_POINTS = 1000;
const TIME_BONUS_MAX = 500;

class ScoreEngine extends EventEmitter {
  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.isActive = false;
    this.totalRounds = 10;
    this.currentRound = 0;
    this.scores = new Map(); // username -> gesamtpunkte
    this.roundHistory = []; // [{roundNum, correctAnswer, pointsAwarded: Map}]
    this.pendingVotes = new Map(); // username -> { vote, timestamp }
    this.roundStartTime = null;
    this.roundDurationMs = 0;
    this.correctAnswer = null; // wird nach Timer-Ende gesetzt: '1' oder '2'
  }

  // Startet eine neue Session (z.B. 10 Runden)
  startSession(totalRounds = 10) {
    this.reset();
    this.isActive = true;
    this.totalRounds = totalRounds;
    this.emit('session:started', this.getPublicState());
  }

  // Wird aufgerufen wenn eine Voting-Runde startet (um Timestamps zu tracken)
  onRoundStart(durationMs) {
    this.currentRound++;
    this.pendingVotes = new Map();
    this.roundStartTime = Date.now();
    this.roundDurationMs = durationMs;
    this.correctAnswer = null;
  }

  // Registriert einen Vote mit Timestamp (fuer Zeitbonus-Berechnung)
  registerVote(username, vote, timestamp) {
    if (!this.isActive) return;
    const key = username.toLowerCase();
    // Letzter Vote zaehlt (wie im normalen Voting), aber Timestamp des ERSTEN Votes
    // wird fuer den Zeitbonus verwendet — wer sich sicher ist und frueh votet soll belohnt werden
    const existing = this.pendingVotes.get(key);
    this.pendingVotes.set(key, {
      vote,
      // Wenn bereits ein Vote da war, behalte den fruehesten Timestamp
      timestamp: existing ? existing.timestamp : timestamp,
    });
  }

  // Wird nach Rundenende aufgerufen mit der richtigen Antwort ('1' = Real, '2' = Fake)
  resolveRound(correctAnswer) {
    if (!this.isActive) return null;
    this.correctAnswer = correctAnswer;

    const pointsThisRound = new Map();
    const now = Date.now();
    const elapsed = now - (this.roundStartTime || now);

    for (const [username, { vote, timestamp }] of this.pendingVotes) {
      if (vote !== correctAnswer) continue; // Falsch = 0 Punkte

      // Zeitbonus: wie frueh hat der User abgestimmt? (relativ zur Rundendauer)
      const voteElapsed = Math.max(0, timestamp - (this.roundStartTime || timestamp));
      const fraction = this.roundDurationMs > 0
        ? Math.min(1, voteElapsed / this.roundDurationMs)
        : 0;
      const timeBonus = Math.round(TIME_BONUS_MAX * (1 - fraction));
      const points = BASE_POINTS + timeBonus;

      pointsThisRound.set(username, points);
      this.scores.set(username, (this.scores.get(username) || 0) + points);
    }

    this.roundHistory.push({
      roundNum: this.currentRound,
      correctAnswer,
      pointsAwarded: pointsThisRound,
    });

    const state = this.getPublicState();
    this.emit('round:resolved', state);

    // Letzte Runde?
    if (this.currentRound >= this.totalRounds) {
      setTimeout(() => {
        this.isActive = false;
        this.emit('session:ended', this.getPublicState());
      }, 4000); // 4 Sekunden Ergebnis anzeigen, dann Session-Ende
    }

    return state;
  }

  endSession() {
    this.isActive = false;
    this.emit('session:ended', this.getPublicState());
  }

  getLeaderboard() {
    return Array.from(this.scores.entries())
      .map(([username, score]) => ({ username, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10
  }

  getPublicState() {
    return {
      isActive: this.isActive,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      correctAnswer: this.correctAnswer,
      leaderboard: this.getLeaderboard(),
      isLastRound: this.currentRound >= this.totalRounds,
    };
  }
}

module.exports = ScoreEngine;
