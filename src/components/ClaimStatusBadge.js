import { StyleSheet, Text, View } from 'react-native';
import { CLAIM_STATUS } from '../constants/claims';
import { colors, spacing } from '../constants/theme';

export default function ClaimStatusBadge({ status }) {
  const { label, color } = CLAIM_STATUS[status] ?? { label: status, color: colors.muted };
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
