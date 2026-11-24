const gameState = {
  gameId: null,
  playerName: localStorage.getItem('player_name') || '',
  selectedLevel: 1,
  attempts: 0,
  min: 1,
  max: 10,
  history: [],
  isWon: false
};

const mascotStates = {
  start: {
    img: 'assets/kuromi-1.jpg',
    speech: 'Escolha um nível e tente descobrir qual número eu escolhi.'
  },
  thinking: {
    img: 'assets/kuromi-2.jpg',
    speech: 'Em qual número você está pensando? Digite seu palpite.'
  },
  higher: {
    img: 'assets/kuromi-3.jpg',
    speech: 'O número correto é MAIOR do que o seu palpite. Tente um valor mais alto.'
  },
  lower: {
    img: 'assets/kuromi-3.jpg',
    speech: 'O número correto é MENOR do que o seu palpite. Tente um valor mais baixo.'
  },
  win: {
    img: 'assets/kuromi-1.jpg',
    speech: 'Você acertou! Sua pontuação foi salva no placar de recordes.'
  }
};

const mascotImg = document.getElementById('mascot-img');
const speechText = document.getElementById('speech-text');

const setupPanel = document.getElementById('setup-panel');
const playPanel = document.getElementById('play-panel');
const playerNameInput = document.getElementById('player-name');
const levelBtns = document.querySelectorAll('.level-btn');
const btnStart = document.getElementById('btn-start');

const currentPlayerDisplay = document.getElementById('current-player');
const currentLevelBadge = document.getElementById('current-level-badge');
const attemptCountDisplay = document.getElementById('attempt-count');
const rangeMinDisplay = document.getElementById('range-min');
const rangeMaxDisplay = document.getElementById('range-max');

const guessForm = document.getElementById('guess-form');
const guessInput = document.getElementById('guess-input');
const btnGuess = document.getElementById('btn-guess');
const feedbackBox = document.getElementById('feedback-box');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackText = document.getElementById('feedback-text');

const historyList = document.getElementById('history-list');
const historyCount = document.getElementById('history-count');
const victoryActions = document.getElementById('victory-actions');
const btnNextLevel = document.getElementById('btn-next-level');
const btnRestart = document.getElementById('btn-restart');
const btnGiveUp = document.getElementById('btn-give-up');

const rankTabs = document.querySelectorAll('.tab-item');
const rankingBody = document.getElementById('ranking-body');
const btnRefreshRanking = document.getElementById('btn-refresh-ranking');
let currentRankFilter = 'all';

const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playTone(freq, type = 'sine', duration = 0.15) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
  }
}

function playWinSound() {
  if (!audioCtx) return;
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 'triangle', 0.25), idx * 100);
  });
}

function setMascotState(stateKey, customSpeech = null) {
  const state = mascotStates[stateKey] || mascotStates.start;
  if (mascotImg) mascotImg.src = state.img;
  if (speechText) speechText.textContent = customSpeech || state.speech;
}

async function requestApi(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    throw new Error(`Servidor retornou resposta inesperada (${res.status}): ${text.substring(0, 80)}`);
  }
  if (!res.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  if (gameState.playerName) {
    playerNameInput.value = gameState.playerName;
  }
  
  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      levelBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      gameState.selectedLevel = parseInt(btn.dataset.level, 10);
    });
  });

  btnStart.addEventListener('click', startGame);
  guessForm.addEventListener('submit', handleGuess);
  btnNextLevel.addEventListener('click', handleNextLevel);
  btnRestart.addEventListener('click', () => startLevel(gameState.selectedLevel));
  btnGiveUp.addEventListener('click', exitToSetup);

  rankTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      rankTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentRankFilter = tab.dataset.filter;
      loadRanking();
    });
  });

  btnRefreshRanking.addEventListener('click', () => {
    btnRefreshRanking.classList.add('spinning');
    loadRanking().finally(() => {
      setTimeout(() => btnRefreshRanking.classList.remove('spinning'), 500);
    });
  });

  loadRanking();
});

async function startGame() {
  const name = playerNameInput.value.trim() || 'Jogador';
  gameState.playerName = name;
  localStorage.setItem('player_name', name);

  await startLevel(gameState.selectedLevel);
}

async function startLevel(level) {
  try {
    btnStart.disabled = true;
    const data = await requestApi('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: gameState.playerName,
        level: level
      })
    });

    gameState.gameId = data.gameId;
    gameState.selectedLevel = data.level;
    gameState.min = data.min;
    gameState.max = data.max;
    gameState.attempts = 0;
    gameState.history = [];
    gameState.isWon = false;

    currentPlayerDisplay.textContent = gameState.playerName;
    currentLevelBadge.textContent = `Nível ${data.level}`;
    attemptCountDisplay.textContent = '0';
    rangeMinDisplay.textContent = data.min;
    rangeMaxDisplay.textContent = data.max;

    guessInput.min = data.min;
    guessInput.max = data.max;
    guessInput.value = '';
    guessInput.disabled = false;
    btnGuess.disabled = false;

    feedbackBox.className = 'feedback-box hidden';
    victoryActions.classList.add('hidden');
    renderHistory();

    setMascotState('thinking', `Número sorteado entre ${data.min} e ${data.max}. Qual é o seu palpite?`);

    setupPanel.classList.add('hidden');
    playPanel.classList.remove('hidden');

    guessInput.focus();
  } catch (err) {
    alert('Não foi possível iniciar a partida: ' + err.message);
  } finally {
    btnStart.disabled = false;
  }
}

