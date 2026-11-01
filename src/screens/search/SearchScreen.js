import { ScrollView, StyleSheet, View } from 'react-native';
import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import SearchFields from '../../components/SearchFields';
import SectionTitle from '../../components/SectionTitle';
import useSearchScreen from '../../hooks/useSearchScreen';
import { colors, spacing } from '../../constants/theme';
import { describeSearch } from '../../utils/formatSearch';

const MAX_RECENT_LABEL = 44; // las búsquedas largas se cortan en el chip (el texto completo va en la descripción)

const shorten = (text) => (text.length > MAX_RECENT_LABEL ? `${text.slice(0, MAX_RECENT_LABEL - 1)}…` : text);

// Pantalla de inicio: buscador guiado en una sola tarjeta (qué te pasó, qué es, dónde, cuándo) y búsquedas recientes.
// El encabezado alto con el subtítulo lo da MainTabs. "Buscar" va al pie de la tarjeta (es raíz de pestaña).
export default function SearchScreen({ navigation }) {
  const { filters, recents, recentsError, loadRecents, error, onSearch, onRepeat } = useSearchScreen(navigation);
  const hasSituation = Boolean(filters.values.situacion);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card>
        <SearchFields filters={filters} />

        {error ? <Banner kind="warn" message={error} style={styles.banner} /> : null}
        <Button
          title="Buscar"
          onPress={onSearch}
          disabled={!hasSituation}
          disabledReason={hasSituation ? undefined : 'Elegí qué te pasó para empezar.'}
        />
      </Card>

      {recentsError ? (
        <View style={styles.recents}>
          <Banner kind="warn" message={recentsError} />
          <Button variant="link" title="Reintentar" onPress={loadRecents} />
        </View>
      ) : recents.length > 0 ? (
        <View style={styles.recents}>
          <SectionTitle title="Búsquedas recientes" />
          <View style={styles.chips}>
            {recents.map((recent) => {
              const text = describeSearch(recent, filters.categories, filters.neighborhoods);
              return (
                <Chip
                  key={recent.id}
                  variant="history"
                  label={shorten(text)}
                  accessibilityLabel={`Repetir la búsqueda: ${text}`}
                  onPress={() => onRepeat(recent)}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.screen, backgroundColor: colors.surface, flexGrow: 1 },
  banner: { marginBottom: spacing.md },
  recents: { marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
