import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '../constants/theme';

// Estado como píldora: siempre texto (fg) sobre fondo (bg), nunca solo color.
export default function StatusBadge({ label, fg, bg }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessibilityLabel={`Estado: ${label}`}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignSelf: 'flex-start' },
  text: typography.caption,
});
