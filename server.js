const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Gerenciamento de sessões de jogos ativas em memória
// { gameId: { playerName, level, min, max, secretNumber, attempts, startTime, finished } }
const activeGames = new Map();

// Helper para obter os limites por nível
function getLevelConfig(level) {
  const lvl = parseInt(level, 10);
  switch (lvl) {
    case 1:
      return { level: 1, min: 1, max: 10, label: 'Nível 1 (1 a 10)' };
    case 2:
      return { level: 2, min: 1, max: 100, label: 'Nível 2 (1 a 100)' };
    case 3:
      return { level: 3, min: 1, max: 1000, label: 'Nível 3 (1 a 1000)' };
    default:
      return { level: 1, min: 1, max: 10, label: 'Nível 1 (1 a 10)' };
  }
}

// Iniciar um novo jogo
app.post('/api/game/start', (req, res) => {
  try {
    const { playerName, level } = req.body;
    const name = (playerName && playerName.trim()) ? playerName.trim().substring(0, 50) : 'Jogador Anônimo';
    const config = getLevelConfig(level);

    // Gerar número aleatório inclusivo entre min e max
    const secretNumber = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
    const gameId = crypto.randomUUID();

    activeGames.set(gameId, {
      playerName: name,
      level: config.level,
      min: config.min,
      max: config.max,
      secretNumber,
      attempts: 0,
      history: [],
      startTime: Date.now(),
      finished: false
    });

    res.json({
      success: true,
      gameId,
      playerName: name,
      level: config.level,
      min: config.min,
      max: config.max,
      label: config.label,
      attempts: 0
    });
  } catch (err) {
    console.error('Erro ao iniciar jogo:', err);
    res.status(500).json({ error: 'Erro ao iniciar o jogo.' });
  }
});

// Enviar um palpite
app.post('/api/game/guess', async (req, res) => {
  try {
    const { gameId, guess } = req.body;
    if (!gameId || !activeGames.has(gameId)) {
      return res.status(404).json({ error: 'Sessão de jogo não encontrada ou expirada. Inicie um novo jogo.' });
    }

    const game = activeGames.get(gameId);
    if (game.finished) {
      return res.status(400).json({ error: 'Este jogo já foi finalizado. Inicie uma nova partida.' });
    }

    const guessNum = parseInt(guess, 10);
    if (isNaN(guessNum)) {
      return res.status(400).json({ error: 'Por favor, digite um número válido.' });
    }

    if (guessNum < game.min || guessNum > game.max) {
      return res.status(400).json({
        error: `O número digitado (${guessNum}) está fora do intervalo válido de ${game.min} a ${game.max}.`
      });
    }

    game.attempts += 1;

    let status = '';
    let hint = '';

    if (guessNum === game.secretNumber) {
      status = 'correct';
      hint = `🎉 Parabéns, ${game.playerName}! Você acertou o número secreto (${game.secretNumber}) em ${game.attempts} ${game.attempts === 1 ? 'tentativa' : 'tentativas'}!`;
      game.finished = true;

      // Gravar no Neon Postgres
      try {
        const insertQuery = `
          INSERT INTO ranking_jogo_numeros (player_name, level, attempts, secret_number)
          VALUES ($1, $2, $3, $4)
          RETURNING id, player_name, level, attempts, created_at;
        `;
        const dbResult = await pool.query(insertQuery, [
          game.playerName,
          game.level,
          game.attempts,
          game.secretNumber
        ]);
        
        // Posição no ranking deste nível
        const rankPosQuery = `
          SELECT COUNT(*) as rank
          FROM ranking_jogo_numeros
          WHERE level = $1 AND (attempts < $2 OR (attempts = $2 AND created_at <= $3));
        `;
        const rankRes = await pool.query(rankPosQuery, [
          game.level,
          game.attempts,
          dbResult.rows[0].created_at
        ]);

        const rankPosition = parseInt(rankRes.rows[0].rank, 10);

        game.history.push({ guess: guessNum, status, hint });

        return res.json({
          status: 'correct',
          message: hint,
          attempts: game.attempts,
          secretNumber: game.secretNumber,
          history: game.history,
          rankPosition,
          savedToNeon: true
        });
      } catch (dbErr) {
        console.error('Erro ao salvar no banco Neon:', dbErr);
        game.history.push({ guess: guessNum, status, hint });
        return res.json({
          status: 'correct',
          message: hint,
          attempts: game.attempts,
          secretNumber: game.secretNumber,
          history: game.history,
          savedToNeon: false,
          dbError: 'Erro ao gravar no banco.'
        });
      }
    } else if (guessNum < game.secretNumber) {
      status = 'higher';
      hint = `📈 O número secreto é MAIOR que ${guessNum}. Tente novamente!`;
    } else {
      status = 'lower';
      hint = `📉 O número secreto é MENOR que ${guessNum}. Tente novamente!`;
    }

    game.history.push({ guess: guessNum, status, hint });

    res.json({
      status,
      message: hint,
      attempts: game.attempts,
      history: game.history
    });
  } catch (err) {
    console.error('Erro ao processar palpite:', err);
    res.status(500).json({ error: 'Erro interno no processamento do palpite.' });
  }
});

// Ranking dos melhores jogadores (menos tentativas)
app.get('/api/ranking', async (req, res) => {
  try {
    const level = req.query.level ? parseInt(req.query.level, 10) : null;
    let query = '';
    let params = [];

    if (level && [1, 2, 3].includes(level)) {
      query = `
        SELECT id, player_name, level, attempts, secret_number, created_at
        FROM ranking_jogo_numeros
        WHERE level = $1
        ORDER BY attempts ASC, created_at ASC
        LIMIT 20;
      `;
      params = [level];
    } else {
      query = `
        SELECT id, player_name, level, attempts, secret_number, created_at
        FROM ranking_jogo_numeros
        ORDER BY attempts ASC, created_at ASC
        LIMIT 25;
      `;
    }

    const result = await pool.query(query, params);

    // Estatísticas adicionais (melhor jogador por nível)
    const bestByLevelQuery = `
      SELECT DISTINCT ON (level) level, player_name, attempts, created_at
      FROM ranking_jogo_numeros
      ORDER BY level ASC, attempts ASC, created_at ASC;
    `;
    const bestRes = await pool.query(bestByLevelQuery);

    res.json({
      ranking: result.rows,
      bestByLevel: bestRes.rows
    });
  } catch (err) {
    console.error('Erro ao consultar ranking no Neon:', err);
    res.status(500).json({ error: 'Erro ao consultar o ranking no banco Neon.' });
  }
});

// Iniciar servidor após verificar o banco de dados
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando com sucesso em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Falha ao iniciar servidor:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
