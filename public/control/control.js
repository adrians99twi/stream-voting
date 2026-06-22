// control.js
const socket = io();

let currentMode = 'hot';
let uploadedImageUrl = null;
let currentLiveState = null;

// Pool-Verwaltung: welche IDs wurden in dieser Session bereits gespielt?
// Wird beim Abbrechen einer Runde NICHT geleert — erst wenn explizit "Neue Runde"
// gestartet wird und alle Fragen durch sind, oder beim Seite-neu-laden.
const playedIds = { hot: new Set(), flag: new Set(), either: new Set() };

const MODE_LABELS = {
  hot: 'Hot for no reason',
  flag: 'Red / Green Flag',
  either: 'Entweder Oder',
};

const DEFAULT_LABELS = {
  hot: { label1: 'Ja', label2: 'Nein' },
  flag: { label1: 'Green Flag', label2: 'Red Flag' },
  either: { label1: 'Option A', label2: 'Option B' },
};

// ---------- DOM Referenzen ----------
const modeButtons = document.querySelectorAll('.mode-btn');
const eitherLabelsBlock = document.getElementById('either-labels');
const libraryModeLabel = document.getElementById('library-mode-label');
const libraryList = document.getElementById('library-list');
const randomBtn = document.getElementById('random-btn');
const importFileInput = document.getElementById('import-file');
const clearBtn = document.getElementById('clear-btn');
const poolStatus = document.getElementById('pool-status');

const fieldText = document.getElementById('field-text');
const fieldImage = document.getElementById('field-image');
const imagePreview = document.getElementById('image-preview');
const fieldLabel1 = document.getElementById('field-label1');
const fieldLabel2 = document.getElementById('field-label2');
const fieldDuration = document.getElementById('field-duration');

const roundForm = document.getElementById('round-form');
const startNowBtn = document.getElementById('start-now-btn');

const noRoundEl = document.getElementById('no-round');
const liveRoundEl = document.getElementById('live-round');
const liveModeLabel = document.getElementById('live-mode-label');
const liveText = document.getElementById('live-text');
const liveImage = document.getElementById('live-image');
const liveLabel1 = document.getElementById('live-label-1');
const liveLabel2 = document.getElementById('live-label-2');
const liveBar1 = document.getElementById('live-bar-1');
const liveBar2 = document.getElementById('live-bar-2');
const livePct1 = document.getElementById('live-pct-1');
const livePct2 = document.getElementById('live-pct-2');
const liveTimerText = document.getElementById('live-timer-text');
const liveTotalVotes = document.getElementById('live-total-votes');
const extendBtn = document.getElementById('extend-btn');
const cancelBtn = document.getElementById('cancel-btn');

const chatFeed = document.getElementById('chat-feed');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const channelInput = document.getElementById('channel-input');
const connectBtn = document.getElementById('connect-btn');

const overlayUrlEl = document.getElementById('overlay-url');
const copyOverlayBtn = document.getElementById('copy-overlay-url');

// ---------- Overlay URL anzeigen ----------
const overlayFullUrl = window.location.origin + '/overlay/';
overlayUrlEl.textContent = overlayFullUrl;
copyOverlayBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(overlayFullUrl);
  copyOverlayBtn.textContent = 'Kopiert!';
  setTimeout(() => (copyOverlayBtn.textContent = 'Link kopieren'), 1500);
});

// ---------- Modus-Wechsel ----------
modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    modeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    libraryModeLabel.textContent = MODE_LABELS[currentMode];
    eitherLabelsBlock.classList.toggle('hidden', currentMode !== 'either');
    loadLibrary();
  });
});

// ---------- Bild-Upload ----------
fieldImage.addEventListener('change', async () => {
  const file = fieldImage.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    uploadedImageUrl = data.url;
    imagePreview.src = data.url;
    imagePreview.classList.remove('hidden');
  } catch (e) {
    alert('Bild-Upload fehlgeschlagen: ' + e.message);
  }
});

function resetForm() {
  fieldText.value = '';
  fieldImage.value = '';
  imagePreview.classList.add('hidden');
  imagePreview.src = '';
  uploadedImageUrl = null;
  fieldLabel1.value = '';
  fieldLabel2.value = '';
  fieldDuration.value = 60;
}

function buildContentFromForm() {
  const content = {
    text: fieldText.value.trim(),
    imageUrl: uploadedImageUrl,
  };
  if (currentMode === 'either') {
    content.label1 = fieldLabel1.value.trim() || DEFAULT_LABELS.either.label1;
    content.label2 = fieldLabel2.value.trim() || DEFAULT_LABELS.either.label2;
  }
  return content;
}

