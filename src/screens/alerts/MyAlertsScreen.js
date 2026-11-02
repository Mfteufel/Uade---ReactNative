import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNetwork } from '../../context/NetworkContext';
import { useNovedades } from '../../context/NovedadesContext';
import { deleteAlert, markAlertSeen, setAlertPaused } from '../../services/alertsApi';
import { getErrorMessage } from '../../services/errors';
import { SITUATION_LABEL } from '../../constants/search';
import { colors, spacing } from '../../constants/theme';
import { showOfflineToast } from '../../utils/offlineToast';
import { tipoToSituacion } from '../../utils/searchCriteria';

// Desde la app las alertas siempre se guardan con tipo. Si alguna no lo tiene (datos de ejemplo), se abre como "Perdí".
const situacionDe = (alerta) => (alerta.tipo ? tipoToSituacion(alerta.tipo) : 'perdi');

// "Perdí · Llaves · "osito" · Palermo", igual que las búsquedas recientes.
function describeAlert(alerta) {
  const parts = [alerta.tipo ? SITUATION_LABEL[situacionDe(alerta)] : 'Perdí o encontré'];
  if (alerta.categoria) parts.push(alerta.categoria.name);
  if (alerta.q) parts.push(`"${alerta.q}"`);
  if (alerta.barrio) parts.push(alerta.barrio.name);
  return parts.join(' · ');
}

// Alerta -> criterios del buscador, para abrir los resultados con la misma búsqueda.
function toFilters(alerta) {
  const filters = { situacion: situacionDe(alerta) };
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
  const [busyId, setBusyId] = useState(null); // alerta con un pedido en curso
  const [confirmId, setConfirmId] = useState(null); // alerta que espera confirmación para eliminarse

  // Al entrar se trae la lista al día, sin esperar al próximo polling.
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Hace el pedido y recarga la lista (y los contadores). Si falla, avisa.
  async function change(id, request) {
    if (busyId) return;
    if (!isOnline) return showOfflineToast();
    setBusyId(id);
    try {
      await request();
      await recargar();
    } catch (e) {
      Alert.alert('No se pudo', getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  // Abre los resultados con los criterios de la alerta; sus publicaciones nuevas pasan a vistas.
  function see(alerta) {
    navigation.navigate('Results', { filters: toFilters(alerta) });
    markAlertSeen(alerta.id)
      .then(recargar)
      .catch(() => {});
  }

  function askRemove(alerta) {
    if (busyId) return;
    setConfirmId(alerta.id);
  }

  function remove(alerta) {
    setConfirmId(null);
    change(alerta.id, () => deleteAlert(alerta.id));
  }

  function renderNews(alerta) {
    if (alerta.pausada) return <Text style={styles.muted}>Pausada: no avisa publicaciones nuevas.</Text>;
    if (alerta.cantidadNuevas === 0) return <Text style={styles.muted}>Sin publicaciones nuevas.</Text>;
    const text = alerta.cantidadNuevas === 1 ? '1 publicación nueva' : `${alerta.cantidadNuevas} publicaciones nuevas`;
    return (
      <View style={styles.news}>
        <Text style={styles.newsText}>{text}</Text>
      </View>
    );
  }

  // Eliminar pide confirmación en la misma tarjeta.
  function renderButtons(alerta) {
    const busy = busyId === alerta.id;
    if (confirmId === alerta.id) {
      return (
        <View>
          <Text style={styles.text}>¿Eliminar esta alerta?</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.danger} onPress={() => remove(alerta)}>
              <Text style={styles.dangerText}>Sí, eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outline} onPress={() => setConfirmId(null)}>
              <Text style={styles.outlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={() => see(alerta)}>
          <Text style={styles.buttonText}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outline}
          onPress={() => change(alerta.id, () => setAlertPaused(alerta.id, !alerta.pausada))}
        >
          <Text style={styles.outlineText}>{busy ? 'Guardando...' : alerta.pausada ? 'Reanudar' : 'Pausar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outline} onPress={() => askRemove(alerta)}>
          <Text style={styles.outlineText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!cargado) {
    return (
      <View style={styles.screen}>
        <Text style={styles.message}>{error || 'Cargando...'}</Text>
        {error ? (
          <TouchableOpacity onPress={recargar}>
            <Text style={styles.link}>Reintentar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {alertas.length === 0 ? (
        <Text style={styles.message}>
          Todavía no tenés alertas. Hacé una búsqueda y tocá "Guardar como alerta" en los resultados.
        </Text>
      ) : (
        <FlatList
          data={alertas}
          keyExtractor={(alerta) => alerta.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{describeAlert(item)}</Text>
              {renderNews(item)}
              {renderButtons(item)}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  message: { color: colors.text, marginBottom: spacing.sm },
  error: { color: colors.error, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: 'bold' },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  text: { fontSize: 15, color: colors.text, marginTop: spacing.sm },
  muted: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  news: {
    alignSelf: 'flex-start',
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  newsText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold' },
  outline: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  outlineText: { color: colors.primary, fontWeight: 'bold' },
  danger: {
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  dangerText: { color: '#FFFFFF', fontWeight: 'bold' },
});
