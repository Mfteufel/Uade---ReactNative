import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../constants/theme';

// Tarjeta blanca. Con onPress es un botón (accessibilityLabel opcional para describirla).
export default function Card({ children, style, onPress, accessibilityLabel }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  pressed: { backgroundColor: colors.primarySoft },
});
