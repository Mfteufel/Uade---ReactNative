// Pruebas de flujo con una base simulada: se reemplaza ../src/db antes de cargar los servicios.
// No tocan ninguna base real (ni la del equipo). Verifican qué consultas se hacen y las reglas de acceso,
// no el SQL en sí: eso se prueba contra Postgres al correr la API.
process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const sharp = require('sharp');

// Base simulada: `handlers` es una lista de [regex, respuesta] que se prueba contra el SQL; `log` guarda todo lo ejecutado.
const log = [];
let handlers = [];
const run = async (text, params) => {
  log.push({ text, params });
  const found = handlers.find(([re]) => re.test(text));
  const result = found ? (typeof found[1] === 'function' ? found[1](params) : found[1]) : { rows: [], rowCount: 0 };
  return result;
};
const fakeDb = {
  query: run,
  withTransaction: async (fn) => fn({ query: run }),
  pool: { end: async () => {} },
};
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const { savePhoto, deleteOrphanClaimPhotos } = require('../src/services/photos');
const { acceptClaim, rejectClaim, createClaim } = require('../src/services/claims');
const photosRouter = require('../src/routes/photos');
const { errorHandler } = require('../src/middleware/errors');
const { signAccessToken } = require('../src/services/tokens');

const setup = (list) => {
  log.length = 0;
  handlers = list;
};
const rows = (...r) => ({ rows: r, rowCount: r.length });

// ---------------------------------------------------------------------------
// Bloqueante 1: cambiar el avatar no puede borrar las fotos de reclamos
// ---------------------------------------------------------------------------

test('savePhoto: al cambiar el avatar solo borra fotos de perfil, no las de reclamos', async () => {
  const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c83232' } }).jpeg().toBuffer();
  setup([
    [/FROM users WHERE id = \$1 FOR UPDATE/, rows({ id: 'u_1' })],
    [/INSERT INTO photos/, rows({ id: '3f2c1a9e-0b7d-4c1e-9a8f-2d6b5e7c8a90' })],
    [/UPDATE users SET photo_id/, rows({ id: 'u_1', email: 'a@b.c', name: 'Ana', photo_id: 'x', created_at: new Date() })],
  ]);
  await savePhoto('u_1', jpeg);
  const del = log.find((q) => /^DELETE FROM photos/.test(q.text));
  assert.ok(del, 'tiene que borrar la foto de perfil anterior');
  assert.match(del.text, /kind = 'profile'/);
});

// ---------------------------------------------------------------------------
// Importante 3: las fotos de reclamo se sirven solo con token y a las dos partes
// ---------------------------------------------------------------------------

const PHOTO_PROFILE = '11111111-1111-4111-8111-111111111111';
const PHOTO_CLAIM = '22222222-2222-4222-8222-222222222222';

const photoRows = (params) => {
  if (params[0] === PHOTO_PROFILE) return rows({ data: Buffer.from('perfil'), is_profile: true, claimer_id: null, publisher_id: null });
  if (params[0] === PHOTO_CLAIM) return rows({ data: Buffer.from('reclamo'), is_profile: false, claimer_id: 'u_claimer', publisher_id: 'u_publisher' });
  return rows();
};

async function getPhoto(id, userId) {
  const app = express();
  app.use('/photos', photosRouter);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const headers = userId ? { Authorization: `Bearer ${signAccessToken(userId)}` } : {};
    const res = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path: `/photos/${id}`, headers }, (r) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks).toString() }));
      }).on('error', reject);
    });
    return res;
  } finally {
    server.close();
  }
}

test('GET /photos: la foto de perfil sigue siendo pública y cacheable', async () => {
  setup([[/FROM photos p/, photoRows]]);
  const res = await getPhoto(PHOTO_PROFILE);
  assert.equal(res.status, 200);
  assert.match(res.headers['cache-control'], /public/);
});

test('GET /photos: la foto de un reclamo exige token', async () => {
  setup([[/FROM photos p/, photoRows]]);
  const res = await getPhoto(PHOTO_CLAIM);
  assert.equal(res.status, 401);
  assert.notEqual(res.body, 'reclamo');
});

test('GET /photos: la foto de un reclamo la ven solo las dos partes, con caché privada', async () => {
  setup([[/FROM photos p/, photoRows]]);
  for (const userId of ['u_claimer', 'u_publisher']) {
    const res = await getPhoto(PHOTO_CLAIM, userId);
    assert.equal(res.status, 200);
    assert.equal(res.body, 'reclamo');
    assert.equal(res.headers['cache-control'], 'private, no-store');
  }
  const tercero = await getPhoto(PHOTO_CLAIM, 'u_tercero');
  assert.equal(tercero.status, 404);
  assert.notEqual(tercero.body, 'reclamo');
});

