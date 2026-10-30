// Pruebas de flujo de la confirmación de la devolución con una base simulada: se reemplaza ../src/db
// antes de cargar el servicio. No tocan ninguna base real. Verifican qué consultas se hacen, en qué orden
// y las reglas de acceso, no el SQL en sí: eso se prueba contra Postgres al correr la API.
process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');

// Base simulada: `handlers` es una lista de [regex, respuesta] que se prueba contra el SQL; `log` guarda todo lo ejecutado.
const log = [];
let handlers = [];
const run = async (text, params) => {
  log.push({ text, params });
  const found = handlers.find(([re]) => re.test(text));
  if (!found) return { rows: [], rowCount: 0 };
  return typeof found[1] === 'function' ? found[1](params) : found[1];
};
const fakeDb = {
  query: run,
  withTransaction: async (fn) => fn({ query: run }),
  pool: { end: async () => {} },
};
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

const { confirmReturn } = require('../src/services/meetingPoints');

const rows = (...r) => ({ rows: r, rowCount: r.length });

const claimRow = (over = {}) => ({
  id: 'c_1',
  publication_id: 'p_1',
  publisher_id: 'u_pub',
  claimer_id: 'u_cla',
  publication_type: 'found',
  status: 'accepted',
  publisher_name: 'Pablo',
  claimer_name: 'Clara',
  ...over,
});
const pointRow = (over = {}) => ({
  id: 'm_1',
  claim_id: 'c_1',
  proposed_by: 'u_pub',
  proposer_name: 'Pablo',
  address: 'Estación Primera Junta',
  notes: null,
  latitude: null,
  longitude: null,
  status: 'accepted',
  created_at: '2026-10-25T10:00:00.000Z',
  responded_at: '2026-10-25T12:00:00.000Z',
  ...over,
});

// Arma la base simulada de un reclamo. `state` se puede cambiar: el INSERT guarda la devolución para que
// la consulta final (la respuesta al cliente) la encuentre, igual que haría la base.
let state;
const scenario = ({ claim = claimRow(), point = pointRow(), ret = null, insertError = null, updateRows = 1 } = {}) => {
  log.length = 0;
  state = { claim, point, ret, insertError, updateRows };
  handlers = [
    [/SELECT publication_id, publisher_id, claimer_id FROM claims/, () => (state.claim ? rows(state.claim) : rows())],
    [/SELECT id FROM publications WHERE id = \$1 FOR UPDATE/, rows({ id: 'p_1' })],
    [/FROM claims c\s+JOIN users pub/, () => (state.claim ? rows(state.claim) : rows())],
    [/FROM meeting_points mp/, () => (state.point ? rows(state.point) : rows())],
    [/FROM returns WHERE claim_id/, () => (state.ret ? rows(state.ret) : rows())],
    [
      /INSERT INTO returns/,
      () => {
        if (state.insertError) throw state.insertError;
        state.ret = { id: '7', created_at: '2026-10-26T09:00:00.000Z' };
        return { rows: [], rowCount: 1 };
      },
    ],
    [/UPDATE publications SET status = 'resolved'/, () => ({ rows: [], rowCount: state.updateRows })],
  ];
};

const wrote = () => log.filter((q) => /INSERT INTO returns|UPDATE publications/.test(q.text));
const rejectsWith = (promise, status, message) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.status, status);
    if (message) assert.match(e.message, message);
    return true;
  });

test('quien recupera confirma: se inserta en returns con los valores del reclamo y la publicación queda resuelta', async () => {
  scenario();
  const view = await confirmReturn('u_cla', 'c_1');

  const insert = log.find((q) => /INSERT INTO returns/.test(q.text));
  // user_id = quien devolvió (el publicador en "encontrada"), recovered_by_id = quien recuperó, claim y punto acordado.
  assert.deepEqual(insert.params, ['u_pub', 'u_cla', 'c_1', 'm_1']);
  const update = log.find((q) => /UPDATE publications SET status = 'resolved'/.test(q.text));
  assert.match(update.text, /status_changed_at = now\(\)/);
  assert.deepEqual(update.params, ['p_1']);

  // La respuesta es la vista real, con la devolución ya registrada.
  assert.deepEqual(view.completedReturn, { id: 7, createdAt: '2026-10-26T09:00:00.000Z' });
  assert.equal(view.canConfirmReturn, false);
});

