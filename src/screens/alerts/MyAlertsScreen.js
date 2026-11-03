import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import SkeletonCard from '../../components/SkeletonCard';
import StateTag from '../../components/StateTag';
import { useNetwork } from '../../context/NetworkContext';
import { useNovedades } from '../../context/NovedadesContext';
import { deleteAlert, markAlertSeen, setAlertPaused } from '../../services/alertsApi';
import { getErrorMessage } from '../../services/errors';
import { SITUATION_LABEL } from '../../constants/search';
import { colors, spacing, typography } from '../../constants/theme';
import { showOfflineToast } from '../../utils/offlineToast';
import { tipoToSituacion } from '../../utils/searchCriteria';

// "Perdí · Llaves · "osito" · Palermo", igual que las búsquedas recientes.
function describeAlert(alerta) {
  const parts = [SITUATION_LABEL[tipoToSituacion(alerta.tipo)]];
  if (alerta.categoria) parts.push(alerta.categoria.name);
  if (alerta.q) parts.push(`"${alerta.q}"`);
  if (alerta.barrio) parts.push(alerta.barrio.name);
  return parts.join(' · ');
}

// Alerta -> criterios del buscador, para abrir los resultados con la misma búsqueda.
function toFilters(alerta) {
  const filters = { situacion: tipoToSituacion(alerta.tipo) };
  if (alerta.categoria) filters.categoria = alerta.categoria.id;
  if (alerta.q) filters.q = alerta.q;
  if (alerta.barrio) {
    filters.barrio = alerta.barrio.id;
    filters.barrioName = alerta.barrio.name;
  }
  return filters;
}

export default function MyAlertsScreen({ navigation }) {
  const { alertas, cargado, error, recargar } = useNovedades();
  const { isOnline } = useNetwork();
  const [pausingId, setPausingId] = useState(null); // alerta que se está pausando o reanudando
  const [toDelete, setToDelete] = useState(null); // alerta que espera confirmación para eliminarse
  const [deleting, setDeleting] = useState(false);

  // Al entrar se trae la lista al día, sin esperar al próximo polling.
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Hace el pedido y recarga la lista (y los contadores). Si falla, avisa.
  async function change(request) {
    if (!isOnline) {
      showOfflineToast();
      return;
    }
    try {
      await request();
      await recargar();
    } catch (e) {
      Alert.alert('No se pudo', getErrorMessage(e));
    }
  }

  // Abre los resultados con los criterios de la alerta; sus publicaciones nuevas pasan a vistas.
  function see(alerta) {
    navigation.navigate('Results', { filters: toFilters(alerta) });
    markAlertSeen(alerta.id)
      .then(recargar)
      .catch(() => {});
  }

  async function togglePause(alerta) {
    if (pausingId) return;
    setPausingId(alerta.id);
    await change(() => setAlertPaused(alerta.id, !alerta.pausada));
    setPausingId(null);
  }

  async function confirmDelete() {
    setDeleting(true);
    await change(() => deleteAlert(toDelete.id));
    setDeleting(false);
    setToDelete(null);
  }

  function renderNews(alerta) {
    if (alerta.pausada) return <Text style={styles.meta}>Pausada: no avisa publicaciones nuevas.</Text>;
    if (alerta.cantidadNuevas === 0) return <Text style={styles.meta}>Sin publicaciones nuevas.</Text>;
    const label = alerta.cantidadNuevas === 1 ? '1 publicación nueva' : `${alerta.cantidadNuevas} publicaciones nuevas`;
    return <StateTag label={label} fg={colors.accent800} bg={colors.warnSoft} />;
  }

  function renderPauseTitle(alerta) {
    if (pausingId === alerta.id) return 'Guardando…';
    return alerta.pausada ? 'Reanudar' : 'Pausar';
  }

  function renderAlert({ item }) {
    return (
      <Card tight style={styles.card}>
        <Text style={styles.title}>{describeAlert(item)}</Text>
        <View style={styles.news}>{renderNews(item)}</View>
        <View style={styles.actions}>
          <Button variant="secondary" title="Ver" style={styles.see} onPress={() => see(item)} />
          <Button variant="link" title={renderPauseTitle(item)} dimmed={!isOnline} onPress={() => togglePause(item)} />
          <Button variant="link" title="Eliminar" dimmed={!isOnline} onPress={() => setToDelete(item)} />
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Banner kind="warn" message={error} />
          <Button variant="link" title="Reintentar" onPress={recargar} />
        </View>
      ) : null}

      {!cargado && !error ? (
        <View style={styles.list}>
          <SkeletonCard count={3} />
        </View>
      ) : (
        <FlatList
          data={alertas}
          keyExtractor={(alerta) => alerta.id}
          renderItem={renderAlert}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="search"
                title="Todavía no tenés alertas."
                message='Hacé una búsqueda y tocá "Guardar alerta" en los resultados.'
              />
            )
          }
          contentContainerStyle={styles.list}
        />
      )}

      <ConfirmDialog
        visible={toDelete !== null}
        title="¿Eliminar esta alerta?"
        message={toDelete ? `${describeAlert(toDelete)}. Dejás de recibir avisos de esta búsqueda.` : ''}
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        loadingLabel="Eliminando…"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  list: { padding: spacing.screen },
  errorBox: { margin: spacing.screen, marginBottom: 0 },
  card: { marginBottom: spacing.ms },
  title: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.meta, color: colors.textDim },
  news: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.ms },
  see: { flex: 1 },
});
