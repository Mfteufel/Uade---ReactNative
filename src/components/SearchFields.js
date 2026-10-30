import { Pressable, StyleSheet, Text, View } from 'react-native';
import Banner from './Banner';
import Button from './Button';
import Chip from './Chip';
import Icon from './Icon';
import Input from './Input';
import NeighborhoodPicker from './NeighborhoodPicker';
import SectionTitle from './SectionTitle';
import { PERIODS, RADIUS_OPTIONS, SITUATIONS } from '../constants/search';
import { colors, radius, spacing, typography } from '../constants/theme';

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <SectionTitle title={title} style={styles.title} />
      {children}
    </View>
  );
}

// Opción grande de 48 dp (¿Qué te pasó?): dos por fila, con tilde y la palabra cuando está elegida.
function BigChoice({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      {selected ? <Icon name="check" size={16} color={colors.blue600} style={styles.choiceIcon} /> : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// Los pasos del buscador. `filters` es lo que devuelve useSearchFilters.
// Lo usan el buscador guiado y el modal "Filtros" de los resultados (mismas props en los dos).
export default function SearchFields({ filters, showSituation = true }) {
  const { values, set } = filters;
  const hasLocation = values.lat !== null && values.lng !== null;

  return (
    <View>
      {filters.catalogError ? (
        <View style={styles.errorBox}>
          <Banner kind="warn" message={filters.catalogError} />
          <Button variant="link" title="Reintentar" onPress={filters.reloadCatalogs} />
        </View>
      ) : null}

      {showSituation ? (
        <Section title="¿Qué te pasó?">
          <View style={styles.choices}>
            {SITUATIONS.map((s) => (
              <BigChoice key={s.key} label={s.label} selected={values.situacion === s.key} onPress={() => set({ situacion: s.key })} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="¿Qué es?">
        <View style={styles.row}>
          <Chip label="Cualquiera" selected={!values.categoria} onPress={() => set({ categoria: null })} />
          {filters.categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={values.categoria === c.id} onPress={() => set({ categoria: c.id })} />
          ))}
        </View>
        <Input
          label="Palabras clave (opcional)"
          value={values.q}
          onChangeText={(q) => set({ q })}
          placeholder="Ej: llavero de osito"
          maxLength={100}
        />
      </Section>

      <Section title="¿Dónde?">
        <NeighborhoodPicker
          label="Barrio"
          selected={values.barrio ? { id: values.barrio, name: values.barrioName } : null}
          search={filters.hoodSearch}
          onSearchChange={filters.setHoodSearch}
          suggestions={filters.suggestions}
          onSelect={filters.selectNeighborhood}
        />
        {values.barrio ? <Button variant="link" title="Quitar barrio" onPress={filters.clearNeighborhood} /> : null}

        <Text style={styles.or}>o</Text>
        <Pressable
          onPress={filters.useMyLocation}
          disabled={filters.locating}
          accessibilityRole="button"
          accessibilityLabel={hasLocation ? 'Ubicación actual cargada · actualizar' : 'Usar mi ubicación actual'}
          accessibilityState={{ disabled: filters.locating, busy: filters.locating }}
          style={({ pressed }) => [styles.locationField, pressed && styles.locationPressed]}
        >
          <Icon name="location" size={24} color={colors.blue600} />
          <Text style={styles.locationText}>
            {filters.locating ? 'Buscando tu ubicación…' : hasLocation ? 'Ubicación actual cargada · actualizar' : 'Usar mi ubicación actual'}
          </Text>
        </Pressable>
        {filters.locationError ? <Text style={styles.errorText}>{filters.locationError}</Text> : null}
        {hasLocation ? (
          <View>
            <Text style={styles.label}>Radio de búsqueda</Text>
            <View style={styles.row}>
              {RADIUS_OPTIONS.map((r) => (
                <Chip key={r.value} label={r.label} selected={values.radio === r.value} onPress={() => set({ radio: r.value })} />
              ))}
            </View>
            <Button variant="link" title="Quitar ubicación" onPress={filters.clearLocation} />
          </View>
        ) : null}
      </Section>

      <Section title="¿Cuándo?">
        <View style={styles.row}>
          {PERIODS.map((p) => (
            <Chip key={p.key || 'any'} label={p.label} selected={values.periodo === p.key} onPress={() => set({ periodo: p.key })} />
          ))}
        </View>
        {values.periodo === 'rango' ? (
          <View>
            <Input label="Desde" value={values.desde} onChangeText={(desde) => set({ desde })} placeholder="AAAA-MM-DD" autoCapitalize="none" maxLength={10} />
            <Input label="Hasta" value={values.hasta} onChangeText={(hasta) => set({ hasta })} placeholder="AAAA-MM-DD" autoCapitalize="none" maxLength={10} />
          </View>
        ) : null}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  title: { marginTop: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  choices: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  choiceSelected: { backgroundColor: colors.blue50, borderColor: colors.blue600, borderWidth: 1.5 },
  choiceIcon: { marginRight: spacing.xs },
  choiceText: { ...typography.body, color: colors.text },
  choiceTextSelected: { color: colors.blue600, fontWeight: '500' },
  label: { ...typography.caption, color: colors.textDim, marginVertical: spacing.sm },
  or: { ...typography.body, color: colors.textDim, textAlign: 'center', marginVertical: spacing.xs },
  locationField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  locationPressed: { backgroundColor: colors.blue50 },
  locationText: { ...typography.body, flex: 1, color: colors.blue600 },
  errorBox: { marginBottom: spacing.md },
  errorText: { ...typography.body, color: colors.danger, marginTop: spacing.sm },
});
