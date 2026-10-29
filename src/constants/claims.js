import { colors } from './theme';

// Los valores (pending, accepted...) son los de la API; acá solo se traducen para mostrarlos.
export const CLAIM_STATUS = {
  pending: { label: 'Pendiente', color: colors.warning },
  accepted: { label: 'Aceptado', color: colors.primary },
  rejected: { label: 'Rechazado', color: colors.error },
  expired: { label: 'Vencido', color: colors.muted },
};

export const CLAIM_TYPE_LABEL = { mine: 'Es mío', found: 'Lo encontré' };

export const CLAIM_ROLE_LABEL = { claimer: 'Lo envié yo', publisher: 'Lo recibí' };

// Estados del punto de encuentro vigente (los valores son los de la API).
export const MEETING_STATUS_LABEL = { proposed: 'Esperando respuesta', accepted: 'Acordado' };
