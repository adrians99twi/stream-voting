// index.js - Hauptserver
const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const VoteEngine = require('./voteEngine');
const { createTwitchListener } = require('./twitchChat');
const store = require('./store');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Statische Dateien ausliefern (Steuerung + Overlay)
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Bild-Uploads fuer Runden-Inhalte
const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, uuidv4() + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei erhalten' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// ---- Runden-Bibliothek (vorbereitete Inhalte) ----
app.get('/api/rounds/:mode', (req, res) => {
  res.json(store.getRounds(req.params.mode));
});

app.post('/api/rounds/:mode', (req, res) => {
  const round = { id: uuidv4(), createdAt: Date.now(), ...req.body };
  const all = store.addRound(req.params.mode, round);
  res.json(all);
});

app.delete('/api/rounds/:mode/:id', (req, res) => {
  const all = store.deleteRound(req.params.mode, req.params.id);
  res.json(all);
});

// Importiert eine JSON-Datei mit vielen Fragen auf einmal
app.post('/api/rounds/:mode/import', (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries muss ein nicht-leeres Array sein' });
  }
  const all = store.importRounds(req.params.mode, entries);
  res.json({ imported: entries.length, total: all.length });
});

// ---- Voting Engine ----
const voteEngine = new VoteEngine();

voteEngine.on('round:started', (state) => io.emit('round:started', state));
voteEngine.on('tick', (state) => io.emit('tick', state));
voteEngine.on('vote:registered', (state) => io.emit('tick', state));
voteEngine.on('round:ended', (state) => io.emit('round:ended', state));
voteEngine.on('round:cancelled', (info) => io.emit('round:cancelled', info));

// ---- Twitch Chat ----
let twitchStatus = { connected: false, channel: null, error: null };
let lastMessages = []; // kleiner Live-Feed fuer die Steuerungsseite, letzte 30 Nachrichten

const twitch = createTwitchListener({
  channel: null,
  onMessage: ({ username, message }) => {
    const counted = voteEngine.registerVote(username, message);
    lastMessages.unshift({ username, message, counted, ts: Date.now() });
    lastMessages = lastMessages.slice(0, 30);
    io.emit('chat:message', { username, message, counted });
  },
  onStatusChange: (status) => {
    twitchStatus = status;
    io.emit('twitch:status', status);
  },
});

app.post('/api/twitch/connect', (req, res) => {
  const { channel } = req.body;
  if (!channel || !channel.trim()) {
    return res.status(400).json({ error: 'Kanalname fehlt' });
  }
  twitch.connect(channel);
  res.json({ ok: true });
});

app.get('/api/twitch/status', (req, res) => {
  res.json(twitchStatus);
});

// ---- Socket.io Verbindung ----
io.on('connection', (socket) => {
  // Neuen Client sofort auf aktuellen Stand bringen
  socket.emit('twitch:status', twitchStatus);
  socket.emit('chat:history', lastMessages);
  const state = voteEngine.getPublicState();
  if (state.roundId) {
    socket.emit(state.isActive ? 'round:started' : 'round:ended', state);
  }

  socket.on('round:start', (payload) => {
    try {
      voteEngine.startRound({
        roundId: uuidv4(),
        mode: payload.mode,
        content: payload.content,
        durationSeconds: payload.durationSeconds || 60,
      });
    } catch (e) {
      socket.emit('error:message', 'Runde konnte nicht gestartet werden: ' + e.message);
    }
  });

  socket.on('round:cancel', () => {
    voteEngine.cancelRound();
  });

  socket.on('round:extend', (extraSeconds) => {
    voteEngine.extendRound(extraSeconds || 10);
  });
});

server.listen(PORT, () => {
  console.log('Server laeuft auf Port ' + PORT);
});
