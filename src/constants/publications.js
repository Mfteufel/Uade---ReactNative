import { colors } from './theme';

export const MAX_PHOTOS = 5;

export const PUBLICATION_TYPES = [
  { id: 'lost', name: 'Perdí algo' },
  { id: 'found', name: 'Encontré algo' },
];

const pub = colors.status.publication;

export const PUBLICATION_STATUS = {
  open: { label: 'Abierta', color: pub.open.fg, bg: pub.open.bg },
  in_claim: { label: 'En reclamo', color: pub.in_claim.fg, bg: pub.in_claim.bg },
  resolved: { label: 'Resuelta', color: pub.resolved.fg, bg: pub.resolved.bg },
  expired: { label: 'Vencida', color: pub.expired.fg, bg: pub.expired.bg },
};

// Franjas horarias del suceso. La API guarda desde/hasta; la app solo ofrece estas opciones.
export const TIME_SLOTS = [
  { id: 'dawn', name: 'Madrugada (0 a 6)', timeFrom: '00:00', timeTo: '06:00' },
  { id: 'morning', name: 'Mañana (6 a 12)', timeFrom: '06:00', timeTo: '12:00' },
  { id: 'afternoon', name: 'Tarde (12 a 19)', timeFrom: '12:00', timeTo: '19:00' },
  { id: 'night', name: 'Noche (19 a 24)', timeFrom: '19:00', timeTo: '23:59' },
];

export const timeSlotName = (id) => TIME_SLOTS.find((slot) => slot.id === id)?.name || '';
