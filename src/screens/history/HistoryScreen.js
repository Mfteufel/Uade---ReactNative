import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import Input from '../../components/Input';
import HistoryCard from '../../components/HistoryCard';
import RatingModal from '../../components/RatingModal';
import ThanksModal from '../../components/ThanksModal';
import useHistory from '../../hooks/useHistory';
import { PUBLICATION_TYPES } from '../../constants/publications';
import { colors, spacing } from '../../constants/theme';
import { HISTORY_TYPE_LABELS } from '../../utils/formatHistory';

// "Mi historial": casos resueltos separados en "Devolví" y "Recuperé", con filtros de fechas, tipo y categoría.
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

      <View style={styles.row}>
        {PUBLICATION_TYPES.map((t) => (
          <Chip key={t.id} label={HISTORY_TYPE_LABELS[t.id]} selected={applied.tipo === t.id} onPress={() => setTipo(t.id)} />
        ))}
      </View>
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
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HistoryCard item={item} onOpenProfile={openProfile} onRate={setRating} onThank={setThanking} />
        )}
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
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {/* 409/422: el modal muestra el mensaje del servidor y el historial se recarga, porque el estado cambió. */}
      <RatingModal item={rating} onDone={onRated} onStale={refresh} onClose={() => setRating(null)} />
      <ThanksModal item={thanking} onDone={onThanked} onStale={refresh} onClose={() => setThanking(null)} />
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
  notice: {
    position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.lg,
    backgroundColor: colors.primary, color: '#fff', textAlign: 'center', fontWeight: '600',
    borderRadius: 8, padding: spacing.md, overflow: 'hidden',
  },
});
