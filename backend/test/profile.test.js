process.env.JWT_SECRET = 'x'.repeat(48);
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfileUpdate, updateMe } = require('../src/services/profile');

test('nombre vacío o con espacios -> 422 con mensaje del mock', () => {
  for (const name of ['', '   ']) {
    const r = buildProfileUpdate({ name });
    assert.equal(r.error.status, 422);
    assert.equal(r.error.message, 'El nombre no puede estar vacío.');
  }
});

test('recorta textos', () => {
  const r = buildProfileUpdate({ name: '  Lucía Test  ', neighborhood: ' Palermo ', phone: ' 11 ' });
  assert.deepEqual(r.fields, { name: 'Lucía Test', neighborhood: 'Palermo', phone: '11' });
});

test('barrio y teléfono pueden quedar vacíos', () => {
  assert.deepEqual(buildProfileUpdate({ neighborhood: '  ', phone: '' }).fields, { neighborhood: '', phone: '' });
});

test('phoneVisibleOnClaim es boolean estricto', () => {
  assert.deepEqual(buildProfileUpdate({ phoneVisibleOnClaim: false }).fields, { phoneVisibleOnClaim: false });
  for (const v of ['si', 1, 0, null, 'true']) {
    assert.equal(buildProfileUpdate({ phoneVisibleOnClaim: v }).error.status, 422);
  }
});

test('campos no permitidos se ignoran', () => {
  const r = buildProfileUpdate({ email: 'a@b.c', id: 'u_x', password_hash: 'x', photoUri: 'http://x', created_at: 1, photo_id: 'x', __proto__: { name: 'x' } });
  assert.deepEqual(r.fields, {});
});

test('tipos incorrectos y largos máximos', () => {
  assert.equal(buildProfileUpdate({ name: 5 }).error.status, 422);
  assert.equal(buildProfileUpdate({ phone: {} }).error.status, 422);
  assert.equal(buildProfileUpdate({ name: 'a'.repeat(81) }).error.status, 422);
  assert.equal(buildProfileUpdate({ neighborhood: 'a'.repeat(81) }).error.status, 422);
  assert.equal(buildProfileUpdate({ phone: '1'.repeat(31) }).error.status, 422);
  assert.equal(buildProfileUpdate({ name: 'a'.repeat(80), phone: '1'.repeat(30) }).error, undefined);
});

test('body inválido', () => {
  assert.deepEqual(buildProfileUpdate(undefined).fields, {});
  assert.deepEqual(buildProfileUpdate({}).fields, {});
  for (const b of [[], 'x', 5]) assert.equal(buildProfileUpdate(b).error.status, 422);
});

test('__proto__ en el body (JSON.parse) no agrega campos', () => {
  assert.deepEqual(buildProfileUpdate(JSON.parse('{"__proto__":{"name":"x"}}')).fields, {});
});

test('caracteres de control y bidi -> 422', () => {
  const labels = { name: 'El nombre', neighborhood: 'El barrio', phone: 'El teléfono' };
  for (const key of Object.keys(labels)) {
    for (const bad of ['a\u0000b', 'a\nb', 'a\u202Eb', 'a\u2066b', 'a\u007Fb']) {
      const r = buildProfileUpdate({ [key]: bad });
      assert.equal(r.error.status, 422);
      assert.equal(r.error.message, `${labels[key]} tiene caracteres no permitidos.`);
    }
  }
});

test('nombre invisible (U+200B) -> 422 vacío', () => {
  const r = buildProfileUpdate({ name: '\u200B' });
  assert.equal(r.error.status, 422);
  assert.equal(r.error.message, 'El nombre no puede estar vacío.');
});

test('nombre de 80 chars con espacios alrededor se acepta y recorta', () => {
  const n = 'a'.repeat(80);
  assert.deepEqual(buildProfileUpdate({ name: `  ${n}  ` }).fields, { name: n });
});

test('undefined se omite', () => {
  assert.deepEqual(buildProfileUpdate({ name: undefined }).fields, {});
});

test('mensajes en español', () => {
  const msgs = [
    buildProfileUpdate({ neighborhood: 5 }).error.message,
    buildProfileUpdate({ neighborhood: 'a'.repeat(81) }).error.message,
    buildProfileUpdate({ phone: 'a'.repeat(31) }).error.message,
    buildProfileUpdate({ name: 'a'.repeat(81) }).error.message,
  ];
  assert.deepEqual(msgs, [
    'El barrio debe ser texto.',
    'El barrio no puede superar los 80 caracteres.',
    'El teléfono no puede superar los 30 caracteres.',
    'El nombre no puede superar los 80 caracteres.',
  ]);
  for (const m of msgs) assert.ok(!/neighborhood|phone|campo/.test(m));
});

test('updateMe rechaza antes de tocar la DB', async () => {
  await assert.rejects(() => updateMe('u_1', { name: 'a\u0000b' }), (e) => e.status === 422);
});
