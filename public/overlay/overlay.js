// overlay.js
const socket = io();

const idleEl = document.getElementById('idle');
const cardEl = document.getElementById('card');
const eyebrowEl = document.getElementById('eyebrow');
const textEl = document.getElementById('content-text');
const imageEl = document.getElementById('content-image');
const label1El = document.getElementById('label-1');
const label2El = document.getElementById('label-2');
const bar1El = document.getElementById('bar-1');
const bar2El = document.getElementById('bar-2');
const pct1El = document.getElementById('pct-1');
const pct2El = document.getElementById('pct-2');
const voteCountEl = document.getElementById('vote-count');
const resultBannerEl = document.getElementById('result-banner');
const timerNumberEl = document.getElementById('timer-number');
const timerRingFg = document.getElementById('timer-ring-fg');
const timerWrapEl = document.querySelector('.timer-wrap');

const RING_CIRCUMFERENCE = 283; // 2 * PI * r(45), gerundet

const MODE_META = {
  hot: { eyebrow: 'HOT FOR NO REASON', label1: 'Ja', label2: 'Nein', cls: 'mode-hot' },
  flag: { eyebrow: 'RED OR GREEN FLAG', label1: 'Green Flag', label2: 'Red Flag', cls: 'mode-flag' },
  either: { eyebrow: 'ENTWEDER ODER', label1: 'Option A', label2: 'Option B', cls: 'mode-either' },
};

function applyMode(mode, content) {
  const meta = MODE_META[mode] || MODE_META.hot;
  cardEl.classList.remove('mode-hot', 'mode-flag', 'mode-either');
  cardEl.classList.add(meta.cls);
  eyebrowEl.textContent = meta.eyebrow;
  label1El.textContent = (content && content.label1) || meta.label1;
  label2El.textContent = (content && content.label2) || meta.label2;
}

function renderContent(content) {
  textEl.textContent = (content && content.text) || '';
  const newUrl = (content && content.imageUrl) || '';
  if (newUrl) {
    // src nur neu setzen wenn sich die URL geaendert hat — verhindert Neu-Laden bei jedem Tick
    if (imageEl.src !== newUrl) imageEl.src = newUrl;
    imageEl.classList.remove('hidden');
  } else {
    imageEl.classList.add('hidden');
    imageEl.src = '';
  }
}

function renderVotes(votes) {
  bar1El.style.width = votes.pct1 + '%';
  bar2El.style.width = votes.pct2 + '%';
  pct1El.textContent = votes.pct1 + '%';
  pct2El.textContent = votes.pct2 + '%';
  voteCountEl.textContent = votes.total + (votes.total === 1 ? ' Stimme' : ' Stimmen');
}

function renderTimer(remainingMs, durationMs) {
  const seconds = Math.ceil(remainingMs / 1000);
  timerNumberEl.textContent = seconds;
  const fraction = durationMs > 0 ? remainingMs / durationMs : 0;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  timerRingFg.style.strokeDashoffset = offset;

  if (seconds <= 10) {
    timerWrapEl.classList.add('urgent');
  } else {
    timerWrapEl.classList.remove('urgent');
  }
}

function showResultBanner(votes) {
  let text = '';
  let cls = 'winner-tie';
  if (votes.count1 > votes.count2) {
    text = (label1El.textContent || 'Option 1') + ' gewinnt!';
    cls = 'winner-1';
  } else if (votes.count2 > votes.count1) {
    text = (label2El.textContent || 'Option 2') + ' gewinnt!';
    cls = 'winner-2';
  } else {
    text = 'Unentschieden!';
  }
  resultBannerEl.textContent = text;
  resultBannerEl.classList.remove('winner-1', 'winner-2', 'winner-tie', 'hidden');
  resultBannerEl.classList.add(cls);
}

function hideResultBanner() {
  resultBannerEl.classList.add('hidden');
}

function showCard() {
  idleEl.classList.add('hidden');
  cardEl.classList.remove('hidden');
}

function showIdle() {
  cardEl.classList.add('hidden');
  idleEl.classList.remove('hidden');
}

socket.on('round:started', (state) => {
  hideResultBanner();
  applyMode(state.mode, state.content);
  renderContent(state.content);
  renderVotes(state.votes);
  renderTimer(state.remainingMs, state.durationMs);
  showCard();
});

socket.on('tick', (state) => {
  renderVotes(state.votes);
  renderTimer(state.remainingMs, state.durationMs);
});

socket.on('round:ended', (state) => {
  renderVotes(state.votes);
  renderTimer(0, state.durationMs);
  showResultBanner(state.votes);
});

socket.on('round:cancelled', () => {
  showIdle();
});

// Beim (Neu-)Laden der Seite: aktuellen Stand holen, falls bereits eine Runde laeuft
socket.on('connect', () => {
  // Der Server schickt nach Verbindung automatisch den aktuellen Stand (siehe index.js)
});
