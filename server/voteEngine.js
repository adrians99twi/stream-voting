// voteEngine.js
// Diese Datei enthaelt die gesamte Logik fuer eine "Runde":
// - Timer starten/stoppen
// - Stimmen pro User speichern (nur die LETZTE Stimme eines Users zaehlt)
// - Live-Zwischenstand berechnen
// - Endergebnis berechnen

const EventEmitter = require('events');

class VoteEngine extends EventEmitter {
  constructor() {
    super();
    this.reset();
  }

  reset() {
    this.isActive = false;
    this.roundId = null;
    this.mode = null; // 'hot' | 'flag' | 'either'
    this.content = null; // { text, imageUrl, optionA, optionB, ... }
    this.durationMs = 60000;
    this.endsAt = null;
    this.votesByUser = new Map(); // username -> '1' | '2'
    this.timerHandle = null;
    this.tickHandle = null;
  }

  // Startet eine neue Voting-Runde
  startRound({ roundId, mode, content, durationSeconds = 60 }) {
    this.clearTimers();
    this.isActive = true;
    this.roundId = roundId;
    this.mode = mode;
    this.content = content;
    this.durationMs = durationSeconds * 1000;
    this.endsAt = Date.now() + this.durationMs;
    this.votesByUser = new Map();

    this.emit('round:started', this.getPublicState());

    // Live-Updates jede 250ms an alle Clients senden (fuer fluessige Balken-Animation)
    this.tickHandle = setInterval(() => {
      this.emit('tick', this.getPublicState());
    }, 250);

    // Timer-Ende
    this.timerHandle = setTimeout(() => {
      this.endRound();
    }, this.durationMs);
  }

  // Verarbeitet eine eingehende Chat-Nachricht als moeglichen Vote
  registerVote(username, rawMessage) {
    if (!this.isActive) return false;

    const trimmed = rawMessage.trim();
    // Erlaubt "1", "2", aber auch Varianten wie "1!" "Option 1" etc. werden NICHT erkannt -
    // bewusst strikt gehalten, damit es eindeutig bleibt.
    if (trimmed !== '1' && trimmed !== '2') return false;

    const key = username.toLowerCase();
    // Der letzte Vote eines Users ueberschreibt den vorherigen -> kein Mehrfachzaehlen,
    // aber Umentscheiden ist erlaubt.
    this.votesByUser.set(key, trimmed);

    this.emit('vote:registered', this.getPublicState());
    return true;
  }

  endRound() {
    if (!this.isActive) return;
    this.clearTimers();
    this.isActive = false;

    const result = this.getPublicState();
    this.emit('round:ended', result);
    return result;
  }

  cancelRound() {
    this.clearTimers();
    this.isActive = false;
    this.emit('round:cancelled', { roundId: this.roundId });
    this.reset();
  }

  // Verlaengert die laufende Runde um zusaetzliche Sekunden
  extendRound(extraSeconds = 10) {
    if (!this.isActive || !this.endsAt) return;
    this.endsAt += extraSeconds * 1000;
    this.durationMs += extraSeconds * 1000;

    // Timer neu setzen, da der alte timeout sonst zu frueh ausloest
    if (this.timerHandle) clearTimeout(this.timerHandle);
    const remaining = Math.max(0, this.endsAt - Date.now());
    this.timerHandle = setTimeout(() => {
      this.endRound();
    }, remaining);

    this.emit('tick', this.getPublicState());
  }

  clearTimers() {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.timerHandle = null;
    this.tickHandle = null;
  }

  // Berechnet den aktuellen Stand (kann waehrend ODER nach der Runde aufgerufen werden)
  getPublicState() {
    let count1 = 0;
    let count2 = 0;
    for (const v of this.votesByUser.values()) {
      if (v === '1') count1++;
      else if (v === '2') count2++;
    }
    const total = count1 + count2;
    const pct1 = total > 0 ? Math.round((count1 / total) * 100) : 50;
    const pct2 = total > 0 ? 100 - pct1 : 50;

    const remainingMs = this.endsAt ? Math.max(0, this.endsAt - Date.now()) : 0;

    return {
      isActive: this.isActive,
      roundId: this.roundId,
      mode: this.mode,
      content: this.content,
      durationMs: this.durationMs,
      remainingMs,
      endsAt: this.endsAt,
      votes: { count1, count2, total, pct1, pct2 },
    };
  }
}

module.exports = VoteEngine;