// ---------- Bibliothek speichern ----------
roundForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = buildContentFromForm();
  if (!content.text && !content.imageUrl) {
    alert('Bitte Text oder Bild angeben.');
    return;
  }
  await fetch('/api/rounds/' + currentMode, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, durationSeconds: Number(fieldDuration.value) || 60 }),
  });
  resetForm();
  loadLibrary();
});

// ---------- Sofort starten ----------
startNowBtn.addEventListener('click', () => {
  const content = buildContentFromForm();
  if (!content.text && !content.imageUrl) {
    alert('Bitte Text oder Bild angeben.');
    return;
  }
  startRound(currentMode, content, Number(fieldDuration.value) || 60);
});

function startRound(mode, content, durationSeconds) {
  socket.emit('round:start', { mode, content, durationSeconds });
}

// ---------- Bibliothek laden ----------
async function loadLibrary() {
  const res = await fetch('/api/rounds/' + currentMode);
  const rounds = await res.json();
  updatePoolStatus(rounds);
  libraryList.innerHTML = '';
  if (!rounds.length) {
    libraryList.innerHTML = '<div class="empty-hint">Noch keine Runden gespeichert. Importiere eine JSON-Datei oder füge einzelne Runden oben hinzu.</div>';
    return;
  }
  rounds.slice().reverse().forEach((round) => {
    const item = document.createElement('div');
    const played = playedIds[currentMode].has(round.id);
    item.className = 'library-item' + (played ? ' played' : '');

    const textSpan = document.createElement('div');
    textSpan.className = 'library-item-text';
    textSpan.textContent = (played ? '✓ ' : '') + (round.content.text || '(nur Bild)');

    const actions = document.createElement('div');
    actions.className = 'library-item-actions';

    const startBtn = document.createElement('button');
    startBtn.className = 'btn-primary';
    startBtn.textContent = 'Starten';
    startBtn.addEventListener('click', () => {
      playedIds[currentMode].add(round.id);
      startRound(currentMode, round.content, round.durationSeconds || 60);
      loadLibrary();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-secondary';
    deleteBtn.textContent = '🗑';
    deleteBtn.addEventListener('click', async () => {
      await fetch('/api/rounds/' + currentMode + '/' + round.id, { method: 'DELETE' });
      playedIds[currentMode].delete(round.id);
      loadLibrary();
    });

    actions.appendChild(startBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(textSpan);
    item.appendChild(actions);
    libraryList.appendChild(item);
  });
}

function updatePoolStatus(rounds) {
  if (!rounds || rounds.length === 0) {
    poolStatus.textContent = '';
    return;
  }
  const played = playedIds[currentMode].size;
  const remaining = rounds.length - played;
  if (remaining === 0) {
    poolStatus.textContent = `Alle ${rounds.length} Fragen gespielt — Pool wird beim nächsten Zufallsstart zurückgesetzt.`;
  } else {
    poolStatus.textContent = `${remaining} von ${rounds.length} Fragen noch nicht gespielt`;
  }
}

// ---------- Zufällig starten ----------
randomBtn.addEventListener('click', async () => {
  const res = await fetch('/api/rounds/' + currentMode);
  const rounds = await res.json();
  if (!rounds.length) {
    alert('Keine Fragen in der Bibliothek. Importiere zuerst eine JSON-Datei.');
    return;
  }

  // Ungespielt bevorzugen
  let unplayed = rounds.filter((r) => !playedIds[currentMode].has(r.id));

  // Alle gespielt? Pool zurücksetzen
  if (unplayed.length === 0) {
    playedIds[currentMode].clear();
    unplayed = rounds;
  }

  const pick = unplayed[Math.floor(Math.random() * unplayed.length)];
  playedIds[currentMode].add(pick.id);
  startRound(currentMode, pick.content, pick.durationSeconds || 60);
  loadLibrary();
});

// ---------- JSON Import ----------
importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files[0];
  if (!file) return;

  let entries;
  try {
    const text = await file.text();
    entries = JSON.parse(text);
  } catch (e) {
    alert('Fehler beim Lesen der Datei. Ist es eine gültige JSON-Datei?');
    importFileInput.value = '';
    return;
  }

  if (!Array.isArray(entries)) {
    alert('Die JSON-Datei muss ein Array sein (mit eckigen Klammern anfangen).');
    importFileInput.value = '';
    return;
  }

  const res = await fetch('/api/rounds/' + currentMode + '/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  const result = await res.json();
  alert(`✅ ${result.imported} Fragen importiert! Gesamt im Pool: ${result.total}`);
  importFileInput.value = '';
  loadLibrary();
});

// ---------- Alle löschen ----------
clearBtn.addEventListener('click', async () => {
  const rounds = await (await fetch('/api/rounds/' + currentMode)).json();
  if (!rounds.length) return;
  if (!confirm(`Alle ${rounds.length} Fragen aus "${MODE_LABELS[currentMode]}" löschen?`)) return;
  for (const r of rounds) {
    await fetch('/api/rounds/' + currentMode + '/' + r.id, { method: 'DELETE' });
  }
  playedIds[currentMode].clear();
  loadLibrary();
});

// ---------- Live Kontrolle ----------
extendBtn.addEventListener('click', () => socket.emit('round:extend', 10));
cancelBtn.addEventListener('click', () => socket.emit('round:cancel'));

function renderLiveState(state) {
  currentLiveState = state;
  if (!state || !state.roundId) {
    noRoundEl.classList.remove('hidden');
    liveRoundEl.classList.add('hidden');
    return;
  }
  noRoundEl.classList.add('hidden');
  liveRoundEl.classList.remove('hidden');

  const defaults = DEFAULT_LABELS[state.mode] || DEFAULT_LABELS.hot;
  const l1 = (state.content && state.content.label1) || defaults.label1;
  const l2 = (state.content && state.content.label2) || defaults.label2;

  liveModeLabel.textContent = MODE_LABELS[state.mode] || state.mode;
  liveText.textContent = (state.content && state.content.text) || '';
  if (state.content && state.content.imageUrl) {
    liveImage.src = state.content.imageUrl;
    liveImage.classList.remove('hidden');
  } else {
    liveImage.classList.add('hidden');
  }

  liveLabel1.textContent = l1;
  liveLabel2.textContent = l2;
  liveBar1.style.width = state.votes.pct1 + '%';
  liveBar2.style.width = state.votes.pct2 + '%';
  livePct1.textContent = state.votes.pct1 + '%';
  livePct2.textContent = state.votes.pct2 + '%';
  liveTotalVotes.textContent = state.votes.total + (state.votes.total === 1 ? ' Stimme' : ' Stimmen');

  const secondsLeft = Math.ceil((state.remainingMs || 0) / 1000);
  liveTimerText.textContent = state.isActive ? secondsLeft + 's verbleibend' : 'Runde beendet';

  extendBtn.disabled = !state.isActive;
  cancelBtn.disabled = !state.isActive;
}

socket.on('round:started', renderLiveState);
socket.on('tick', renderLiveState);
socket.on('round:ended', renderLiveState);
socket.on('round:cancelled', () => renderLiveState(null));

// ---------- Twitch Verbindung ----------
connectBtn.addEventListener('click', async () => {
  const channel = channelInput.value.trim();
  if (!channel) return;
  await fetch('/api/twitch/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
});

socket.on('twitch:status', (status) => {
  if (status.connected) {
    statusDot.classList.add('connected');
    statusText.textContent = 'Verbunden: ' + status.channel;
  } else {
    statusDot.classList.remove('connected');
    statusText.textContent = status.error ? 'Fehler: getrennt' : 'Nicht verbunden';
  }
  if (status.channel && !channelInput.value) {
    channelInput.value = status.channel;
  }
});

// ---------- Chat Feed ----------
function addChatLine({ username, message, counted }) {
  const empty = chatFeed.querySelector('.empty-hint');
  if (empty) empty.remove();

  const line = document.createElement('div');
  line.className = 'chat-line' + (counted ? ' counted' : '');

  const userSpan = document.createElement('span');
  userSpan.className = 'chat-user';
  userSpan.textContent = username + ':';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'chat-msg';
  msgSpan.textContent = message;

  line.appendChild(userSpan);
  line.appendChild(msgSpan);
  chatFeed.prepend(line);

  // Nur die letzten 50 Zeilen behalten
  while (chatFeed.children.length > 50) {
    chatFeed.removeChild(chatFeed.lastChild);
  }
}

socket.on('chat:message', addChatLine);
socket.on('chat:history', (messages) => {
  messages.slice().reverse().forEach(addChatLine);
});

// ---------- Initiales Laden ----------
loadLibrary();
