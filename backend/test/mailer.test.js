process.env.JWT_SECRET = 'x'.repeat(48);
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOtpEmail } = require('../src/services/mailer');

test('el correo de registro y el de recuperación dicen cosas distintas', () => {
  const a = buildOtpEmail('123456', 'register');
  const b = buildOtpEmail('123456', 'reset');
  assert.notEqual(a.subject, b.subject);
  assert.match(a.subject, /crear tu cuenta/);
  assert.match(b.subject, /recuperar tu contraseña/);
});

test('el correo incluye el código en texto y en html, y el aviso de vencimiento', () => {
  for (const purpose of ['register', 'reset']) {
    const m = buildOtpEmail('048271', purpose);
    assert.ok(m.textContent.includes('048271'));
    assert.ok(m.htmlContent.includes('048271'));
    assert.match(m.textContent, /10 minutos/);
  }
});

test('un purpose desconocido usa el texto de registro en vez de romper', () => {
  assert.equal(buildOtpEmail('111111', 'otro').subject, buildOtpEmail('111111', 'register').subject);
});

const nodemailer = require('nodemailer');
const { resolveMailConfig } = require('../src/config');
const { makeSmtpSender } = require('../src/services/mailer');

test('resolveMailConfig: vacío -> console', () => {
  assert.equal(resolveMailConfig({}).mode, 'console');
});
test('resolveMailConfig: user+pass -> smtp gmail 465 secure', () => {
  const c = resolveMailConfig({ SMTP_USER: 'a@gmail.com', SMTP_PASS: 'pw' });
  assert.equal(c.mode, 'smtp');
  assert.deepEqual(c.smtp, { host: 'smtp.gmail.com', port: 465, secure: true, user: 'a@gmail.com', pass: 'pw' });
  assert.equal(c.from, 'a@gmail.com');
});
test('resolveMailConfig: puerto 587 -> secure false', () => {
  const c = resolveMailConfig({ SMTP_USER: 'a@b.c', SMTP_PASS: 'p', SMTP_PORT: '587' });
  assert.equal(c.smtp.port, 587);
  assert.equal(c.smtp.secure, false);
});
test('resolveMailConfig: SMTP sin PASS no es smtp', () => {
  assert.equal(resolveMailConfig({ SMTP_USER: 'a@b.c' }).mode, 'console');
});
test('resolveMailConfig: smtp gana sobre brevo; solo brevo -> brevo', () => {
  const both = { SMTP_USER: 'a@b.c', SMTP_PASS: 'p', BREVO_API_KEY: 'k', MAIL_FROM: 'x@y.z' };
  const c = resolveMailConfig(both);
  assert.equal(c.mode, 'smtp');
  assert.equal(c.from, 'x@y.z');
  assert.equal(resolveMailConfig({ BREVO_API_KEY: 'k', MAIL_FROM: 'x@y.z' }).mode, 'brevo');
});
test('resolveMailConfig: BREVO_API_KEY sin MAIL_FROM -> console', () => {
  assert.equal(resolveMailConfig({ BREVO_API_KEY: 'k' }).mode, 'console');
});
test('resolveMailConfig: puerto inválido -> throw', () => {
  for (const p of ['0', '70000', 'abc', '25.5']) {
    assert.throws(() => resolveMailConfig({ SMTP_USER: 'a', SMTP_PASS: 'b', SMTP_PORT: p }), /SMTP_PORT/);
  }
});
test('producción: console -> no arranca; con smtp -> ok', () => {
  const { spawnSync } = require('node:child_process');
  const base = { PATH: process.env.PATH, JWT_SECRET: 'x'.repeat(48), NODE_ENV: 'production', SMTP_USER: '', SMTP_PASS: '', BREVO_API_KEY: '', MAIL_FROM: '', PUBLIC_URL: 'https://e.test' };
  const run = (extra) =>
    spawnSync(process.execPath, ['-e', "require('./src/config')"], { cwd: require('path').join(__dirname, '..'), env: { ...base, ...extra }, encoding: 'utf8' });
  const bad = run({});
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /SMTP_USER/);
  assert.equal(run({ SMTP_USER: 'a@b.c', SMTP_PASS: 'p' }).status, 0);
});
test('makeSmtpSender arma el mensaje sin red (jsonTransport)', async () => {
  const send = makeSmtpSender(nodemailer.createTransport({ jsonTransport: true }), 'x@gmail.com');
  const m = buildOtpEmail('654321', 'register');
  const info = await send('u@test.com', m);
  const msg = JSON.parse(info.message);
  assert.equal(msg.from.address, 'x@gmail.com');
  assert.equal(msg.from.name, 'Hallado');
  assert.equal(msg.to[0].address, 'u@test.com');
  assert.equal(msg.subject, m.subject);
  assert.match(msg.text, /654321/);
});
