process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { processAvatar } = require('../src/services/photos');
const { EventEmitter } = require('node:events');
const { mapUploadError, createUploadGate } = require('../src/middleware/upload');
const { parsePublicUrl } = require('../src/config');
const { toUser } = require('../src/services/tokens');

const mk = (width, height, channels = 3, background = { r: 200, g: 50, b: 50 }) =>
  sharp({ create: { width, height, channels, background } });

test('JPEG 2000x1000 -> 512x256 y liviano', async () => {
  const out = await processAvatar(await mk(2000, 1000).jpeg().toBuffer());
  const m = await sharp(out).metadata();
  assert.equal(m.format, 'jpeg');
  assert.equal(m.width, 512);
  assert.equal(m.height, 256);
  assert.ok(out.length < 150 * 1024);
});

test('PNG con alfa -> JPEG sin alfa, fondo blanco', async () => {
  const png = await mk(300, 300, 4, { r: 0, g: 0, b: 0, alpha: 0 }).png().toBuffer();
  const out = await processAvatar(png);
  const m = await sharp(out).metadata();
  assert.equal(m.format, 'jpeg');
  assert.equal(m.channels, 3);
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 245 && data[1] > 245 && data[2] > 245);
});

test('rechaza texto, vacío y demasiado grande', async () => {
  await assert.rejects(processAvatar(Buffer.from('hola')), { status: 422 });
  await assert.rejects(processAvatar(Buffer.alloc(0)), { status: 422 });
  const big = await mk(200, 200).png().toBuffer();
  await assert.rejects(processAvatar(big, { maxPixels: 10_000 }), (e) => e.status === 422);
});

test('EXIF: aplica orientación y quita metadatos', async () => {
  const src = await mk(200, 100)
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Artist: 'SECRETO' } })
    .jpeg()
    .toBuffer();
  const out = await processAvatar(src);
  const m = await sharp(out).metadata();
  assert.equal(m.width, 100);
  assert.equal(m.height, 200);
  assert.equal(m.exif, undefined);
  assert.equal(m.orientation, undefined);
  assert.ok(!out.includes(Buffer.from('SECRETO')));
});

test('GIF y TIFF -> 422; 64x64 no se agranda', async () => {
  await assert.rejects(processAvatar(await mk(50, 50).gif().toBuffer()), { status: 422 });
  await assert.rejects(processAvatar(await mk(50, 50).tiff().toBuffer()), { status: 422 });
  const m = await sharp(await processAvatar(await mk(64, 64).jpeg().toBuffer())).metadata();
  assert.equal(m.width, 64);
  assert.equal(m.height, 64);
});

test('mapUploadError', () => {
  assert.equal(mapUploadError({ code: 'LIMIT_FILE_SIZE' }).status, 413);
  assert.equal(mapUploadError({ code: 'LIMIT_UNEXPECTED_FILE' }).status, 400);
  assert.equal(mapUploadError(new Error('Unexpected end of form')).status, 400);
});

test('parsePublicUrl', () => {
  assert.throws(() => parsePublicUrl('', { isProd: true, port: 3000 }));
  assert.throws(() => parsePublicUrl('http://x.com', { isProd: true, port: 3000 }));
  assert.equal(parsePublicUrl('https://x.com/', { isProd: true, port: 3000 }), 'https://x.com');
  assert.equal(parsePublicUrl(' http://h:3000/// ', { isProd: false, port: 3000 }), 'http://h:3000');
  assert.throws(() => parsePublicUrl('http://x.com/api', { isProd: false, port: 3000 }));
  assert.throws(() => parsePublicUrl('http://x.com?a=1', { isProd: false, port: 3000 }));
  assert.throws(() => parsePublicUrl('http://u:p@x.com', { isProd: false, port: 3000 }));
  assert.throws(() => parsePublicUrl('ftp://x.com', { isProd: false, port: 3000 }));
});

test('parsePublicUrl normaliza con origin', () => {
  const o = { isProd: false, port: 3000 };
  assert.equal(parsePublicUrl('HTTP://Host.COM:80/', o), 'http://host.com');
  assert.equal(parsePublicUrl('http://x.com:443', o), 'http://x.com:443');
  assert.equal(parsePublicUrl('https://x.com:443', o), 'https://x.com');
  assert.equal(parsePublicUrl('http://[::1]:3000', o), 'http://[::1]:3000');
});

test('parsePublicUrl: dev sin valor usa localhost:PORT', () => {
  assert.equal(parsePublicUrl(undefined, { isProd: false, port: 3000 }), 'http://localhost:3000');
});

