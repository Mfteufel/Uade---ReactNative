import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import Input from '../../components/Input';
import HistoryCard from '../../components/HistoryCard';
import useHistory from '../../hooks/useHistory';
import { colors, spacing } from '../../constants/theme';

// "Mi historial": casos resueltos separados en "Devolví" y "Recuperé", con filtros de fechas y categoría.
export default function HistoryScreen({ navigation }) {
  const {
    rol, setRol, applied, draft, setDraft, filterError, categories, hasFilters,
    setCategoria, applyDates, clearFilters,
    items, hasMore, loading, loadingMore, refreshing, error,
    loadMore, refresh, retry,
  } = useHistory();

  const openProfile = (userId) => navigation.navigate('PublicProfile', { userId });

  const errorBox = (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
      <Button variant="link" title="Reintentar" onPress={retry} />
    </View>
  );

  const header = (
    <View style={styles.toolbar}>
      <View style={styles.row}>
        <Chip label="Devolví" selected={rol === 'devolvi'} onPress={() => setRol('devolvi')} />
        <Chip label="Recuperé" selected={rol === 'recupere'} onPress={() => setRol('recupere')} />
      </View>

      <View style={styles.dates}>
        <View style={styles.dateField}>
          <Input label="Desde" value={draft.desde} onChangeText={(desde) => setDraft({ ...draft, desde })} placeholder="AAAA-MM-DD" autoCapitalize="none" maxLength={10} />
        </View>
        <View style={styles.dateField}>
          <Input label="Hasta" value={draft.hasta} onChangeText={(hasta) => setDraft({ ...draft, hasta })} placeholder="AAAA-MM-DD" autoCapitalize="none" maxLength={10} />
        </View>
      </View>
      {filterError ? <Text style={styles.errorText}>{filterError}</Text> : null}
      <Button variant="link" title="Aplicar fechas" onPress={applyDates} />

      {categories.length > 0 ? (
        <View style={styles.row}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={applied.categoria === c.id} onPress={() => setCategoria(c.id)} />
          ))}
        </View>
      ) : null}
      {hasFilters ? <Button variant="link" title="Limpiar filtros" onPress={clearFilters} /> : null}
    </View>
  );

  const empty = loading ? null : error ? errorBox : (
    <Text style={styles.empty}>Todavía no tenés devoluciones en esta sección.</Text>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryCard item={item} onOpenProfile={openProfile} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore || (loading && items.length === 0) ? <ActivityIndicator style={styles.footer} /> : error && items.length > 0 ? errorBox : null
        }
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={refresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md },
  toolbar: { marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  dates: { flexDirection: 'row', marginTop: spacing.sm },
  dateField: { flex: 1, marginRight: spacing.sm },
  footer: { marginVertical: spacing.md },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: spacing.md, marginTop: spacing.md },
  errorText: { color: colors.error },
});
