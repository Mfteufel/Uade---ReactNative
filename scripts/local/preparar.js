// Prepara la base local: migra (001-009...) y siembra seed.js + seed_demo.js; migra también la base de test si TEST_DATABASE_URL está definida.
// Uso: npm run db:preparar   (solo modo local; contra Neon no se siembra nunca)
const path = require('path');
const { BACKEND, abortar, leerEnv, asegurarEnv, guardaBase, correr } = require('./comun');

// Variables de libpq que pg lee solas. Se dejan definidas vacías para que un backend/.env
// (p. ej. con PGSSLMODE de Neon) no las meta en la conexión local.
const PG_VACIAS = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGOPTIONS', 'PGSERVICE'];

// Entorno del hijo: lo del archivo (claves vacías incluidas) encima del entorno del proceso.
// Así una variable ya definida gana sobre backend/.env y dotenv (config.js/db.js) no pisa nada.
function entorno(archivo, extra = {}) {
  const pg = Object.fromEntries(PG_VACIAS.map((k) => [k, '']));
  return { ...process.env, ...pg, ...leerEnv(archivo), ...extra };
}

async function main() {
  if (process.argv.includes('--neon')) {
    abortar('db:preparar no corre contra Neon: Hallados-dev ya tiene las migraciones y sembrar borraría datos del equipo. Para migrar usá npm run db:migrar-neon.');
  }
  const archivo = asegurarEnv();
  const env = leerEnv(archivo);
  const host = await guardaBase(env.DATABASE_URL, { nombre: 'DATABASE_URL' });
  const hayTest = Boolean((env.TEST_DATABASE_URL || '').trim());
  if (hayTest) await guardaBase(env.TEST_DATABASE_URL, { nombre: 'TEST_DATABASE_URL' });

  const node = process.execPath;
  const paso = async (titulo, script, extra) => {
    console.log(`\n== ${titulo} ==`);
    const code = await correr(node, [path.join('scripts', script)], { cwd: BACKEND, env: entorno(archivo, extra) });
    if (code !== 0) abortar(`falló ${script} (código ${code}).`);
  };

  await paso('Migraciones', 'migrate.js');
  await paso('Seed', 'seed.js');
  await paso('Seed demo', 'seed_demo.js', { SEED_DEMO_ALLOWED_HOST_PREFIX: host });
  if (hayTest) await paso('Migraciones (base de test)', 'migrate.js', { DATABASE_URL: env.TEST_DATABASE_URL });
  else console.log('\nAviso: TEST_DATABASE_URL está vacía; se saltea la base de test (los tests de integración quedan salteados).');
  console.log('\nBase lista.');
}

main().catch((e) => abortar(e.message));
