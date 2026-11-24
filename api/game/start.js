const crypto = require('crypto');
const { pool, initDb } = require('../../db');

let dbReady = false;
async function ensureDb() {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }
}

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

    const { playerName, level } = req.body || {};
    const name = (playerName && playerName.trim()) ? playerName.trim().substring(0, 50) : 'Jogador';
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

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
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
    console.error('Game start error:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Erro ao iniciar o jogo no banco de dados.' });
  }
};
