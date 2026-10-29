const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../src/services/returns');
const { WINDOW_MS } = require('../src/services/history');

const NOW = new Date('2026-10-28T15:00:00.000Z');
const ago = (ms) => new Date(NOW.getTime() - ms);
const ret = (over = {}) => ({ id: '60', user_id: 'u_carla', recovered_by_id: 'u_bruno', created_at: ago(24 * 60 * 60 * 1000), ...over });

// ----- id -----

test('isValidReturnId: solo enteros positivos de hasta 18 dígitos', () => {
  for (const ok of ['1', '60', '123456789012345678']) assert.equal(r.isValidReturnId(ok), true, ok);
  for (const bad of ['0', '-1', '01', '1.5', 'abc', '', '1234567890123456789', undefined]) assert.equal(r.isValidReturnId(bad), false, String(bad));
});

// ----- body -----

test('parseRatingBody: positive obligatorio y booleano', () => {
  assert.deepEqual(r.parseRatingBody({ positive: true }), { rating: { positive: true, comment: null } });
  assert.deepEqual(r.parseRatingBody({ positive: false }), { rating: { positive: false, comment: null } });
  for (const raw of [{}, undefined, { positive: 'true' }, { positive: 1 }, { positive: null }]) {
    const out = r.parseRatingBody(raw);
    assert.equal(out.error?.status, 422, JSON.stringify(raw));
    assert.match(out.error.message, /positiva o negativa/);
  }
});

test('parseRatingBody: el cuerpo tiene que ser un objeto', () => {
  assert.equal(r.parseRatingBody([true]).error.status, 422);
  assert.equal(r.parseRatingBody('x').error.status, 422);
});

test('parseRatingBody: comment se recorta y vacío queda null', () => {
  assert.equal(r.parseRatingBody({ positive: true, comment: '  Muy amable  ' }).rating.comment, 'Muy amable');
  assert.equal(r.parseRatingBody({ positive: true, comment: '   ' }).rating.comment, null);
  assert.equal(r.parseRatingBody({ positive: true, comment: '' }).rating.comment, null);
  assert.equal(r.parseRatingBody({ positive: true, comment: null }).rating.comment, null);
});

test('parseRatingBody: comment de hasta 280 caracteres, sin caracteres de control', () => {
  assert.equal(r.parseRatingBody({ positive: true, comment: 'a'.repeat(280) }).rating.comment.length, 280);
  assert.equal(r.parseRatingBody({ positive: true, comment: `  ${'a'.repeat(280)}  ` }).error, undefined); // cuenta después de recortar
  assert.match(r.parseRatingBody({ positive: true, comment: 'a'.repeat(281) }).error.message, /280/);
  assert.equal(r.parseRatingBody({ positive: true, comment: '😀'.repeat(280) }).error, undefined); // 280 caracteres, no 560 unidades UTF-16
  for (const bad of ['hola\u0000', 'linea\nnueva', 'tab\tadentro', 'x‮y']) {
    assert.match(r.parseRatingBody({ positive: true, comment: bad }).error.message, /no permitidos/, JSON.stringify(bad));
  }
  assert.match(r.parseRatingBody({ positive: true, comment: 5 }).error.message, /texto/);
});

// ----- la otra parte -----

test('counterpartOf: devuelve la otra parte o null', () => {
  assert.equal(r.counterpartOf(ret(), 'u_carla'), 'u_bruno');
  assert.equal(r.counterpartOf(ret(), 'u_bruno'), 'u_carla');
  assert.equal(r.counterpartOf(ret(), 'u_otro'), null);
  assert.equal(r.counterpartOf(ret({ recovered_by_id: null }), 'u_carla'), null);
  assert.equal(r.counterpartOf(null, 'u_carla'), null);
});

// ----- reglas y su orden -----

const can = (over = {}) => r.checkCanRate({ ret: ret(), userId: 'u_carla', now: NOW, alreadyRated: false, ...over });

test('checkCanRate: las dos partes pueden valorar dentro del plazo', () => {
  assert.equal(can(), null);
  assert.equal(can({ userId: 'u_bruno' }), null);
});

test('checkCanRate: el plazo de 7 días tiene borde inclusivo', () => {
  assert.equal(can({ ret: ret({ created_at: ago(WINDOW_MS) }) }), null);
  const late = can({ ret: ret({ created_at: ago(WINDOW_MS + 1) }) });
  assert.deepEqual(late, { status: 422, message: 'El plazo para valorar venció (7 días desde la devolución).' });
});

test('checkCanRate: no existe o no es parte -> el mismo 404', () => {
  const nf = { status: 404, message: 'Devolución no encontrada.' };
  assert.deepEqual(can({ ret: null }), nf);
  assert.deepEqual(can({ userId: 'u_otro' }), nf);
});

test('checkCanRate: sin quien recuperó -> 422', () => {
  const out = can({ ret: ret({ recovered_by_id: null }) });
  assert.equal(out.status, 422);
  assert.match(out.message, /a quién valorar/);
});

test('checkCanRate: ya valoró -> 409', () => {
  assert.deepEqual(can({ alreadyRated: true }), { status: 409, message: 'Ya valoraste esta devolución.' });
});

