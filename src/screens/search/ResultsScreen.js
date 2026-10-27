import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import PublicationCard from '../../components/PublicationCard';
import SearchFiltersModal from '../../components/SearchFiltersModal';
import useSearchResults from '../../hooks/useSearchResults';
import { colors, spacing } from '../../constants/theme';

const soon = (what) => Alert.alert('Próximamente', what);

export default function ResultsScreen({ navigation, route }) {
  const {
    filters, items, hasMore, loading, loadingMore, refreshing, error, canSortByDistance,
    applyFilters, setOrder, loadMore, refresh, retry,
  } = useSearchResults(route.params.filters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const openPublication = (item) => {
    // El detalle de publicación es del punto 4: hasta que exista su pantalla no hay a dónde ir.
    if (navigation.getState().routeNames.includes('PublicationDetail')) {
      navigation.navigate('PublicationDetail', { publicationId: item.id });
    } else {
      soon('El detalle de la publicación llega con el punto 4.');
    }
  };

  const applyAndClose = (next) => {
    setFiltersOpen(false);
    applyFilters(next);
  };

  const header = (
    <View style={styles.toolbar}>
      <View style={styles.row}>
        <Chip label="Más recientes" selected={filters.orden === 'recientes'} onPress={() => setOrder('recientes')} />
        <Chip
          label="Más cercanos"
          selected={filters.orden === 'cercanos'}
          disabled={!canSortByDistance}
          onPress={() => setOrder('cercanos')}
        />
      </View>
      {!canSortByDistance ? <Text style={styles.hint}>Para ordenar por cercanía, elegí un barrio o usá tu ubicación en Filtros.</Text> : null}
      <Button variant="link" title="Filtros" onPress={() => setFiltersOpen(true)} />
    </View>
  );

  const empty = loading ? null : error ? (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
      <Button variant="link" title="Reintentar" onPress={retry} />
    </View>
  ) : (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No encontramos publicaciones con esos criterios.</Text>
      <Text style={styles.hint}>Probá con otros filtros o dejá todo listo para cuando aparezca algo.</Text>
      {/* TODO (punto 5): abrir el formulario de publicación en vez del aviso. */}
      <Button
        title={filters.situacion === 'perdi' ? 'Publicar mi pérdida' : 'Publicar mi hallazgo'}
        onPress={() => soon('Publicar llega con el punto 5.')}
      />
      {/* TODO (punto 9): crear una alerta con estos criterios en vez del aviso. */}
      <Button variant="link" title="Guardar como alerta" onPress={() => soon('Las alertas llegan con el punto 9.')} />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PublicationCard item={item} onPress={() => openPublication(item)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore || (loading && items.length === 0) ? (
            <ActivityIndicator style={styles.footer} />
          ) : error && items.length > 0 ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Button variant="link" title="Reintentar" onPress={retry} />
            </View>
          ) : null
        }
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={styles.list}
      />
      <SearchFiltersModal visible={filtersOpen} current={filters} onApply={applyAndClose} onClose={() => setFiltersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md },
  toolbar: { marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  footer: { marginVertical: spacing.md },
  empty: { alignItems: 'stretch', marginTop: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: spacing.md, marginTop: spacing.md },
  errorText: { color: colors.error },
});
