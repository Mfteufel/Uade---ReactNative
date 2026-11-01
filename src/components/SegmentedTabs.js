import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

// Segmentos pegados al encabezado, en el mismo azul. Alto 48.
// tabs: [{ key, label, count? }]; `count` es opcional y se muestra al lado del nombre.
// value: key del segmento activo. onChange(key): se llama al tocar otro segmento.
// Activo: texto blanco pleno + subrayado de 3 dp. Inactivo: blanco al 78 %.
export default function SegmentedTabs({ tabs = [], value, onChange }) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        const hasCount = t.count !== undefined && t.count !== null;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange && onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={hasCount ? `${t.label}, ${t.count}` : t.label}
            android_ripple={{ color: colors.blue800 }}
            style={styles.tab}
          >
            <View style={styles.labelRow}>
              <Text style={[styles.label, active ? styles.active : styles.inactive]} numberOfLines={1}>
                {t.label}
              </Text>
              {hasCount ? (
                <Text style={[styles.count, active ? styles.active : styles.inactive]}>{` ${t.count}`}</Text>
              ) : null}
            </View>
            <View style={[styles.underline, active && styles.underlineOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: colors.blue600 },
  tab: { flex: 1, height: 48, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.sm },
  labelRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  label: { ...typography.bodyStrong },
  count: { ...typography.meta },
  active: { color: colors.onPrimary },
  inactive: { color: colors.onPrimary, opacity: 0.78 },
  underline: { alignSelf: 'stretch', height: 3, backgroundColor: 'transparent' },
  underlineOn: { backgroundColor: colors.onPrimary },
});
