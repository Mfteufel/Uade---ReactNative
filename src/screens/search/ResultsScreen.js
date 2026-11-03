import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import PublicationCard from '../../components/PublicationCard';
import SearchFiltersModal from '../../components/SearchFiltersModal';
import Sheet from '../../components/Sheet';
import SkeletonCard from '../../components/SkeletonCard';
import useSearchResults from '../../hooks/useSearchResults';
import { useNetwork } from '../../context/NetworkContext';
import { useNovedades } from '../../context/NovedadesContext';
import { createAlert } from '../../services/alertsApi';
import { getCategoriesCached } from '../../services/catalogApi';
import { getErrorMessage } from '../../services/errors';
import { colors, spacing, typography } from '../../constants/theme';
import { describeSearch } from '../../utils/formatSearch';
import { showOfflineToast } from '../../utils/offlineToast';
import { toAlertBody } from '../../utils/searchCriteria';

const soon = (what) => Alert.alert('Próximamente', what);

const ORDERS = [
  { key: 'recientes', label: 'Más recientes' },
  { key: 'cercanos', label: 'Más cercanos' },
];

// Opción de la hoja «Ordenar»: fila de 48 dp con tilde y la palabra cuando está elegida.
function OrderOption({ label, selected, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={styles.option}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected, disabled && styles.optionTextOff]}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={20} color={colors.blue600} /> : null}
    </Pressable>
  );
}

