const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const net = require('net');
const { Pool } = require('pg');

// Node prueba las direcciones de la base una por una y da por perdido cada intento a los 250 ms.
// Con la latencia hacia Neon (São Paulo) y picos de Wi-Fi eso falla a ratos con ETIMEDOUT: damos 2 s por intento.
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

const CONNECT_TIMEOUT_MS = 8000; // si la base no contesta, fallamos rápido (503) en vez de colgar el pedido
const SLOW_MS = 2000;

// La cadena de Neon ya trae sslmode=require, no hace falta configurar ssl aparte.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  keepAlive: true,
});

// Sin este handler, un error en una conexión inactiva (Neon las cierra) tumba el proceso.
pool.on('error', (e) => console.error('[db] error en una conexión inactiva:', e.code || e.message));

// Aviso de operaciones lentas: solo el comienzo del SQL y el tiempo, nunca los parámetros.
const warnIfSlow = (what, start, text) => {
  const ms = Date.now() - start;
  if (ms >= SLOW_MS) console.warn(`[db] ${what} lenta (${ms} ms)${text ? `: ${text.slice(0, 60)}` : ''}`);
};

async function query(text, params) {
  const start = Date.now();
  try {
    return await pool.query(text, params);
  } finally {
    warnIfSlow('consulta', start, text);
  }
}

async function withTransaction(fn) {
  const start = Date.now();
  const client = await pool.connect();
  warnIfSlow('conexión', start);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
