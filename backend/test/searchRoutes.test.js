process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
// Nunca la base real: db.js lee backend/.env, pero dotenv no pisa lo que ya está definido.
// Estos tests solo cubren pedidos que se resuelven antes de consultar la base.
process.env.DATABASE_URL = 'postgres://nadie:nada@127.0.0.1:1/nada';
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/index');
const { signAccessToken } = require('../src/services/tokens');

let server;
let base;
test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

const auth = { Authorization: `Bearer ${signAccessToken('u_test')}` };
const call = async (method, path, { headers = {}, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

test('GET /publicaciones requiere token', async () => {
  assert.equal((await call('GET', '/publicaciones?tipo=found')).status, 401);
});

test('GET /publicaciones valida los parámetros con 422 en español', async () => {
  const r = await call('GET', '/publicaciones?tipo=perdi', { headers: auth });
  assert.equal(r.status, 422);
  assert.match(r.body.message, /tipo/);
  assert.equal((await call('GET', '/publicaciones', { headers: auth })).status, 422);
  assert.equal((await call('GET', '/publicaciones?tipo=found&limite=51', { headers: auth })).status, 422);
});

test('no choca con /publicaciones/:publicationId/reclamos (de reclamos)', async () => {
  // El router de reclamos sigue respondiendo lo suyo: 401 sin token.
  assert.equal((await call('GET', '/publicaciones/p_abc/reclamos/formulario')).status, 401);
  // Con token y un id inválido llega a su validación y da su 404 propio, no el de ruta inexistente.
  const r = await call('GET', '/publicaciones/p_abc/reclamos/formulario', { headers: auth });
  assert.notEqual(r.body && r.body.message, 'Ruta no encontrada');
});

test('GET /publicaciones/:id no existe en este router (es de otro punto)', async () => {
  const r = await call('GET', '/publicaciones/p_abc', { headers: auth });
  assert.equal(r.status, 404);
  assert.equal(r.body.message, 'Ruta no encontrada');
});

test('las rutas viejas ya no existen', async () => {
  assert.equal((await call('GET', '/busqueda?situacion=perdi', { headers: auth })).status, 404);
  assert.equal((await call('GET', '/busquedas/recientes', { headers: auth })).status, 404);
});

test('/busquedas-recientes requiere token y valida el body', async () => {
  assert.equal((await call('GET', '/busquedas-recientes')).status, 401);
  assert.equal((await call('POST', '/busquedas-recientes', { body: { tipo: 'found' } })).status, 401);
  assert.equal((await call('DELETE', '/busquedas-recientes/5eed0000-0000-4000-8000-0000000000b1')).status, 401);
  const r = await call('POST', '/busquedas-recientes', { headers: auth, body: { tipo: 'found', periodo: 'rango' } });
  assert.equal(r.status, 422);
});

test('DELETE /busquedas-recientes/:id con un id que no es uuid da 404', async () => {
  const r = await call('DELETE', '/busquedas-recientes/no-es-uuid', { headers: auth });
  assert.equal(r.status, 404);
  assert.equal(r.body.message, 'Búsqueda no encontrada.');
});