// ---------------------------------------------------------------------------
// Importante 4: al aceptar un reclamo, los otros pendientes de la publicación se rechazan
// ---------------------------------------------------------------------------

const claimRow = {
  id: 'c_1', publication_id: 'p_1', publisher_id: 'u_publisher', claimer_id: 'u_claimer',
  status: 'pending', vencido: false, publication_status: 'open',
  type: 'mine', attempt_number: 1, description: null, photo_id: null, found_neighborhood_id: null,
  created_at: new Date(), expires_at: new Date(Date.now() + 3600_000), decided_at: null,
  publication_title: 'Mochila', publication_type: 'found', verification_answer: 'rojo', correct_answer: 'rojo',
  publisher_name: 'Pablo', claimer_name: 'Clara',
};

const decisionHandlers = () => [
  [/^SELECT publication_id FROM claims/, rows({ publication_id: 'p_1' })],
  [/FROM publications WHERE id = \$1 FOR UPDATE/, rows({ id: 'p_1' })],
  [/FOR UPDATE OF c/, rows(claimRow)],
  [/FROM claims c\s+JOIN publications p ON p.id = c.publication_id\s+JOIN users pub/, rows(claimRow)],
];

test('aceptar un reclamo rechaza en la misma transacción a los otros pendientes de la publicación', async () => {
  setup(decisionHandlers());
  await acceptClaim('u_publisher', 'c_1');
  const rejectOthers = log.find((q) => /UPDATE claims SET status = 'rejected'/.test(q.text));
  assert.ok(rejectOthers, 'tiene que rechazar a los demás pendientes');
  assert.match(rejectOthers.text, /status = 'pending' AND id <> \$2/);
  assert.deepEqual(rejectOthers.params, ['p_1', 'c_1']);
});

test('rechazar un reclamo no toca a los otros pendientes', async () => {
  setup(decisionHandlers());
  await rejectClaim('u_publisher', 'c_1');
  assert.ok(!log.some((q) => /UPDATE claims SET status = 'rejected'/.test(q.text)));
});

test('solo el publicador decide: el solicitante recibe 403 y no se modifica nada', async () => {
  setup(decisionHandlers());
  await assert.rejects(acceptClaim('u_claimer', 'c_1'), { status: 403 });
  assert.ok(!log.some((q) => /^UPDATE/.test(q.text.trim())));
});

// ---------------------------------------------------------------------------
// Fotos de reclamo sin usar (revisión #6)
// ---------------------------------------------------------------------------

test('el barrido borra solo fotos de reclamo viejas que ningún reclamo usa', async () => {
  setup([[/DELETE FROM photos/, { rows: [], rowCount: 2 }]]);
  assert.equal(await deleteOrphanClaimPhotos(), 2);
  const sql = log[0].text;
  assert.match(sql, /p\.kind = 'claim'/);
  assert.match(sql, /interval '24 hours'/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM claims c WHERE c\.photo_id = p\.id\)/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
});

test('createClaim bloquea la foto mientras valida, para que el barrido no la borre en el medio', async () => {
  const body = { photoId: PHOTO_CLAIM, foundNeighborhoodId: 'palermo' };
  setup([
    [/FROM publications WHERE id = \$1 FOR UPDATE/, rows({ id: 'p_1', user_id: 'u_publisher', type: 'lost', title: 'x', status: 'open', vencida: false })],
    [/MAX\(attempt_number\)/, rows({ used: 0, active: false })],
    [/FROM photos p/, rows({ '?column?': 1 })],
    [/FROM neighborhoods/, rows({ '?column?': 1 })],
    [/FROM claims c\s+JOIN publications p ON p.id = c.publication_id\s+JOIN users pub/, rows({ ...claimRow, type: 'found', publication_type: 'lost' })],
  ]);
  await createClaim('u_claimer', 'p_1', body);
  const photoQuery = log.find((q) => /FROM photos p/.test(q.text));
  assert.match(photoQuery.text, /FOR UPDATE OF p/);
});

test('createClaim: si el barrido ya borró la foto, el reclamo se rechaza con 422', async () => {
  setup([
    [/FROM publications WHERE id = \$1 FOR UPDATE/, rows({ id: 'p_1', user_id: 'u_publisher', type: 'lost', title: 'x', status: 'open', vencida: false })],
    [/MAX\(attempt_number\)/, rows({ used: 0, active: false })],
    [/FROM photos p/, rows()],
  ]);
  await assert.rejects(createClaim('u_claimer', 'p_1', { photoId: PHOTO_CLAIM, foundNeighborhoodId: 'palermo' }), { status: 422 });
  assert.ok(!log.some((q) => /^INSERT INTO claims/.test(q.text.trim())));
});
