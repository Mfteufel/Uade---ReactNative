import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

// Tarjeta blanca con borde de 1 dp, sin sombra (se separa con el borde).
// Con onPress es un botón (accessibilityLabel opcional para describirla); presionada va en blue50.
// tight: padding de 12 en vez de 16 (tarjetas estrechas).
export default function Card({ children, style, onPress, accessibilityLabel, tight = false }) {
  const base = [styles.card, tight && styles.tight];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...base, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[...base, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  tight: { padding: spacing.cardTight },
  pressed: { backgroundColor: colors.blue50 },
});
