const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDb() {
  const query = `
    CREATE TABLE IF NOT EXISTS ranking_jogo_numeros (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(100) NOT NULL,
      level INT NOT NULL,
      attempts INT NOT NULL,
      secret_number INT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS active_games (
      game_id VARCHAR(100) PRIMARY KEY,
      player_name VARCHAR(100) NOT NULL,
      level INT NOT NULL,
      min_val INT NOT NULL,
      max_val INT NOT NULL,
      secret_number INT NOT NULL,
      attempts INT DEFAULT 0,
      history JSONB DEFAULT '[]'::jsonb,
      finished BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  try {
    await pool.query(query);
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

module.exports = {
  pool,
  initDb
};