test('checkCanRate: el orden de los errores es 404 > sin contraparte > plazo > ya valoró', () => {
  const old = ago(WINDOW_MS + 1);
  // No es parte, aunque además esté vencida y ya valorada: 404 (no se revela nada más).
  assert.equal(can({ userId: 'u_otro', ret: ret({ created_at: old }), alreadyRated: true }).status, 404);
  // Sin quien recuperó y además vencida: gana "sin contraparte".
  assert.match(can({ ret: ret({ recovered_by_id: null, created_at: old }), alreadyRated: true }).message, /a quién valorar/);
  // Vencida y ya valorada: gana el plazo.
  assert.match(can({ ret: ret({ created_at: old }), alreadyRated: true }).message, /plazo/);
});

// ----- respuesta -----

test('toRating: arma la respuesta con returnId como número y fecha ISO', () => {
  const created = new Date('2026-10-28T14:00:00.000Z');
  assert.deepEqual(
    r.toRating({ id: 7, return_id: '60', rated_user_id: 'u_bruno', positive: false, comment: null, created_at: created }),
    { id: '7', returnId: 60, ratedUserId: 'u_bruno', positive: false, comment: null, createdAt: '2026-10-28T14:00:00.000Z' }
  );
});

// ----- agradecimiento: body -----

test('parseThanksBody: message obligatorio, se recorta, de 1 a 500 caracteres', () => {
  assert.deepEqual(r.parseThanksBody({ message: '  ¡Gracias!  ' }), { thanks: { message: '¡Gracias!' } });
  for (const raw of [{}, undefined, { message: null }, { message: '' }, { message: '    ' }]) {
    assert.match(r.parseThanksBody(raw).error.message, /Escribí el mensaje/, JSON.stringify(raw));
  }
  assert.equal(r.parseThanksBody({ message: 'a'.repeat(500) }).thanks.message.length, 500);
  assert.equal(r.parseThanksBody({ message: 'a' }).thanks.message, 'a');
  assert.match(r.parseThanksBody({ message: 'a'.repeat(501) }).error.message, /500/);
  assert.equal(r.parseThanksBody({ message: '🙏'.repeat(500) }).error, undefined); // 500 caracteres, no 1000 unidades UTF-16
});

test('parseThanksBody: misma regla de caracteres que el comentario de la valoración', () => {
  for (const bad of ['hola\u0000', 'linea\nnueva', 'tab\tadentro', 'x‮y']) {
    assert.match(r.parseThanksBody({ message: bad }).error.message, /no permitidos/, JSON.stringify(bad));
    assert.match(r.parseRatingBody({ positive: true, comment: bad }).error.message, /no permitidos/, JSON.stringify(bad));
  }
  assert.match(r.parseThanksBody({ message: 5 }).error.message, /texto/);
  assert.equal(r.parseThanksBody([]).error.status, 422);
});

// ----- agradecimiento: reglas y su orden -----

const thank = (over = {}) => r.checkCanThank({ ret: ret(), userId: 'u_bruno', now: NOW, alreadyThanked: false, ...over });

test('checkCanThank: solo quien recuperó puede agradecer', () => {
  assert.equal(thank(), null);
  assert.deepEqual(thank({ userId: 'u_carla' }), { status: 403, message: 'Solo quien recuperó el objeto puede agradecer.' });
});

test('checkCanThank: no existe o no es parte -> el mismo 404', () => {
  const nf = { status: 404, message: 'Devolución no encontrada.' };
  assert.deepEqual(thank({ ret: null }), nf);
  assert.deepEqual(thank({ userId: 'u_otro' }), nf);
});

test('checkCanThank: el plazo de 7 días tiene borde inclusivo', () => {
  assert.equal(thank({ ret: ret({ created_at: ago(WINDOW_MS) }) }), null);
  assert.deepEqual(thank({ ret: ret({ created_at: ago(WINDOW_MS + 1) }) }),
    { status: 422, message: 'El plazo para agradecer venció (7 días desde la devolución).' });
});

test('checkCanThank: ya hay agradecimiento -> 409', () => {
  assert.deepEqual(thank({ alreadyThanked: true }), { status: 409, message: 'Ya agradeciste esta devolución.' });
});

test('checkCanThank: el orden de los errores es 404 > 403 > plazo > ya agradecido', () => {
  const old = ago(WINDOW_MS + 1);
  assert.equal(thank({ userId: 'u_otro', ret: ret({ created_at: old }), alreadyThanked: true }).status, 404);
  assert.equal(thank({ userId: 'u_carla', ret: ret({ created_at: old }), alreadyThanked: true }).status, 403);
  assert.match(thank({ ret: ret({ created_at: old }), alreadyThanked: true }).message, /plazo/);
  // Sin quien recuperó, quien devolvió recibe 403 (no es quien recuperó).
  assert.equal(thank({ userId: 'u_carla', ret: ret({ recovered_by_id: null }) }).status, 403);
});

test('toThanks: arma la respuesta con returnId como número y fecha ISO', () => {
  const created = new Date('2026-10-28T14:00:00.000Z');
  assert.deepEqual(
    r.toThanks({ id: 'b1f0c2d4-0000-4000-8000-000000000001', return_id: '60', recipient_id: 'u_carla', message: 'Gracias', created_at: created }),
    { id: 'b1f0c2d4-0000-4000-8000-000000000001', returnId: 60, recipientId: 'u_carla', message: 'Gracias', createdAt: '2026-10-28T14:00:00.000Z' }
  );
});
