import { Children } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, spacing, typography } from '../constants/theme';

// Barra fija inferior (ActionBar). Máximo dos botones: con dos, el secundario va primero (izquierda,
// 104 a 120 dp fijos) y el primario después (derecha, flex 1); con uno, ocupa todo el ancho.
// Se ignoran los hijos a partir del tercero (un tercer botón baja a link dentro del scroll).
// note: texto opcional arriba de los botones (variante en columna).
// Ubicarla como último hijo de un contenedor flex: 1, fuera del ScrollView.
export default function BottomActionBar({ children, style, note }) {
  const insets = useSafeAreaInsets();
  const items = Children.toArray(children).slice(0, 2);
  const [first, second] = items;
  return (
    <View style={[styles.bar, { paddingBottom: spacing.ms + insets.bottom }, style]}>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={styles.row}>
        {second ? (
          <>
            <View style={styles.secondary}>{first}</View>
            <View style={styles.primary}>{second}</View>
          </>
        ) : first ? (
          <View style={styles.primary}>{first}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.sm,
    paddingTop: spacing.ms,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.bar,
  },
  note: { ...typography.meta, color: colors.textDim },
  row: { flexDirection: 'row', gap: spacing.sm },
  secondary: { minWidth: 104, maxWidth: 120 },
  primary: { flex: 1 },
});
