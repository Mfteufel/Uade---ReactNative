import { StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import Chip from './Chip';
import Input from './Input';
import NeighborhoodPicker from './NeighborhoodPicker';
import { PERIODS, RADIUS_OPTIONS, SITUATIONS } from '../constants/search';
import { colors, spacing } from '../constants/theme';

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

// Los pasos del buscador. `filters` es lo que devuelve useSearchFilters.
// Lo usan el buscador guiado y el modal "Filtros" de los resultados.
export default function SearchFields({ filters, showSituation = true }) {
  const { values, set } = filters;
  const hasLocation = values.lat !== null && values.lng !== null;

  return (
    <View>
      {filters.catalogError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{filters.catalogError}</Text>
          <Button variant="link" title="Reintentar" onPress={filters.reloadCatalogs} />
        </View>
      ) : null}

      {showSituation ? (
        <Section title="¿Qué te pasó?">
          <View style={styles.row}>
            {SITUATIONS.map((s) => (
              <Chip key={s.key} label={s.label} selected={values.situacion === s.key} onPress={() => set({ situacion: s.key })} />
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
        <Button
          variant="link"
          title={hasLocation ? 'Ubicación actual cargada · actualizar' : 'Usar mi ubicación'}
          onPress={filters.useMyLocation}
          loading={filters.locating}
        />
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
  section: { marginBottom: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { color: colors.text, fontWeight: '500', marginVertical: spacing.sm },
  or: { color: colors.muted, textAlign: 'center', marginVertical: spacing.xs },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error },
});
