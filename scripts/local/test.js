// Corre los tests del backend (npm test en backend/) contra la base de test LOCAL.
// Uso: npm run test:backend   (solo modo local; contra Neon no se corren tests de integración)
const { BACKEND, abortar, leerEnv, asegurarEnv, guardaBase, correr } = require('./comun');

const PG_VACIAS = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGOPTIONS', 'PGSERVICE'];

async function main() {
  if (process.argv.includes('--neon')) {
    abortar('test:backend no corre contra Neon: los tests de integración escriben datos y Hallados-dev es compartida.');
  }
  const archivo = asegurarEnv();
  const env = leerEnv(archivo);
  await guardaBase(env.DATABASE_URL, { nombre: 'DATABASE_URL' });
  const hayTest = Boolean((env.TEST_DATABASE_URL || '').trim());
  const host = hayTest ? await guardaBase(env.TEST_DATABASE_URL, { nombre: 'TEST_DATABASE_URL' }) : '';
  if (!hayTest) console.log('Aviso: TEST_DATABASE_URL está vacía; corren solo los tests unitarios y la integración queda salteada.');

  const pg = Object.fromEntries(PG_VACIAS.map((k) => [k, '']));
  const childEnv = {
    ...process.env, ...pg, ...env,
    TEST_DATABASE_URL: hayTest ? env.TEST_DATABASE_URL : '',
    TEST_DB_ALLOWED_HOST_PREFIX: hayTest ? (env.TEST_DB_ALLOWED_HOST_PREFIX || host) : '',
  };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const code = await correr(npm, ['test'], { cwd: BACKEND, env: childEnv });
  process.exit(code);
}

main().catch((e) => abortar(e.message));
