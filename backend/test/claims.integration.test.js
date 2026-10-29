// Prueba de integración de reclamos y fotos contra un Postgres REAL de pruebas.
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

describe('reclamos y fotos contra Postgres', { skip: SKIP }, () => {
  let pool, query, savePhoto, saveClaimPhoto, deleteOrphanClaimPhotos;
  let createClaim, acceptClaim, rejectClaim, getClaim, expireDueClaims;
  let photosRouter, errorHandler, signAccessToken, express, sharp;

  const run = crypto.randomBytes(4).toString('hex');
  const ids = { pub: `u_itest_${run}_pub`, a: `u_itest_${run}_a`, b: `u_itest_${run}_b`, c: `u_itest_${run}_c` };
  const allUsers = Object.values(ids);
  let jpeg;
  let counter = 0;

  before(async () => {
    if (SKIP) return;
    // Antes de cargar db.js: así nunca se usa la DATABASE_URL de backend/.env.
    process.env.DATABASE_URL = testUrl;
    ({ pool, query } = require('../src/db'));
    ({ savePhoto, saveClaimPhoto, deleteOrphanClaimPhotos } = require('../src/services/photos'));
    ({ createClaim, acceptClaim, rejectClaim, getClaim, expireDueClaims } = require('../src/services/claims'));
    photosRouter = require('../src/routes/photos');
    ({ errorHandler } = require('../src/middleware/errors'));
    ({ signAccessToken } = require('../src/services/tokens'));
    express = require('express');
    sharp = require('sharp');

    const schema = await query(`SELECT to_regclass('public.claims') AS claims`);
    if (!schema.rows[0].claims) {
      throw new Error('La base de pruebas no tiene la tabla claims: aplicá las migraciones 001 a 008 en esa base (backend/README.md).');
    }
    jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c83232' } }).jpeg().toBuffer();
    for (const id of allUsers) {
      await query(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, 'x', $1)`, [id, `${id}@itest.local`]);
    }
  });

  after(async () => {
    if (SKIP || !pool) return;
    try {
      await query('DELETE FROM claims WHERE claimer_id = ANY($1) OR publisher_id = ANY($1)', [allUsers]);
      // Borra también publicaciones y fotos de estos usuarios (ON DELETE CASCADE).
      await query('DELETE FROM users WHERE id = ANY($1)', [allUsers]);
    } finally {
      await pool.end();
    }
  });

  // Cada caso usa su propia publicación del usuario `pub`, así no se pisan entre sí.
  async function newPublication(type) {
    counter += 1;
    const id = `p_itest_${run}_${counter}`;
    const isFound = type === 'found';
    await query(
      `INSERT INTO publications (id, user_id, client_id, type, title, category_id, occurred_on, neighborhood_id,
                                 verification_question, verification_answer)
       VALUES ($1, $2, $3, $4, 'Objeto de prueba', 'keys', current_date, 'palermo', $5, $6)`,
      [id, ids.pub, crypto.randomUUID(), type, isFound ? '¿De qué color es?' : null, isFound ? ANSWER : null]
    );
    return id;
  }

  const claimMine = (userId, publicationId) => createClaim(userId, publicationId, { verificationAnswer: ANSWER });

  async function claimFoundWithPhoto(userId, publicationId) {
    const { photoId } = await saveClaimPhoto(userId, jpeg);
    const claim = await createClaim(userId, publicationId, { photoId, foundNeighborhoodId: 'palermo' });
    return { claim, photoId };
  }

  const photoExists = async (id) => (await query('SELECT 1 FROM photos WHERE id = $1', [id])).rowCount === 1;

  // Revisión, bloqueante 1, caso A: reclamo con foto y después cambio de avatar.
  test('cambiar el avatar después de reclamar con foto no falla ni borra la foto del reclamo', async () => {
    const pub = await newPublication('lost');
    const { photoId } = await claimFoundWithPhoto(ids.a, pub);
    await savePhoto(ids.a, jpeg);
    await savePhoto(ids.a, jpeg); // y se puede volver a cambiar
    assert.ok(await photoExists(photoId));
  });

  // Revisión, bloqueante 1, caso B: subir la foto del reclamo, cambiar el avatar y recién después enviar el reclamo.
  test('subir la foto del reclamo, cambiar el avatar y enviar el reclamo funciona', async () => {
    const pub = await newPublication('lost');
    const { photoId } = await saveClaimPhoto(ids.b, jpeg);
    await savePhoto(ids.b, jpeg);
    const claim = await createClaim(ids.b, pub, { photoId, foundNeighborhoodId: 'palermo' });
    assert.equal(claim.status, 'pending');
  });

  // Revisión, importante 4.
  test('aceptar un reclamo rechaza a los otros pendientes y deja la publicación en in_claim', async () => {
    const pub = await newPublication('found');
    const first = await claimMine(ids.a, pub);
    const second = await claimMine(ids.b, pub);
    await acceptClaim(ids.pub, first.id);
    const other = await getClaim(ids.b, second.id);
    assert.equal(other.status, 'rejected');
    assert.ok(other.decidedAt);
    assert.equal((await query('SELECT status FROM publications WHERE id = $1', [pub])).rows[0].status, 'in_claim');
    await assert.rejects(acceptClaim(ids.pub, second.id), { status: 409 });
  });

  test('máximo 3 intentos por usuario y publicación, aunque los anteriores hayan sido rechazados', async () => {
    const pub = await newPublication('found');
    for (let i = 0; i < 3; i += 1) {
      const claim = await claimMine(ids.c, pub);
      await rejectClaim(ids.pub, claim.id);
    }
    await assert.rejects(claimMine(ids.c, pub), { status: 403 });
  });

  test('tres pedidos simultáneos del mismo usuario crean un solo reclamo', async () => {
    const pub = await newPublication('found');
    const results = await Promise.allSettled([claimMine(ids.a, pub), claimMine(ids.a, pub), claimMine(ids.a, pub)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    for (const r of results.filter((x) => x.status === 'rejected')) assert.equal(r.reason.status, 409);
    const count = await query('SELECT count(*)::int AS n FROM claims WHERE publication_id = $1', [pub]);
    assert.equal(count.rows[0].n, 1);
  });

  test('un reclamo pendiente pasado el vencimiento queda vencido y ya no se puede aceptar', async () => {
    const pub = await newPublication('found');
    const claim = await claimMine(ids.b, pub);
    // Se simula que pasaron 49 horas moviendo las fechas guardadas: el servidor decide con su propio reloj.
    await query(
      `UPDATE claims SET created_at = now() - interval '49 hours', expires_at = now() - interval '1 hour' WHERE id = $1`,
      [claim.id]
    );
    assert.ok((await expireDueClaims()) >= 1);
    assert.equal((await query('SELECT status FROM claims WHERE id = $1', [claim.id])).rows[0].status, 'expired');
    await assert.rejects(acceptClaim(ids.pub, claim.id), { status: 409 });
  });

  // Revisión, #6.
  test('el barrido borra fotos de reclamo viejas sin usar y respeta las usadas y las recientes', async () => {
    const insertPhoto = async (age) => {
      const r = await query(
        `INSERT INTO photos (user_id, data, mime, kind, created_at)
         VALUES ($1, $2, 'image/jpeg', 'claim', now() - $3::interval) RETURNING id`,
        [ids.c, jpeg, age]
      );
      return r.rows[0].id;
    };
    const oldUnused = await insertPhoto('25 hours');
    const recentUnused = await insertPhoto('1 hour');
    const pub = await newPublication('lost');
    const { photoId: oldUsed } = await claimFoundWithPhoto(ids.c, pub);
    await query(`UPDATE photos SET created_at = now() - interval '25 hours' WHERE id = $1`, [oldUsed]);

    await deleteOrphanClaimPhotos();
    assert.equal(await photoExists(oldUnused), false);
    assert.equal(await photoExists(recentUnused), true);
    assert.equal(await photoExists(oldUsed), true);
  });

  // Revisión, importante 3: la ruta real con la base real.
  test('GET /photos/:id de un reclamo: sin token 401, un tercero 404 y las dos partes 200 con caché privada', async () => {
    const pub = await newPublication('lost');
    const { claim } = await claimFoundWithPhoto(ids.a, pub);
    const photoPath = new URL(claim.photoUri).pathname;

    const app = express();
    app.use('/photos', photosRouter);
    app.use(errorHandler);
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const get = (userId) =>
      new Promise((resolve, reject) => {
        const headers = userId ? { Authorization: `Bearer ${signAccessToken(userId)}` } : {};
        http
          .get({ host: '127.0.0.1', port: server.address().port, path: photoPath, headers }, (res) => {
            res.resume();
            res.on('end', () => resolve({ status: res.statusCode, cache: res.headers['cache-control'] }));
          })
          .on('error', reject);
      });
    try {
      assert.equal((await get(null)).status, 401);
      assert.equal((await get(ids.c)).status, 404);
      for (const userId of [ids.a, ids.pub]) {
        const res = await get(userId);
        assert.equal(res.status, 200);
        assert.equal(res.cache, 'private, no-store');
      }
    } finally {
      server.close();
    }
  });
});
