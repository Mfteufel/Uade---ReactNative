// Aplica SOLO las migraciones pendientes (backend/scripts/migrate.js, nunca seed) a Hallados-dev.
// Usa backend/.env.demo.neon.local. Bloquea producción, lista las pendientes (solo lectura) y pide
// escribir el hostname completo antes de aplicar. Uso: npm run db:migrar-neon
const fs = require('fs');
const path = require('path');
const { BACKEND, HOST_PRODUCCION, abortar, leerEnv, asegurarEnv, preguntar, correr } = require('./comun');

const PG_VACIAS = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGOPTIONS', 'PGSERVICE'];

async function main() {
  const archivo = asegurarEnv({ neon: true });
  const env = leerEnv(archivo);
  if (!env.DATABASE_URL) abortar('falta DATABASE_URL en el archivo de entorno.');
  let host;
  try {
    host = new URL(env.DATABASE_URL).hostname.toLowerCase();
  } catch {
    abortar('DATABASE_URL no es una URL válida.');
  }
  if (host.includes(HOST_PRODUCCION)) abortar(`DATABASE_URL apunta a producción (${HOST_PRODUCCION}); no se toca.`);
  if (!process.stdin.isTTY) abortar('la migración pide confirmación y la terminal no es interactiva.');

  const { Client } = require(path.join(BACKEND, 'node_modules', 'pg'));
  const archivos = fs.readdirSync(path.join(BACKEND, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  let hechas;
  try {
    await client.connect();
    // Solo lectura: si la tabla no existe, todas están pendientes.
    const ex = await client.query("SELECT to_regclass('public.schema_migrations') AS t");
    hechas = new Set(ex.rows[0].t ? (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name) : []);
  } finally {
    await client.end().catch(() => {});
  }
  const pendientes = archivos.filter((f) => !hechas.has(f));

  console.log(`Base de destino: ${host}`);
  if (!pendientes.length) {
    console.log('No hay migraciones pendientes.');
    return;
  }
  console.log('Migraciones pendientes:');
  pendientes.forEach((f) => console.log(`  - ${f}`));
  const r = await preguntar('Para aplicarlas escribí el hostname completo: ');
  if (r.toLowerCase() !== host) abortar('el hostname no coincide; no se aplicó nada.');

  const pg = Object.fromEntries(PG_VACIAS.map((k) => [k, '']));
  const code = await correr(process.execPath, [path.join('scripts', 'migrate.js')], { cwd: BACKEND, env: { ...process.env, ...pg, ...env } });
  if (code !== 0) abortar(`falló migrate.js (código ${code}).`);
}

main().catch((e) => abortar(e.message));
