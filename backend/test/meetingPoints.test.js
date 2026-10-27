process.env.JWT_SECRET = 'x'.repeat(48);
process.env.PUBLIC_URL = 'http://test.local:3000';
const test = require('node:test');
const assert = require('node:assert/strict');
const { holderIdOf, buildMeetingInput, meetingActions, toMeetingView } = require('../src/services/meetingPoints');

// Reclamo aceptado sobre una publicación "encontrada" (Pablo publicó, Clara reclamó "Es mío").
const claimFound = {
  id: 'c_1',
  publication_type: 'found',
  publisher_id: 'u_pub',
  publisher_name: 'Pablo',
  claimer_id: 'u_cla',
  claimer_name: 'Clara',
  status: 'accepted',
};
// Reclamo aceptado sobre una publicación "perdida" (Pablo la perdió, Clara dice "Lo encontré").
const claimLost = { ...claimFound, publication_type: 'lost' };

const point = (over = {}) => ({
  id: 'm_1',
  claim_id: 'c_1',
  proposed_by: 'u_pub',
  proposer_name: 'Pablo',
  address: 'Estación Primera Junta',
  notes: null,
  latitude: null,
  longitude: null,
  status: 'proposed',
  created_at: '2026-10-25T10:00:00.000Z',
  responded_at: null,
  ...over,
});

test('tiene el objeto el publicador si la publicación es "encontrada" y el solicitante si es "perdida"', () => {
  assert.equal(holderIdOf(claimFound), 'u_pub');
  assert.equal(holderIdOf(claimLost), 'u_cla');
});

test('sin punto vigente solo propone quien tiene el objeto', () => {
  const holder = meetingActions({ claim: claimFound, current: null, userId: 'u_pub' });
  assert.equal(holder.canPropose, true);
  assert.equal(holder.canAccept, false);

  const other = meetingActions({ claim: claimFound, current: null, userId: 'u_cla' });
  assert.equal(other.canPropose, false);
  assert.equal(other.status, 403);

  // En "perdida" se invierten los roles.
  assert.equal(meetingActions({ claim: claimLost, current: null, userId: 'u_cla' }).canPropose, true);
  assert.equal(meetingActions({ claim: claimLost, current: null, userId: 'u_pub' }).canPropose, false);
});

test('con una propuesta pendiente responde la otra parte: acepta o sugiere otro lugar', () => {
  const current = point({ proposed_by: 'u_pub' });
  const other = meetingActions({ claim: claimFound, current, userId: 'u_cla' });
  assert.equal(other.canAccept, true);
  assert.equal(other.canPropose, true);

  // Quien propuso no puede aceptar ni volver a proponer: espera la respuesta.
  const proposer = meetingActions({ claim: claimFound, current, userId: 'u_pub' });
  assert.equal(proposer.canAccept, false);
  assert.equal(proposer.canPropose, false);
  assert.equal(proposer.status, 409);
});

test('un punto aceptado es definitivo: nadie puede aceptar ni proponer', () => {
  const current = point({ status: 'accepted' });
  for (const userId of ['u_pub', 'u_cla']) {
    const a = meetingActions({ claim: claimFound, current, userId });
    assert.equal(a.canPropose, false);
    assert.equal(a.canAccept, false);
    assert.equal(a.status, 409);
  }
});

test('la dirección es obligatoria y la aclaración opcional', () => {
  assert.equal(buildMeetingInput({}).error.status, 422);
  assert.equal(buildMeetingInput({ address: '   ' }).error.status, 422);
  assert.equal(buildMeetingInput(undefined).error.status, 422);
  assert.equal(buildMeetingInput([]).error.status, 422);
  assert.deepEqual(buildMeetingInput({ address: ' Av. Cabildo 2000 ' }).input, { address: 'Av. Cabildo 2000', notes: null });
  assert.deepEqual(buildMeetingInput({ address: 'Plaza', notes: 'Frente a la fuente' }).input, {
    address: 'Plaza',
    notes: 'Frente a la fuente',
  });
});

test('rechaza direcciones largas, con caracteres de control o que no son texto', () => {
  assert.ok(buildMeetingInput({ address: 'x'.repeat(201) }).error);
  assert.ok(buildMeetingInput({ address: 'a\u0000b' }).error);
  assert.ok(buildMeetingInput({ address: 123 }).error);
  assert.ok(buildMeetingInput({ address: 'Plaza', notes: 'y'.repeat(281) }).error);
});

test('la vista indica quién propuso y solo expone a la otra parte', () => {
  const view = toMeetingView({ claim: claimFound, current: point({ latitude: '-34.618600', longitude: '-58.442500' }), userId: 'u_cla' });
  assert.equal(view.iHaveTheObject, false);
  assert.deepEqual(view.otherParty, { id: 'u_pub', name: 'Pablo' });
  assert.equal(view.meetingPoint.proposedByMe, false);
  assert.deepEqual(view.meetingPoint.proposedBy, { id: 'u_pub', name: 'Pablo' });
  assert.equal(view.meetingPoint.latitude, -34.6186);
  assert.equal(view.canAccept, true);
  // No se filtran datos privados del reclamo ni de la otra persona.
  const json = JSON.stringify(view);
  assert.ok(!json.includes('phone'));
  assert.ok(!json.includes('verification'));
});

test('sin punto vigente la vista trae meetingPoint en null y explica por qué no se puede proponer', () => {
  const view = toMeetingView({ claim: claimLost, current: null, userId: 'u_pub' });
  assert.equal(view.meetingPoint, null);
  assert.equal(view.iHaveTheObject, false);
  assert.equal(view.canPropose, false);
  assert.match(view.reason, /quien tiene el objeto/);
  assert.equal(toMeetingView({ claim: claimLost, current: null, userId: 'u_cla' }).canPropose, true);
});
