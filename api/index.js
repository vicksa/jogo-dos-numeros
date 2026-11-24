const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { pool, initDb } = require('../db');

const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos para desenvolvimento local
app.use(express.static(path.join(__dirname, '..', 'public')));

// Garantir inicialização do banco Neon em ambiente Serverless
let dbReady = false;
async function ensureDb() {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
}

app.use(async (req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('Erro de conexão ao banco Neon:', err);
    res.status(500).json({ error: 'Erro de conexão com o banco de dados Neon.' });
  }
});

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

// Iniciar um novo jogo (persistido no Neon)
app.post('/api/game/start', async (req, res) => {
  try {
    const { playerName, level } = req.body;
    const name = (playerName && playerName.trim()) ? playerName.trim().substring(0, 50) : 'Fã da Kuromi';
    const config = getLevelConfig(level);

    const secretNumber = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
    const gameId = crypto.randomUUID();

    const insertQuery = `
      INSERT INTO active_games (game_id, player_name, level, min_val, max_val, secret_number, attempts, history, finished)
      VALUES ($1, $2, $3, $4, $5, $6, 0, '[]'::jsonb, false)
      RETURNING game_id, player_name, level, min_val, max_val;
    `;
    await pool.query(insertQuery, [
      gameId,
      name,
      config.level,
      config.min,
      config.max,
      secretNumber
    ]);

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

// Enviar um palpite (validado via Neon)
app.post('/api/game/guess', async (req, res) => {
  try {
    const { gameId, guess } = req.body;
    if (!gameId) {
      return res.status(400).json({ error: 'ID da sessão de jogo não fornecido.' });
    }

    const selectQuery = `
      SELECT game_id, player_name, level, min_val, max_val, secret_number, attempts, history, finished
      FROM active_games
      WHERE game_id = $1;
    `;
    const gameResult = await pool.query(selectQuery, [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Partida não encontrada ou expirada. Inicie um novo jogo!' });
    }

    const game = gameResult.rows[0];
    if (game.finished) {
      return res.status(400).json({ error: 'Esta partida já foi encerrada. Inicie um novo jogo!' });
    }

    const guessNum = parseInt(guess, 10);
    if (isNaN(guessNum)) {
      return res.status(400).json({ error: 'Por favor, digite um número válido.' });
    }

    if (guessNum < game.min_val || guessNum > game.max_val) {
      return res.status(400).json({
        error: `O número ${guessNum} está fora do intervalo de ${game.min_val} a ${game.max_val}.`
      });
    }

    const newAttempts = game.attempts + 1;
    let history = Array.isArray(game.history) ? game.history : [];
    let status = '';
    let hint = '';

    if (guessNum === game.secret_number) {
      status = 'correct';
      hint = `🎉 Parabéns, ${game.player_name}! Você acertou o número secreto (${game.secret_number}) em ${newAttempts} ${newAttempts === 1 ? 'tentativa' : 'tentativas'}!`;
      history.push({ guess: guessNum, status, hint });

      // Atualizar active_games para finalizado
      await pool.query(
        `UPDATE active_games SET attempts = $1, history = $2, finished = true WHERE game_id = $3;`,
        [newAttempts, JSON.stringify(history), gameId]
      );

      // Inserir no ranking de recordes
      const insertRankQuery = `
        INSERT INTO ranking_jogo_numeros (player_name, level, attempts, secret_number)
        VALUES ($1, $2, $3, $4)
        RETURNING id, player_name, level, attempts, created_at;
      `;
      const rankDbRes = await pool.query(insertRankQuery, [
        game.player_name,
        game.level,
        newAttempts,
        game.secret_number
      ]);

      // Calcular posição no ranking
      const rankPosQuery = `
        SELECT COUNT(*) as rank
        FROM ranking_jogo_numeros
        WHERE level = $1 AND (attempts < $2 OR (attempts = $2 AND created_at <= $3));
      `;
      const rankPosRes = await pool.query(rankPosQuery, [
        game.level,
        newAttempts,
        rankDbRes.rows[0].created_at
      ]);
      const rankPosition = parseInt(rankPosRes.rows[0].rank, 10);

      return res.json({
        status: 'correct',
        message: hint,
        attempts: newAttempts,
        secretNumber: game.secret_number,
        history,
        rankPosition,
        savedToNeon: true
      });
    } else if (guessNum < game.secret_number) {
      status = 'higher';
      hint = `📈 O número secreto é MAIOR que ${guessNum}. Tente novamente!`;
    } else {
      status = 'lower';
      hint = `📉 O número secreto é MENOR que ${guessNum}. Tente novamente!`;
    }

    history.push({ guess: guessNum, status, hint });

    await pool.query(
      `UPDATE active_games SET attempts = $1, history = $2 WHERE game_id = $3;`,
      [newAttempts, JSON.stringify(history), gameId]
    );

    res.json({
      status,
      message: hint,
      attempts: newAttempts,
      history
    });
  } catch (err) {
    console.error('Erro ao processar palpite:', err);
    res.status(500).json({ error: 'Erro interno ao processar o palpite.' });
  }
});

// Ranking dos melhores jogadores
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
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Erro ao consultar ranking no Neon:', err);
    res.status(500).json({ error: 'Erro ao consultar o ranking no banco Neon.' });
  }
});

module.exports = app;
