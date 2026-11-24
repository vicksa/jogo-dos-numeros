const { pool, initDb } = require('../../db');

let dbReady = false;
async function ensureDb() {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    await ensureDb();

    const { gameId, guess } = req.body || {};
    if (!gameId) {
      return res.status(400).json({ error: 'Sessão de jogo inválida.' });
    }

    const selectQuery = `
      SELECT game_id, player_name, level, min_val, max_val, secret_number, attempts, history, finished
      FROM active_games
      WHERE game_id = $1;
    `;
    const gameResult = await pool.query(selectQuery, [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Partida não encontrada ou expirada.' });
    }

    const game = gameResult.rows[0];
    if (game.finished) {
      return res.status(400).json({ error: 'Esta partida já foi finalizada.' });
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
      hint = `Parabéns, ${game.player_name}! Você acertou o número secreto (${game.secret_number}) em ${newAttempts} ${newAttempts === 1 ? 'tentativa' : 'tentativas'}!`;
      history.push({ guess: guessNum, status, hint });

      await pool.query(
        `UPDATE active_games SET attempts = $1, history = $2, finished = true WHERE game_id = $3;`,
        [newAttempts, JSON.stringify(history), gameId]
      );

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

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        status: 'correct',
        message: hint,
        attempts: newAttempts,
        secretNumber: game.secret_number,
        history,
        rankPosition
      });
    } else if (guessNum < game.secret_number) {
      status = 'higher';
      hint = `O número secreto é MAIOR que ${guessNum}. Tente novamente!`;
    } else {
      status = 'lower';
      hint = `O número secreto é MENOR que ${guessNum}. Tente novamente!`;
    }

    history.push({ guess: guessNum, status, hint });

    await pool.query(
      `UPDATE active_games SET attempts = $1, history = $2 WHERE game_id = $3;`,
      [newAttempts, JSON.stringify(history), gameId]
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      status,
      message: hint,
      attempts: newAttempts,
      history
    });
  } catch (err) {
    console.error('Guess processing error:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Erro interno ao processar o palpite.' });
  }
};
