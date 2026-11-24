const { pool, initDb } = require('../db');

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    await ensureDb();

    const level = req.query && req.query.level ? parseInt(req.query.level, 10) : null;
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
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ranking: result.rows });
  } catch (err) {
    console.error('Ranking query error:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: 'Erro ao consultar o ranking.' });
  }
};
