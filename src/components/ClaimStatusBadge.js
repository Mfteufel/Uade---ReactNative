import { CLAIM_STATUS } from '../constants/claims';
import { colors } from '../constants/theme';
import StatusBadge from './StatusBadge';

export default function ClaimStatusBadge({ status }) {
  const { label, color, bg } = CLAIM_STATUS[status] ?? { label: status, color: colors.muted, bg: colors.border };
  return <StatusBadge label={label} fg={color} bg={bg} />;
}
