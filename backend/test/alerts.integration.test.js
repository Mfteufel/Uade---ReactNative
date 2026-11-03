// Prueba de integración de alertas y seguidas contra un Postgres REAL de pruebas.
//
// Por seguridad NO corre salvo que se indiquen DOS variables (ver backend/README.md, "Test de integración"):
//   TEST_DATABASE_URL           cadena de conexión de una base de PRUEBAS con las migraciones aplicadas
//   TEST_DB_ALLOWED_HOST_PREFIX inicio del host de esa base (mismo criterio que scripts/seed_demo.js)
// Si falta alguna, o el host no empieza con el prefijo, todo queda salteado y nunca se abre una conexión.
// Jamás usa DATABASE_URL de backend/.env (apunta a producción): la pisa con TEST_DATABASE_URL antes de cargar db.js.
//
// Todos los datos llevan un prefijo único por corrida (u_itest_<run>_...) y se borran al terminar.
process.env.JWT_SECRET ||= 'x'.repeat(48);
process.env.PUBLIC_URL ||= 'http://test.local:3000';
const crypto = require('node:crypto');
const { describe, test, before, beforeEach, after } = require('node:test');
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

describe('alertas y seguidas contra Postgres', { skip: SKIP }, () => {
  let pool, query, alerts, follows, listMine;

  const run = crypto.randomBytes(4).toString('hex');
  const ids = { me: `u_itest_${run}_me`, other: `u_itest_${run}_ot`, publisher: `u_itest_${run}_pu` };
  const allUsers = Object.values(ids);
  let counter = 0;

  before(async () => {
    if (SKIP) return;
    // Antes de cargar db.js: así nunca se usa la DATABASE_URL de backend/.env.
    process.env.DATABASE_URL = testUrl;
    ({ pool, query } = require('../src/db'));
    alerts = require('../src/services/alerts');
    follows = require('../src/services/follows');
    ({ listMine } = require('../src/services/publishing'));
    const schema = await query(`SELECT to_regclass('public.alerts') AS alerts`);
    if (!schema.rows[0].alerts) {
      throw new Error('La base de pruebas no tiene la tabla alerts: aplicá las migraciones en esa base (backend/README.md).');
    }
    for (const id of allUsers) {
      await query(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', $1)`, [id, `${id}@itest.local`]);
    }
  });

  beforeEach(async () => {
    if (SKIP) return;
    await query('DELETE FROM alerts WHERE user_id = ANY($1)', [allUsers]);
    await query('DELETE FROM follows WHERE user_id = ANY($1)', [allUsers]);
    await query('DELETE FROM publications WHERE user_id = ANY($1)', [allUsers]);
  });

  after(async () => {
    if (SKIP || !pool) return;
    try {
      await query('DELETE FROM users WHERE id = ANY($1)', [allUsers]);
    } finally {
      await pool.end();
    }
  });

  async function newPublication({ type = 'found', category = 'keys', owner = ids.publisher } = {}) {
    counter += 1;
    const id = `p_itest_${run}_${counter}`;
    const found = type === 'found';
    await query(
      `INSERT INTO publications (id, user_id, client_id, type, title, category_id, occurred_on, neighborhood_id,
                                 verification_question, verification_answer)
       VALUES ($1, $2, $3, $4, 'Objeto de prueba', $5, current_date, 'palermo', $6, $7)`,
      [id, owner, crypto.randomUUID(), type, category, found ? '¿De qué color es?' : null, found ? 'rojo' : null]
    );
    return id;
  }

  const body = { tipo: 'found', categoria: 'keys', barrio: 'palermo' };
  const rejectsWith = (status, fn) => assert.rejects(fn, (e) => e.status === status);
  const makeDue = (id) => query(`UPDATE publications SET expires_at = now() - interval '1 hour' WHERE id = $1`, [id]);
  const alertCount = async (userId) => (await alerts.listAlerts(userId)).length;
  const myFollow = async (id) => (await follows.listFollows(ids.me)).find((f) => f.id === id);

  test('guarda la alerta con sus criterios y rechaza la repetida', async () => {
    const alert = await alerts.createAlert(ids.me, { ...body, q: 'osito' });
    assert.equal(alert.tipo, 'found');
    assert.equal(alert.categoria.id, 'keys');
    assert.equal(alert.barrio.id, 'palermo');
    assert.equal(alert.q, 'osito');
    assert.equal(alert.pausada, false);
    assert.equal(alert.cantidadNuevas, 0);
    await rejectsWith(409, () => alerts.createAlert(ids.me, { ...body, q: 'osito' }));
    assert.equal(await alertCount(ids.me), 1);
  });

  test('dos pedidos iguales al mismo tiempo dejan una sola alerta', async () => {
    const results = await Promise.allSettled([alerts.createAlert(ids.me, body), alerts.createAlert(ids.me, body)]);
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.status, 409);
    assert.equal(await alertCount(ids.me), 1);
  });

  test('no deja pasar de 20 alertas', async () => {
    for (let i = 0; i < 20; i += 1) await alerts.createAlert(ids.me, { tipo: 'found', q: `tope ${i}` });
    await rejectsWith(422, () => alerts.createAlert(ids.me, { tipo: 'found', q: 'una de más' }));
    assert.equal(await alertCount(ids.me), 20);
  });

  test('dos pedidos al mismo tiempo no superan el tope', async () => {
    for (let i = 0; i < 19; i += 1) await alerts.createAlert(ids.me, { tipo: 'found', q: `tope ${i}` });
    const results = await Promise.allSettled([
      alerts.createAlert(ids.me, { tipo: 'found', q: 'primera' }),
      alerts.createAlert(ids.me, { tipo: 'found', q: 'segunda' }),
    ]);
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.status, 422);
    assert.equal(await alertCount(ids.me), 20);
  });

  test('valida el id y el valor de pausada', async () => {
    const alert = await alerts.createAlert(ids.me, body);
    await rejectsWith(404, () => alerts.deleteAlert(ids.me, 'no valido'));
    await rejectsWith(404, () => alerts.markAlertSeen(ids.me, 'a_no_existe'));
    await rejectsWith(422, () => alerts.setAlertPaused(ids.me, alert.id, { pausada: 'si' }));
  });

  test('una alerta ajena no se ve ni se toca', async () => {
    const alert = await alerts.createAlert(ids.me, body);
    assert.equal(await alertCount(ids.other), 0);
    await rejectsWith(404, () => alerts.setAlertPaused(ids.other, alert.id, { pausada: true }));
    await rejectsWith(404, () => alerts.markAlertSeen(ids.other, alert.id));
    await rejectsWith(404, () => alerts.deleteAlert(ids.other, alert.id));
    const [mine] = await alerts.listAlerts(ids.me);
    assert.equal(mine.id, alert.id);
    assert.equal(mine.pausada, false);
  });

  test('cuenta solo lo nuevo que coincide, y "vista" lo pone en cero', async () => {
    const alert = await alerts.createAlert(ids.me, body);
    await newPublication();
    await newPublication({ category: 'pets' });
    await newPublication({ type: 'lost' });
    await newPublication({ owner: ids.me });
    assert.equal((await alerts.listAlerts(ids.me))[0].cantidadNuevas, 1);
    await alerts.markAlertSeen(ids.me, alert.id);
    assert.equal((await alerts.listAlerts(ids.me))[0].cantidadNuevas, 0);
  });

  test('pausada no cuenta y al reanudar cuenta lo publicado en la pausa', async () => {
    const alert = await alerts.createAlert(ids.me, body);
    await alerts.setAlertPaused(ids.me, alert.id, { pausada: true });
    await newPublication();
    const [paused] = await alerts.listAlerts(ids.me);
    assert.equal(paused.pausada, true);
    assert.equal(paused.cantidadNuevas, 0);
    await alerts.setAlertPaused(ids.me, alert.id, { pausada: false });
    assert.equal((await alerts.listAlerts(ids.me))[0].cantidadNuevas, 1);
  });

  test('sin tipo guardado se trata como found: el contador coincide con lo que abre la app', async () => {
    await query(`INSERT INTO alerts (id, user_id, keywords) VALUES ($1, $2, 'objeto')`, [`a_itest_${run}`, ids.me]);
    await newPublication();
    await newPublication({ type: 'lost' });
    const [alert] = await alerts.listAlerts(ids.me);
    assert.equal(alert.tipo, 'found');
    assert.equal(alert.cantidadNuevas, 1);
  });

  test('cada persona ve solo sus seguidas', async () => {
    const pub = await newPublication();
    await follows.followPublication(ids.me, pub);
    assert.equal((await follows.listFollows(ids.me)).length, 1);
    assert.equal((await follows.listFollows(ids.other)).length, 0);
    await rejectsWith(404, () => follows.markFollowSeen(ids.other, pub));
  });

  test('un cambio de estado es novedad, va primera y se apaga al verla', async () => {
    const calm = await newPublication();
    const changed = await newPublication();
    await follows.followPublication(ids.me, changed);
    await follows.followPublication(ids.me, calm);
    assert.equal((await myFollow(changed)).tieneNovedad, false);

    await query(`UPDATE publications SET status = 'in_claim', status_changed_at = now() WHERE id = $1`, [changed]);
    const list = await follows.listFollows(ids.me);
    assert.equal(list[0].id, changed);
    assert.equal(list[0].tieneNovedad, true);
    assert.equal(list[1].tieneNovedad, false);

    await follows.markFollowSeen(ids.me, changed);
    assert.equal((await myFollow(changed)).tieneNovedad, false);
  });

  test('si venció después de verla es novedad, aunque nadie haya actualizado el estado', async () => {
    const pub = await newPublication();
    await follows.followPublication(ids.me, pub);
    await query(`UPDATE follows SET seen_at = now() - interval '2 hours' WHERE publication_id = $1`, [pub]);
    await query(`UPDATE publications SET status_changed_at = now() - interval '3 hours' WHERE id = $1`, [pub]);
    await makeDue(pub);
    const follow = await myFollow(pub);
    assert.equal(follow.status, 'expired');
    assert.equal(follow.tieneNovedad, true);
  });

  test('si ya la vio vencida, el barrido de "Mis publicaciones" no inventa una novedad', async () => {
    const pub = await newPublication();
    await makeDue(pub);
    await follows.followPublication(ids.me, pub);
    assert.equal((await myFollow(pub)).tieneNovedad, false);
    await listMine(ids.publisher);
    const follow = await myFollow(pub);
    assert.equal(follow.status, 'expired');
    assert.equal(follow.tieneNovedad, false);
  });

  test('una en reclamo pasada de fecha no figura vencida', async () => {
    const pub = await newPublication();
    await follows.followPublication(ids.me, pub);
    await query(`UPDATE publications SET status = 'in_claim' WHERE id = $1`, [pub]);
    await makeDue(pub);
    const follow = await myFollow(pub);
    assert.equal(follow.status, 'in_claim');
    assert.equal(follow.tieneNovedad, false);
  });
});
