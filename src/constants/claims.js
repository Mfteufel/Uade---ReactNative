import { colors } from './theme';

// Los valores (pending, accepted...) son los de la API; acá solo se traducen para mostrarlos.
const claim = colors.status.claim;

export const CLAIM_STATUS = {
  pending: { label: 'Pendiente', color: claim.pending.fg, bg: claim.pending.bg },
  accepted: { label: 'Aceptado', color: claim.accepted.fg, bg: claim.accepted.bg },
  rejected: { label: 'Rechazado', color: claim.rejected.fg, bg: claim.rejected.bg },
  expired: { label: 'Vencido', color: claim.expired.fg, bg: claim.expired.bg },
};

export const CLAIM_TYPE_LABEL = { mine: 'Es mío', found: 'Lo encontré' };

export const CLAIM_ROLE_LABEL = { claimer: 'Lo envié yo', publisher: 'Lo recibí' };

// Estados del punto de encuentro vigente (los valores son los de la API).
export const MEETING_STATUS_LABEL = { proposed: 'Esperando respuesta', accepted: 'Acordado' };
