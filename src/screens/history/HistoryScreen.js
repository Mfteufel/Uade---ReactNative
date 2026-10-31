import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';
import Input from '../../components/Input';
import HistoryCard from '../../components/HistoryCard';
import RatingModal from '../../components/RatingModal';
import SegmentedTabs from '../../components/SegmentedTabs';
import Sheet from '../../components/Sheet';
import SkeletonCard from '../../components/SkeletonCard';
import ThanksModal from '../../components/ThanksModal';
import useHistory from '../../hooks/useHistory';
import { PUBLICATION_TYPES } from '../../constants/publications';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { HISTORY_TYPE_LABELS } from '../../utils/formatHistory';
import { dayRangeError } from '../../utils/searchCriteria';

const TABS = [
  { key: 'devolvi', label: 'Devolví' },
  { key: 'recupere', label: 'Recuperé' },
];

// "Mi historial": casos resueltos separados en "Devolví" y "Recuperé", con filtros de fechas, tipo y categoría
// en una hoja. 0 botones primarios en la pantalla (el de la hoja es «Aplicar fechas»).
export default function HistoryScreen({ navigation }) {
  const {
    rol, setRol, applied, draft, setDraft, filterError, categories, hasFilters,
    setTipo, setCategoria, applyDates, clearFilters,
    items, hasMore, loading, loadingMore, refreshing, error,
    loadMore, refresh, retry, updateItem,
  } = useHistory();
  const [rating, setRating] = useState(null); // devolución que se está valorando
  const [thanking, setThanking] = useState(null); // devolución que se está agradeciendo
  const [notice, setNotice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Los segmentos van pegados al encabezado azul: sin sombra debajo de él.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShadowVisible: false });
  }, [navigation]);

  // Aviso corto después de valorar o agradecer.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const openProfile = (userId) => navigation.navigate('PublicProfile', { userId });

  const onRated = (result) => {
    updateItem(rating.id, { canRate: false, myRating: { positive: result.positive, comment: result.comment } });
    setRating(null);
    setNotice('¡Gracias por tu valoración!');
  };

  const onThanked = () => {
    updateItem(thanking.id, { thanked: true, canThank: false });
    setThanking(null);
    setNotice('Agradecimiento publicado');
  };

  // Aplica las fechas con la validación del hook; la hoja se cierra solo si las fechas son válidas.
  const onApplyDates = () => {
    const problem = dayRangeError(draft.desde.trim(), draft.hasta.trim(), { required: false });
    applyDates();
    if (!problem) setFiltersOpen(false);
  };

  const errorBox = (
    <View style={styles.errorBox}>
      <Banner kind="warn" message={error} />
      <Button variant="link" title="Reintentar" onPress={retry} />
    </View>
  );

  // Nombra el filtro que deja la lista vacía.
  const culprits = [
    applied.desde || applied.hasta ? 'las fechas' : null,
    applied.tipo ? `el tipo «${HISTORY_TYPE_LABELS[applied.tipo]}»` : null,
    applied.categoria ? 'la categoría' : null,
  ].filter(Boolean);
  const emptyMessage = culprits.length > 0
    ? `Puede ser por ${culprits.join(', ')} que elegiste. Probá con «Limpiar filtros» en la hoja «Filtros».`
    : undefined;

  const empty = loading ? (
    <SkeletonCard count={3} />
  ) : error ? errorBox : (
    <EmptyState icon="history" title="Todavía no tenés devoluciones en esta sección." message={emptyMessage} />
  );

  const filtersBar = (
    <View style={styles.filtersBar}>
      <Chip
        label="Filtros"
        selected={hasFilters}
        onPress={() => setFiltersOpen(true)}
        accessibilityLabel={hasFilters ? 'Filtros, hay filtros aplicados' : 'Filtros'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SegmentedTabs tabs={TABS} value={rol} onChange={setRol} />
      {filtersBar}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HistoryCard item={item} onOpenProfile={openProfile} onRate={setRating} onThank={setThanking} />
        )}
        ListEmptyComponent={empty}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footer} color={colors.blue600} /> : error && items.length > 0 ? errorBox : null
        }
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={refresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>
      ) : null}

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        avoidKeyboard
        footer={<Button title="Aplicar fechas" onPress={onApplyDates} />}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View style={styles.dates}>
            <View style={[styles.dateField, styles.dateGap]}>
              <Input label="Desde" value={draft.desde} onChangeText={(desde) => setDraft({ ...draft, desde })} placeholder="AAAA-MM-DD" autoCapitalize="none" maxLength={10} />
            </View>
            <View style={styles.dateField}>
              <Input label="Hasta" value={draft.hasta} onChangeText={(hasta) => setDraft({ ...draft, hasta })} placeholder="AAAA-MM-DD" autoCapitalize="none" maxLength={10} />
            </View>
          </View>
          {filterError ? <Banner kind="warn" message={filterError} style={styles.filterError} /> : null}

          <Text style={styles.sheetLabel}>Tipo</Text>
          <View style={styles.chips}>
            {PUBLICATION_TYPES.map((t) => (
              <Chip key={t.id} label={HISTORY_TYPE_LABELS[t.id]} selected={applied.tipo === t.id} onPress={() => setTipo(t.id)} />
            ))}
          </View>
          {categories.length > 0 ? (
            <>
              <Text style={styles.sheetLabel}>Categoría</Text>
              <View style={styles.chips}>
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} selected={applied.categoria === c.id} onPress={() => setCategoria(c.id)} />
                ))}
              </View>
            </>
          ) : null}
          {hasFilters ? <Button variant="link" title="Limpiar filtros" onPress={clearFilters} style={styles.clear} /> : null}
        </ScrollView>
      </Sheet>

      {/* 409/422: el modal muestra el mensaje del servidor y el historial se recarga, porque el estado cambió. */}
      <RatingModal item={rating} onDone={onRated} onStale={refresh} onClose={() => setRating(null)} />
      <ThanksModal item={thanking} onDone={onThanked} onStale={refresh} onClose={() => setThanking(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  filtersBar: { flexDirection: 'row', paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  list: { padding: spacing.screen, flexGrow: 1 },
  dates: { flexDirection: 'row' },
  dateField: { flex: 1 },
  dateGap: { marginRight: spacing.sm },
  filterError: { marginBottom: spacing.md },
  sheetLabel: { ...typography.caption, color: colors.textDim, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  clear: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  footer: { marginVertical: spacing.md },
  errorBox: { marginTop: spacing.md },
  notice: {
    ...typography.body,
    position: 'absolute', left: spacing.screen, right: spacing.screen, bottom: spacing.lg,
    backgroundColor: colors.blue600, color: colors.onPrimary, textAlign: 'center',
    borderRadius: radius.button, padding: spacing.md, overflow: 'hidden',
  },
});
