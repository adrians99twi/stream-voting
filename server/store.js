// store.js
// Sehr einfache Datenspeicherung in einer JSON-Datei auf der Festplatte.
// Speichert deine vorbereiteten Runden (Texte/Bilder) pro Spielmodus.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'rounds.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ hot: [], flag: [], either: [] }, null, 2));
  }
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { hot: [], flag: [], either: [] };
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function addRound(mode, round) {
  const data = readAll();
  if (!data[mode]) data[mode] = [];
  data[mode].push(round);
  writeAll(data);
  return data[mode];
}

function deleteRound(mode, id) {
  const data = readAll();
  if (!data[mode]) return [];
  data[mode] = data[mode].filter((r) => r.id !== id);
  writeAll(data);
  return data[mode];
}

function getRounds(mode) {
  const data = readAll();
  return data[mode] || [];
}

// Importiert ein Array von Fragen auf einmal (fuegt zum bestehenden Pool hinzu).
function importRounds(mode, entries) {
  const data = readAll();
  if (!data[mode]) data[mode] = [];
  const newRounds = entries.map((entry) => ({
    id: require('crypto').randomUUID(),
    createdAt: Date.now(),
    content: {
      text: entry.text || '',
      imageUrl: entry.imageUrl || null,
      label1: entry.label1 || null,
      label2: entry.label2 || null,
    },
    durationSeconds: entry.durationSeconds || 60,
  }));
  data[mode].push(...newRounds);
  writeAll(data);
  return data[mode];
}

module.exports = { readAll, writeAll, addRound, deleteRound, getRounds, importRounds };