export default function ResultsScreen({ navigation, route }) {
  const {
    filters, items, hasMore, loading, loadingMore, refreshing, error, savedAt, canSortByDistance,
    applyFilters, setOrder, loadMore, refresh, retry,
  } = useSearchResults(route.params.filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const { isOnline } = useNetwork();
  const { recargar } = useNovedades();
  const [savingAlert, setSavingAlert] = useState(false);

  // Solo para escribir el nombre de la categoría en el resumen; si falla, el resumen la omite.
  useEffect(() => {
    let alive = true;
    getCategoriesCached().then((list) => alive && setCategories(list)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const openPublication = (item) => {
    // El detalle de publicación es del punto 4: hasta que exista su pantalla no hay a dónde ir.
    if (navigation.getState().routeNames.includes('PublicationDetail')) {
      navigation.navigate('PublicationDetail', { publicationId: item.id });
    } else {
      soon('El detalle de la publicación llega con el punto 4.');
    }
  };

  // Guarda los criterios actuales como alerta. La zona por ubicación no se guarda: solo el barrio.
  const saveAlert = async () => {
    if (savingAlert) return;
    if (!isOnline) return showOfflineToast();
    setSavingAlert(true);
    try {
      await createAlert(toAlertBody(filters));
      recargar();
      const noZone = filters.lat !== undefined && !filters.barrio ? ' La alerta no guarda la zona de tu ubicación.' : '';
      Alert.alert('Alerta guardada', `Vas a ver las publicaciones nuevas en Perfil > Mis alertas.${noZone}`);
    } catch (e) {
      Alert.alert('No se pudo guardar la alerta', getErrorMessage(e));
    } finally {
      setSavingAlert(false);
    }
  };

  const applyAndClose = (next) => {
    setFiltersOpen(false);
    applyFilters(next);
  };

  const chooseOrder = (orden) => {
    setOrderOpen(false);
    setOrder(orden);
  };

  // Resumen escrito de la búsqueda, sin total: la API no lo entrega (C11 del plan).
  const neighborhoods = filters.barrio ? [{ id: filters.barrio, name: filters.barrioName }] : [];
  const summary = describeSearch(filters, categories, neighborhoods);
  const orderLabel = (ORDERS.find((o) => o.key === filters.orden) || ORDERS[0]).label;
  const isPerdi = filters.situacion === 'perdi';

  const toolbar = (
    <View style={styles.toolbar}>
      <Text style={styles.summary} numberOfLines={2} accessibilityRole="header">{summary}</Text>
      <View style={styles.chips}>
        <Chip label="Filtros" onPress={() => setFiltersOpen(true)} accessibilityLabel="Filtros de la búsqueda" />
        <Chip label={orderLabel} onPress={() => setOrderOpen(true)} accessibilityLabel={`Ordenar: ${orderLabel}`} />
        {items.length > 0 ? (
          <Chip label="Guardar alerta" onPress={saveAlert} accessibilityLabel="Guardar esta búsqueda como alerta" />
        ) : null}
      </View>
    </View>
  );

  const errorActions = (
    <View style={styles.errorBox}>
      <Banner kind="warn" message={error} />
      <Button variant="link" title="Reintentar" onPress={retry} />
    </View>
  );

  let empty = null;
  if (loading) {
    empty = (
      <View>
        {filters.barrioName ? (
          <Text style={styles.searching} accessibilityLiveRegion="polite">Buscando en {filters.barrioName}…</Text>
        ) : null}
        <SkeletonCard count={3} />
      </View>
    );
  } else if (error) {
    empty = (
      <EmptyState
        icon="warning"
        title="No pudimos cargar los resultados"
        message={error}
        action={<Button title="Volver a intentar" onPress={retry} />}
        secondaryAction={<Button variant="secondary" title="Cambiar la búsqueda" onPress={() => navigation.goBack()} />}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon="search"
        title="No encontramos publicaciones con esos criterios."
        message="Probá con otros filtros o publicá lo tuyo para que otras personas lo vean."
        action={
          <Button
            variant="accent"
            title={isPerdi ? 'Publicar mi pérdida' : 'Publicar mi hallazgo'}
            onPress={() => navigation.navigate('Publish', { type: isPerdi ? 'lost' : 'found' })}
          />
        }
        secondaryAction={
          <Button
            variant="secondary"
            title="Guardar búsqueda como alerta"
            loading={savingAlert}
            loadingTitle="Guardando…"
            onPress={saveAlert}
          />
        }
      />
    );
  }

  const footer = error && items.length > 0 ? (
    errorActions
  ) : hasMore && items.length > 0 ? (
    <View style={styles.more}>
      <Button variant="secondary" title="Ver más" loading={loadingMore} loadingTitle="Cargando…" onPress={loadMore} />
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      {/* Aviso de datos guardados: pegado debajo del encabezado, igual que antes (solo con resultados guardados). */}
      {savedAt ? (
        <Banner
          kind="offline"
          message="Dispositivo sin conexión, mostrando los últimos resultados cargados. La información puede no estar actualizada."
        />
      ) : null}
      {toolbar}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <PublicationCard item={item} onPress={() => openPublication(item)} />
          </View>
        )}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        refreshing={refreshing}
        onRefresh={refresh}
        contentContainerStyle={styles.list}
      />
      <SearchFiltersModal visible={filtersOpen} current={filters} onApply={applyAndClose} onClose={() => setFiltersOpen(false)} />
      <Sheet visible={orderOpen} onClose={() => setOrderOpen(false)} title="Ordenar por">
        {ORDERS.map((o) => (
          <OrderOption
            key={o.key}
            label={o.label}
            selected={filters.orden === o.key}
            disabled={o.key === 'cercanos' && !canSortByDistance}
            onPress={() => chooseOrder(o.key)}
          />
        ))}
        {!canSortByDistance ? (
          <Text style={styles.hint}>Para ordenar por cercanía, elegí un barrio o usá tu ubicación en Filtros.</Text>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  toolbar: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.ms,
  },
  summary: { ...typography.bodyStrong, color: colors.text, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  list: { padding: spacing.screen, flexGrow: 1 },
  cardWrap: { marginBottom: spacing.ms },
  searching: { ...typography.body, color: colors.textDim, marginBottom: spacing.ms },
  more: { marginTop: spacing.xs },
  errorBox: { marginTop: spacing.ms },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { ...typography.body, color: colors.text },
  optionTextSelected: { color: colors.blue600, fontWeight: '500' },
  optionTextOff: { color: colors.textDim },
  hint: { ...typography.meta, color: colors.textDim, marginTop: spacing.xs, marginBottom: spacing.md },
});
