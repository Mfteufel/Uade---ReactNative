const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

const DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      // Las migraciones traen su propio BEGIN/COMMIT; si no, lo agregamos acá.
      const hasTx = /^\s*(--[^\n]*\n\s*)*BEGIN\s*;/i.test(sql);
      if (!hasTx) await client.query('BEGIN');
      await client.query(sql);
      if (!hasTx) await client.query('COMMIT');
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw new Error(`Falló ${file}: ${err.message}`);
    }
    client.release();
    console.log(`Aplicada: ${file}`);
    applied++;
  }
  if (!applied) console.log('No hay migraciones nuevas.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
