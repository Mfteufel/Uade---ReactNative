import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

export default function SectionTitle({ title, style }) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
