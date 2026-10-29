import { ApiError } from '../errors';
import { delay, randomString, requireCurrentUser, saveDb } from './db';
import { MOCK_NEIGHBORHOODS } from './catalog';
import { createSamplePublications } from './seedPublications';
import { categoryName } from '../../constants/categories';

const DAY_MS = 24 * 60 * 60 * 1000;
const VALIDITY_MS = 30 * DAY_MS;

// Si la base del mock es de antes de que existieran las publicaciones, arranca con los ejemplos.
const publicationsOf = (db) => {
  if (!db.publications) db.publications = createSamplePublications();
  return db.publications;
};

// Igual que el backend: lo que pasó los 30 días queda vencido.
function expireDue(db) {
  const now = Date.now();
  for (const p of publicationsOf(db)) {
    if ((p.status === 'open' || p.status === 'in_claim') && new Date(p.expiresAt).getTime() < now) {
      p.status = 'expired';
    }
  }
}

// En el mock las fotos quedan con la URI local del celular (en la API real se suben al servidor).
export async function createPublication(body, photoUris) {
  await delay();
  const { db, user } = await requireCurrentUser();
  const list = publicationsOf(db);

  const existing = list.find((p) => p.userId === user.id && p.clientId === body.clientId);
  if (existing) return existing;

  const neighborhood = MOCK_NEIGHBORHOODS.find((n) => n.id === body.neighborhoodId);
  if (!neighborhood) throw new ApiError(422, 'Elegí un barrio válido.');

  const now = new Date();
  const isFound = body.type === 'found';
  const publication = {
    id: `p_${randomString()}`,
    userId: user.id,
    clientId: body.clientId,
    type: body.type,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    category: { id: body.categoryId, name: categoryName(body.categoryId) },
    occurredOn: body.occurredOn,
    timeFrom: body.timeFrom || null,
    timeTo: body.timeTo || null,
    neighborhood: { id: neighborhood.id, name: neighborhood.name },
    exactAddress: body.exactAddress?.trim() || null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    verificationQuestion: isFound ? body.verificationQuestion.trim() : null,
    verificationAnswer: isFound ? body.verificationAnswer.trim() : null,
    status: 'open',
    expiresAt: new Date(now.getTime() + VALIDITY_MS).toISOString(),
    renewedAt: null,
    createdAt: now.toISOString(),
    photoUrls: photoUris,
  };
  list.push(publication);
  await saveDb(db);
  return publication;
}

export async function getMyPublications() {
  await delay();
  const { db, user } = await requireCurrentUser();
  expireDue(db);
  await saveDb(db);
  return publicationsOf(db)
    .filter((p) => p.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function renewPublication(id) {
  await delay();
  const { db, user } = await requireCurrentUser();
  expireDue(db);
  const publication = publicationsOf(db).find((p) => p.id === id && p.userId === user.id);
  if (!publication) throw new ApiError(404, 'Publicación no encontrada.');
  if (publication.status === 'resolved') throw new ApiError(409, 'Una publicación resuelta no se puede renovar.');
  publication.expiresAt = new Date(Date.now() + VALIDITY_MS).toISOString();
  publication.renewedAt = new Date().toISOString();
  if (publication.status === 'expired') publication.status = 'open';
  await saveDb(db);
  return publication;
}
