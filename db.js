const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
  `;
  try {
    await pool.query(query);
    console.log('✅ Tabela ranking_jogo_numeros verificada/criada com sucesso no Neon!');
  } catch (err) {
    console.error('❌ Erro ao inicializar tabela no Neon:', err);
    throw err;
  }
}

module.exports = {
  pool,
  initDb
};