test('toUser resuelve photoUri', () => {
  const row = { id: 'u', email: 'e', name: 'n', neighborhood: 'b', phone: 'p', phone_visible_on_claim: true, created_at: new Date() };
  assert.equal(toUser({ ...row, photo_id: 'abc' }).photoUri, 'http://test.local:3000/photos/abc');
  assert.equal(toUser({ ...row, photo_id: null }).photoUri, null);
});

// --- magic bytes, PNG progresivo, límite de píxeles ---
test('magic bytes: GIF/TIFF/texto/SVG/vacío -> 422 antes de sharp', async () => {
  const bad = [
    await mk(10, 10).gif().toBuffer(),
    await mk(10, 10).tiff().toBuffer(),
    Buffer.from('hola mundo'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    Buffer.alloc(0),
  ];
  for (const b of bad) await assert.rejects(processAvatar(b), { status: 422 });
});

test('PNG entrelazado -> 422', async () => {
  const png = await mk(100, 100).png({ progressive: true }).toBuffer();
  await assert.rejects(processAvatar(png), { status: 422 });
});

test('límite de píxeles por parámetro', async () => {
  const png = await mk(100, 100).png().toBuffer();
  await assert.rejects(processAvatar(png, { maxPixels: 9_999 }), (e) => e.status === 422);
  await processAvatar(png, { maxPixels: 10_000 });
});

test('WEBP válido pasa los magic bytes', async () => {
  const out = await processAvatar(await mk(40, 40).webp().toBuffer());
  assert.equal((await sharp(out).metadata()).format, 'jpeg');
});

// --- gate ---
function fakes(userId = 'u1') {
  const req = new EventEmitter();
  req.user = { id: userId };
  req.destroy = () => {};
  const res = new EventEmitter();
  res.headersSent = false;
  res.writableEnded = false;
  res.headers = {};
  res.set = (k, v) => {
    res.headers[k] = v;
    return res;
  };
  res.status = (c) => {
    res.statusCode = c;
    return res;
  };
  res.json = (b) => {
    res.body = b;
    res.headersSent = res.writableEnded = true;
    return res;
  };
  return { req, res };
}
const run = (gate, f) => {
  let err;
  gate.uploadGate(f.req, f.res, (e) => (err = e));
  return err;
};

test('gate: releaseGate idempotente, inflight no baja de 0', () => {
  const g = createUploadGate({ maxInflight: 2, timeoutMs: 10_000 });
  const f = fakes();
  assert.equal(run(g, f), undefined);
  assert.equal(g.getInflight(), 1);
  f.req.releaseGate();
  f.req.releaseGate();
  f.res.emit('close');
  assert.equal(g.getInflight(), 0);
});

test('gate: close antes de procesar libera; después de photoProcessing no', () => {
  const g = createUploadGate({ maxInflight: 2, timeoutMs: 10_000 });
  const a = fakes('a');
  run(g, a);
  a.res.emit('close');
  assert.equal(g.getInflight(), 0);
  const b = fakes('b');
  run(g, b);
  b.req.photoProcessing = true;
  b.res.emit('close');
  assert.equal(g.getInflight(), 1);
  b.req.releaseGate(); // el finally del handler
  b.req.releaseGate();
  assert.equal(g.getInflight(), 0);
});

test('gate: cupo por usuario y global (503)', () => {
  const g = createUploadGate({ maxInflight: 2, timeoutMs: 10_000 });
  const a1 = fakes('a');
  run(g, a1);
  const a2 = fakes('a');
  const e = run(g, a2);
  assert.equal(e.status, 429);
  assert.equal(g.getInflight(), 1); // el rechazado no toma cupo
  const b = fakes('b');
  assert.equal(run(g, b), undefined);
  const c = fakes('c');
  const e2 = run(g, c);
  assert.equal(e2.status, 503);
  assert.equal(c.res.headers['Retry-After'], '5');
  a1.req.releaseGate();
  assert.equal(run(g, fakes('a')), undefined);
  b.req.releaseGate();
});

test('gate: 408 por timeout y libera al cerrar', async () => {
  const g = createUploadGate({ maxInflight: 2, timeoutMs: 20 });
  const f = fakes();
  let destroyed = false;
  f.req.destroy = () => (destroyed = true);
  run(g, f);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(f.res.statusCode, 408);
  assert.match(f.res.body.message, /tardó demasiado/);
  assert.equal(f.res.headers.Connection, 'close');
  f.res.emit('finish');
  assert.ok(destroyed);
  f.res.emit('close');
  assert.equal(g.getInflight(), 0);
});

test('gate: body completo cancela el timer', async () => {
  const g = createUploadGate({ maxInflight: 2, timeoutMs: 20 });
  const f = fakes();
  run(g, f);
  f.req.emit('end');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(f.res.statusCode, undefined);
  f.req.releaseGate();
});
