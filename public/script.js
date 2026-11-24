// Estado global da aplicação
let gameState = {
  gameId: null,
  playerName: localStorage.getItem('player_name') || '',
  selectedLevel: 1,
  attempts: 0,
  min: 1,
  max: 10,
  history: [],
  isWon: false
};

// Elementos do DOM
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

const rankTabs = document.querySelectorAll('.rank-tab');
const rankingBody = document.getElementById('ranking-body');
const btnRefreshRanking = document.getElementById('btn-refresh-ranking');
let currentRankFilter = 'all';

// Áudio sintético via Web Audio API (sem dependências externas)
const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playTone(freq, type = 'sine', duration = 0.15) {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // áudio silencioso se bloqueado
  }
}

function playWinSound() {
  if (!audioCtx) return;
  const notes = [440, 554.37, 659.25, 880];
  notes.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 'triangle', 0.3), idx * 120);
  });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  if (gameState.playerName) {
    playerNameInput.value = gameState.playerName;
  }
  
  // Seleção de nível no setup
  levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      levelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameState.selectedLevel = parseInt(btn.dataset.level, 10);
    });
  });

  // Botão Começar Jogo
  btnStart.addEventListener('click', startGame);

  // Formulário de palpite
  guessForm.addEventListener('submit', handleGuess);

  // Ações de pós-jogo
  btnNextLevel.addEventListener('click', handleNextLevel);
  btnRestart.addEventListener('click', () => startLevel(gameState.selectedLevel));
  btnGiveUp.addEventListener('click', exitToSetup);

  // Tabs do ranking
  rankTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      rankTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
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

  // Carrega ranking inicial
  loadRanking();
});

// Iniciar Partida
async function startGame() {
  const name = playerNameInput.value.trim() || 'Jogador Anônimo';
  gameState.playerName = name;
  localStorage.setItem('player_name', name);

  await startLevel(gameState.selectedLevel);
}

async function startLevel(level) {
  try {
    btnStart.disabled = true;
    const res = await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName: gameState.playerName,
        level: level
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao iniciar');

    gameState.gameId = data.gameId;
    gameState.selectedLevel = data.level;
    gameState.min = data.min;
    gameState.max = data.max;
    gameState.attempts = 0;
    gameState.history = [];
    gameState.isWon = false;

    // Atualizar UI
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

    setupPanel.classList.add('hidden');
    playPanel.classList.remove('hidden');

    guessInput.focus();
  } catch (err) {
    alert('Não foi possível iniciar o jogo: ' + err.message);
  } finally {
    btnStart.disabled = false;
  }
}

// Enviar Palpite
async function handleGuess(e) {
  e.preventDefault();
  const guess = parseInt(guessInput.value, 10);
  if (isNaN(guess)) return;

  if (guess < gameState.min || guess > gameState.max) {
    showFeedback('warning', `⚠️ Digite um número válido entre ${gameState.min} e ${gameState.max}!`);
    return;
  }

  btnGuess.disabled = true;

  try {
    const res = await fetch('/api/game/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: gameState.gameId,
        guess: guess
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no palpite');

    gameState.attempts = data.attempts;
    attemptCountDisplay.textContent = data.attempts;
    gameState.history = data.history || [];

    renderHistory();

    if (data.status === 'higher') {
      playTone(550, 'sine', 0.15); // Tom agudo para indicar "mais alto"
      showFeedback('higher', data.message, '📈');
    } else if (data.status === 'lower') {
      playTone(280, 'sine', 0.15); // Tom grave para indicar "mais baixo"
      showFeedback('lower', data.message, '📉');
    } else if (data.status === 'correct') {
      handleVictory(data);
    }

    guessInput.value = '';
    if (!gameState.isWon) {
      guessInput.focus();
    }
  } catch (err) {
    showFeedback('warning', 'Erro: ' + err.message);
  } finally {
    if (!gameState.isWon) {
      btnGuess.disabled = false;
    }
  }
}

// Lidar com Vitória
function handleVictory(data) {
  gameState.isWon = true;
  guessInput.disabled = true;
  btnGuess.disabled = true;

  playWinSound();
  launchConfetti();

  let victoryMsg = data.message;
  if (data.rankPosition) {
    victoryMsg += ` 🏆 Você está na posição #${data.rankPosition} do ranking do Neon!`;
  }
  showFeedback('correct', victoryMsg, '🎉');

  // Ajustar botão de próximo nível
  if (gameState.selectedLevel < 3) {
    btnNextLevel.classList.remove('hidden');
    btnNextLevel.querySelector('span').textContent = `Ir para Nível ${gameState.selectedLevel + 1}`;
  } else {
    btnNextLevel.classList.add('hidden');
  }

  victoryActions.classList.remove('hidden');

  // Recarregar ranking para mostrar o novo recorde
  loadRanking();
}

// Avançar para próximo nível
function handleNextLevel() {
  if (gameState.selectedLevel < 3) {
    startLevel(gameState.selectedLevel + 1);
  }
}

// Voltar para configuração
function exitToSetup() {
  playPanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  // Atualiza botões de nível com base no atual
  levelBtns.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.level, 10) === gameState.selectedLevel);
  });
}

