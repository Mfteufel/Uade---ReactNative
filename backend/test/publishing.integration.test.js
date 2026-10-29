// Prueba de integración de estados de publicaciones (vencer y renovar) contra un Postgres REAL de pruebas.
//
// Por seguridad NO corre salvo que se indiquen DOS variables (ver backend/README.md, "Test de integración"):
//   TEST_DATABASE_URL           cadena de conexión de una base de PRUEBAS con las migraciones 001 a 008 aplicadas
//   TEST_DB_ALLOWED_HOST_PREFIX inicio del host de esa base (mismo criterio que scripts/seed_demo.js)
// Si falta alguna, o el host no empieza con el prefijo, todo queda salteado y nunca se abre una conexión.
// Jamás usa DATABASE_URL de backend/.env (apunta a producción): la pisa con TEST_DATABASE_URL antes de cargar db.js.
//
// Todos los datos llevan un prefijo único por corrida (u_itest_<run>_...) y se borran al terminar.
process.env.JWT_SECRET ||= 'x'.repeat(48);
process.env.PUBLIC_URL ||= 'http://test.local:3000';
const crypto = require('node:crypto');
const http = require('node:http');
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const testUrl = process.env.TEST_DATABASE_URL;
const allowedPrefix = process.env.TEST_DB_ALLOWED_HOST_PREFIX;

function skipReason() {
  if (!testUrl) return 'Falta TEST_DATABASE_URL: prueba de integración salteada (ver backend/README.md).';
  if (!allowedPrefix) return 'Falta TEST_DB_ALLOWED_HOST_PREFIX: prueba de integración salteada.';
  let host;
  try {
    host = new URL(testUrl).hostname;
  } catch {
    return 'TEST_DATABASE_URL no es una URL válida: prueba de integración salteada.';
  }
  if (!host.startsWith(allowedPrefix)) return 'El host de TEST_DATABASE_URL no coincide con TEST_DB_ALLOWED_HOST_PREFIX: prueba salteada.';
  return false;
}

const SKIP = skipReason();
const ANSWER = 'rojo';

describe('vencer y renovar publicaciones contra Postgres', { skip: SKIP }, () => {
  let pool, query, listMine, renewPublication, createClaim, acceptClaim;

  const run = crypto.randomBytes(4).toString('hex');
  const ids = { pub: `u_itest_${run}_pub`, claimer: `u_itest_${run}_cl` };
  const allUsers = Object.values(ids);
  let counter = 0;

  before(async () => {
    if (SKIP) return;
    // Antes de cargar db.js: así nunca se usa la DATABASE_URL de backend/.env.
    process.env.DATABASE_URL = testUrl;
    ({ pool, query } = require('../src/db'));
    ({ listMine, renewPublication } = require('../src/services/publishing'));
    ({ createClaim, acceptClaim } = require('../src/services/claims'));
    const schema = await query(`SELECT to_regclass('public.claims') AS claims`);
    if (!schema.rows[0].claims) {
      throw new Error('La base de pruebas no tiene la tabla claims: aplicá las migraciones en esa base (backend/README.md).');
    }
    for (const id of allUsers) {
      await query(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', $1)`, [id, `${id}@itest.local`]);
    }
  });

  after(async () => {
    if (SKIP || !pool) return;
    try {
      await query('DELETE FROM claims WHERE claimer_id = ANY($1) OR publisher_id = ANY($1)', [allUsers]);
      await query('DELETE FROM users WHERE id = ANY($1)', [allUsers]);
    } finally {
      await pool.end();
    }
  });

  async function newFound() {
    counter += 1;
    const id = `p_itest_${run}_${counter}`;
    await query(
      `INSERT INTO publications (id, user_id, client_id, type, title, category_id, occurred_on, neighborhood_id,
                                 verification_question, verification_answer)
       VALUES ($1, $2, $3, 'found', 'Objeto de prueba', 'keys', current_date, 'palermo', '¿De qué color es?', 'rojo')`,
      [id, ids.pub, crypto.randomUUID()]
    );
    return id;
  }

  const statusOf = async (id) => (await query('SELECT status FROM publications WHERE id = $1', [id])).rows[0].status;
  const makeDue = (id) => query(`UPDATE publications SET expires_at = now() - interval '1 hour' WHERE id = $1`, [id]);

  async function withAcceptedClaim() {
    const pub = await newFound();
    const claim = await createClaim(ids.claimer, pub, { verificationAnswer: 'rojo' });
    await acceptClaim(ids.pub, claim.id);
    assert.equal(await statusOf(pub), 'in_claim');
    return pub;
  }

  test('el barrido vence una publicación open pasada de fecha', async () => {
    const pub = await newFound();
    await makeDue(pub);
    await listMine(ids.pub);
    assert.equal(await statusOf(pub), 'expired');
  });

  test('el barrido no vence una publicación in_claim', async () => {
    const pub = await withAcceptedClaim();
    await makeDue(pub);
    await listMine(ids.pub);
    assert.equal(await statusOf(pub), 'in_claim');
  });

  test('renovar una expired con reclamo aceptado la deja in_claim', async () => {
    const pub = await withAcceptedClaim();
    // Dato viejo: de cuando el barrido también vencía las in_claim.
    await query(`UPDATE publications SET status = 'expired', expires_at = now() - interval '1 hour' WHERE id = $1`, [pub]);
    const view = await renewPublication(ids.pub, pub);
    assert.equal(view.status, 'in_claim');
    assert.equal(await statusOf(pub), 'in_claim');
  });

  test('renovar una expired sin reclamo la deja open', async () => {
    const pub = await newFound();
    await makeDue(pub);
    const view = await renewPublication(ids.pub, pub);
    assert.equal(view.status, 'open');
    assert.equal(await statusOf(pub), 'open');
  });
});