async function handleGuess(e) {
  e.preventDefault();
  const guess = parseInt(guessInput.value, 10);
  if (isNaN(guess)) return;

  if (guess < gameState.min || guess > gameState.max) {
    showFeedback('warning', `Digite um número entre ${gameState.min} e ${gameState.max}.`, '⚠️');
    return;
  }

  btnGuess.disabled = true;

  try {
    const data = await requestApi('/api/game/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: gameState.gameId,
        guess: guess
      })
    });

    gameState.attempts = data.attempts;
    attemptCountDisplay.textContent = data.attempts;
    gameState.history = data.history || [];

    renderHistory();

    if (data.status === 'higher') {
      playTone(587.33, 'sine', 0.16);
      showFeedback('higher', `O número secreto é MAIOR que ${guess}.`, '📈');
      setMascotState('higher');
    } else if (data.status === 'lower') {
      playTone(293.66, 'sine', 0.16);
      showFeedback('lower', `O número secreto é MENOR que ${guess}.`, '📉');
      setMascotState('lower');
    } else if (data.status === 'correct') {
      handleVictory(data);
    }

    guessInput.value = '';
    if (!gameState.isWon) {
      guessInput.focus();
    }
  } catch (err) {
    showFeedback('warning', err.message, '⚠️');
  } finally {
    if (!gameState.isWon) {
      btnGuess.disabled = false;
    }
  }
}

function handleVictory(data) {
  gameState.isWon = true;
  guessInput.disabled = true;
  btnGuess.disabled = true;

  playWinSound();
  launchConfetti();

  let victoryMsg = `Você acertou o número ${data.secretNumber} em ${data.attempts} ${data.attempts === 1 ? 'tentativa' : 'tentativas'}!`;
  if (data.rankPosition) {
    victoryMsg += ` Posição no placar: #${data.rankPosition}.`;
  }
  showFeedback('correct', victoryMsg, '🏆');
  setMascotState('win');

  if (gameState.selectedLevel < 3) {
    btnNextLevel.classList.remove('hidden');
    btnNextLevel.querySelector('span').textContent = `Ir para Nível ${gameState.selectedLevel + 1}`;
  } else {
    btnNextLevel.classList.add('hidden');
  }

  victoryActions.classList.remove('hidden');
  loadRanking();
}

function handleNextLevel() {
  if (gameState.selectedLevel < 3) {
    startLevel(gameState.selectedLevel + 1);
  }
}

function exitToSetup() {
  playPanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  setMascotState('start');
  levelBtns.forEach(b => {
    const isActive = parseInt(b.dataset.level, 10) === gameState.selectedLevel;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
}

function renderHistory() {
  historyCount.textContent = `${gameState.history.length} ${gameState.history.length === 1 ? 'palpite' : 'palpites'}`;
  
  if (gameState.history.length === 0) {
    historyList.innerHTML = '<span class="empty-history">Nenhum palpite enviado ainda.</span>';
    return;
  }

  historyList.innerHTML = gameState.history.map(item => {
    let label = 'Igual';
    if (item.status === 'higher') label = 'Maior';
    else if (item.status === 'lower') label = 'Menor';
    else if (item.status === 'correct') label = 'Acerto';

    return `
      <div class="history-pill ${item.status}">
        <span>${item.guess}</span>
        <small>(${label})</small>
      </div>
    `;
  }).join('');
}

function showFeedback(type, text, icon = '💡') {
  feedbackBox.className = `feedback-box ${type}`;
  feedbackIcon.textContent = icon;
  feedbackText.textContent = text;
}

async function loadRanking() {
  try {
    let url = '/api/ranking';
    if (currentRankFilter !== 'all') {
      url += `?level=${currentRankFilter}`;
    }

    const data = await requestApi(url);
    renderRankingTable(data.ranking);
  } catch (err) {
    rankingBody.innerHTML = `
      <tr>
        <td colspan="4" class="table-status">
          Não foi possível carregar a classificação.
        </td>
      </tr>
    `;
  }
}

function renderRankingTable(items) {
  if (!items || items.length === 0) {
    rankingBody.innerHTML = `
      <tr>
        <td colspan="4" class="table-status">
          Nenhum registro encontrado para este nível.
        </td>
      </tr>
    `;
    return;
  }

  rankingBody.innerHTML = items.map((item, index) => {
    const pos = index + 1;
    const initial = (item.player_name || 'J').charAt(0).toUpperCase();

    return `
      <tr>
        <td class="rank-pos">${pos}º</td>
        <td>
          <div class="player-info">
            <span class="player-badge" aria-hidden="true">${initial}</span>
            <span>${escapeHtml(item.player_name)}</span>
          </div>
        </td>
        <td>
          <span class="level-tag-sm">Nível ${item.level}</span>
        </td>
        <td>
          <span class="attempts-value">${item.attempts}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const palette = ['#ff4d8d', '#ff659f', '#c084fc', '#fbcfe8', '#ffffff'];

  for (let i = 0; i < 70; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 14,
      size: Math.random() * 8 + 4,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  }

  let animationFrame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.32;
      p.alpha -= 0.014;
      p.rotation += p.rotSpeed;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) {
      animationFrame = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  update();
}