// Renderizar Histórico
function renderHistory() {
  historyCount.textContent = `${gameState.history.length} ${gameState.history.length === 1 ? 'palpite' : 'palpites'}`;
  
  if (gameState.history.length === 0) {
    historyList.innerHTML = '<div class="empty-history">Nenhum palpite enviado ainda.</div>';
    return;
  }

  historyList.innerHTML = gameState.history.map(item => {
    let icon = '•';
    if (item.status === 'higher') icon = '📈 Maior';
    else if (item.status === 'lower') icon = '📉 Menor';
    else if (item.status === 'correct') icon = '🎯 Acertou!';

    return `
      <div class="history-pill ${item.status}">
        <span>${item.guess}</span>
        <small>(${icon})</small>
      </div>
    `;
  }).join('');
}

// Exibir Feedback
function showFeedback(type, text, icon = '💡') {
  feedbackBox.className = `feedback-box ${type}`;
  feedbackIcon.textContent = icon;
  feedbackText.textContent = text;
}

// Carregar Ranking do Neon
async function loadRanking() {
  try {
    let url = '/api/ranking';
    if (currentRankFilter !== 'all') {
      url += `?level=${currentRankFilter}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderRankingTable(data.ranking);
  } catch (err) {
    rankingBody.innerHTML = `
      <tr>
        <td colspan="4" class="ranking-loading" style="color: var(--neon-rose);">
          Falha ao carregar ranking do Neon: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderRankingTable(items) {
  if (!items || items.length === 0) {
    rankingBody.innerHTML = `
      <tr>
        <td colspan="4" class="ranking-loading">
          Nenhum registro ainda. Seja o primeiro a acertar e entrar para o Hall da Fama!
        </td>
      </tr>
    `;
    return;
  }

  rankingBody.innerHTML = items.map((item, index) => {
    const pos = index + 1;
    let posBadge = `${pos}º`;
    let posClass = 'rank-pos';
    if (pos === 1) { posBadge = '🥇 1º'; posClass += ' pos-1'; }
    else if (pos === 2) { posBadge = '🥈 2º'; posClass += ' pos-2'; }
    else if (pos === 3) { posBadge = '🥉 3º'; posClass += ' pos-3'; }

    const avatarLetter = (item.player_name || 'A').charAt(0).toUpperCase();

    return `
      <tr>
        <td class="${posClass}">${posBadge}</td>
        <td>
          <div class="player-col">
            <span class="player-avatar">${avatarLetter}</span>
            <span>${escapeHtml(item.player_name)}</span>
          </div>
        </td>
        <td>
          <span class="level-chip lvl-${item.level}">Nível ${item.level}</span>
        </td>
        <td>
          <span class="attempts-badge">${item.attempts} ${item.attempts === 1 ? 'tentativa' : 'tentativas'}</span>
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

// Confetti Particle System
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#00e599', '#00d2ff', '#a855f7', '#ffd700', '#f43f5e'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    });
  }

  let animationFrame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravidade
      p.alpha -= 0.012;
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