test('bloquea primero la publicación y después el reclamo (mismo orden que al aceptar o rechazar)', async () => {
  scenario();
  await confirmReturn('u_cla', 'c_1');
  const at = (re) => log.findIndex((q) => re.test(q.text));
  const lockPublication = at(/SELECT id FROM publications WHERE id = \$1 FOR UPDATE/);
  const lockClaim = at(/FOR UPDATE OF c/);
  const insert = at(/INSERT INTO returns/);
  assert.ok(lockPublication >= 0 && lockClaim > lockPublication, 'la publicación se bloquea antes que el reclamo');
  assert.ok(insert > lockClaim);
});

test('en una publicación "perdida" devuelve quien reclamó y recupera el publicador', async () => {
  scenario({ claim: claimRow({ publication_type: 'lost' }), point: pointRow({ proposed_by: 'u_cla' }) });
  await confirmReturn('u_pub', 'c_1');
  assert.deepEqual(log.find((q) => /INSERT INTO returns/.test(q.text)).params, ['u_cla', 'u_pub', 'c_1', 'm_1']);
});

test('quien tiene el objeto no puede confirmar: 403 y no se escribe nada', async () => {
  scenario();
  await rejectsWith(confirmReturn('u_pub', 'c_1'), 403, /quien recupera el objeto/);
  assert.equal(wrote().length, 0);
});

test('sin punto de encuentro acordado no se confirma: 409 y no se escribe nada', async () => {
  for (const point of [null, pointRow({ status: 'proposed', responded_at: null })]) {
    scenario({ point });
    await rejectsWith(confirmReturn('u_cla', 'c_1'), 409, /acordar el punto de encuentro/);
    assert.equal(wrote().length, 0);
  }
});

test('una devolución ya registrada no se repite: 409 y no se escribe nada', async () => {
  scenario({ ret: { id: '7', created_at: '2026-10-26T09:00:00.000Z' } });
  await rejectsWith(confirmReturn('u_cla', 'c_1'), 409, /ya fue confirmada/);
  assert.equal(wrote().length, 0);
});

test('con el reclamo sin aceptar no se confirma: 409', async () => {
  scenario({ claim: claimRow({ status: 'pending' }) });
  await rejectsWith(confirmReturn('u_cla', 'c_1'), 409, /aceptado/);
  assert.equal(wrote().length, 0);
});

test('un tercero o un reclamo inexistente reciben 404 y no se bloquea nada', async () => {
  scenario();
  await rejectsWith(confirmReturn('u_tercero', 'c_1'), 404, /Reclamo no encontrado/);
  scenario({ claim: null });
  await rejectsWith(confirmReturn('u_cla', 'c_nada'), 404, /Reclamo no encontrado/);
  assert.equal(log.filter((q) => /FOR UPDATE/.test(q.text)).length, 0);
  assert.equal(wrote().length, 0);
});

test('si el UNIQUE de la base corta una carrera, responde 409 en vez de un error del servidor', async () => {
  scenario({ insertError: Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }) });
  await rejectsWith(confirmReturn('u_cla', 'c_1'), 409, /ya fue confirmada/);
});

test('la publicación solo pasa a resuelta desde "en reclamo" o "vencida"', async () => {
  scenario();
  await confirmReturn('u_cla', 'c_1');
  const update = log.find((q) => /UPDATE publications SET status = 'resolved'/.test(q.text));
  assert.match(update.text, /status IN \('in_claim', 'expired'\)/);
});

test('si la publicación no estaba en un estado que se pueda resolver, responde 409 y la transacción se deshace', async () => {
  // El INSERT ya se ejecutó dentro de la transacción: el error hace que withTransaction lo deshaga (ROLLBACK real).
  scenario({ updateRows: 0 });
  await rejectsWith(confirmReturn('u_cla', 'c_1'), 409, /ya no admite/);
});
