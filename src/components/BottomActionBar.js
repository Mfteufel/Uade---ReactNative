import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';

// Barra fija inferior para botones en fila (usar Button con style={{ flex: 1 }}).
// Ubicarla como último hijo de un contenedor flex: 1, fuera del ScrollView.
export default function BottomActionBar({ children, style }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: spacing.sm + insets.bottom }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
