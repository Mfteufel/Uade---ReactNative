import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Avatar from '../../components/Avatar';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import StateTag from '../../components/StateTag';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { getPublication } from '../../services/publicationDetailApi';
import { followPublication, unfollowPublication } from '../../services/followsApi';
import { getViewed, saveViewed } from '../../services/viewedPublications';
import { getErrorMessage, isNetworkError } from '../../services/errors';
import { useNovedades } from '../../context/NovedadesContext';
import { showOfflineToast } from '../../utils/offlineToast';
import { formatApiDate } from '../../utils/dates';
import { PUBLICATION_STATUS, TIME_SLOTS } from '../../constants/publications';
import { colors, radius, spacing, typography } from '../../constants/theme';

// Nombre de la franja horaria según desde/hasta que guarda la API; si no coincide con una franja, el rango escrito.
function timeSlotText(timeFrom, timeTo) {
  if (!timeFrom || !timeTo) return '';
  const slot = TIME_SLOTS.find((s) => s.timeFrom === timeFrom && s.timeTo === timeTo);
  return slot ? slot.name : `de ${timeFrom} a ${timeTo} h`;
}

// Un dato en una tarjetita (ícono, etiqueta y valor). Van de a dos por fila; `wide` ocupa todo el ancho.
function InfoTile({ icon, label, value, wide = false }) {
  return (
    <View style={wide ? [styles.tile, styles.tileWide] : styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.tileHeader}>
        <Icon name={icon} size={20} color={colors.blue600} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

export default function PublicationDetailScreen({ route, navigation }) {
  const { publicationId } = route.params;
  const { width } = useWindowDimensions();
  const photoWidth = width - spacing.screen * 2;
  const [publication, setPublication] = useState(null);
  const [error, setError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const { recargar } = useNovedades();

  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [savedAt, setSavedAt] = useState(null); // con valor: se muestra la copia guardada en el celular
  const [missingOffline, setMissingOffline] = useState(false); // sin conexión y sin copia guardada

  // Se recarga cada vez que la pantalla vuelve a verse (por ejemplo, después de reclamar) y cuando vuelve la conexión.
  // Sin conexión se usa la copia guardada, si ya se había abierto antes.
  const load = useCallback(() => {
    const showSaved = async () => {
      const saved = await getViewed(user.id, publicationId);
      if (saved) {
        setPublication(saved.publication);
        setSavedAt(saved.savedAt);
      } else {
        setMissingOffline(true);
      }
    };
    setError('');
    if (!isOnline) {
      showSaved();
      return;
    }
    getPublication(publicationId)
      .then((p) => {
        setPublication(p);
        setSavedAt(null);
        setMissingOffline(false);
        setError('');
        saveViewed(user.id, p);
      })
      .catch((e) => (isNetworkError(e) ? showSaved() : setError(getErrorMessage(e))));
  }, [publicationId, user.id, isOnline]);

  useFocusEffect(load);

  if (missingOffline && !publication) {
    return (
      <View style={styles.screen}>
        <Banner kind="offline" message="Dispositivo sin conexión, no se puede acceder al detalle." />
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Banner kind="warn" message={error} />
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }
  if (!publication) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={colors.blue600} accessibilityLabel="Cargando publicación" />
      </View>
    );
  }

  async function toggleFollow() {
    if (saving) return;
    setSaving(true);
    try {
      if (publication.isFollowing) await unfollowPublication(publication.id);
      else await followPublication(publication.id);
      setPublication({ ...publication, isFollowing: !publication.isFollowing });
      recargar(); // "Seguidas" se actualiza ahora, sin esperar al próximo polling
    } catch (e) {
      Alert.alert('No se pudo', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function renderPhotos() {
    const photos = publication.photoUrls;
    if (photos.length === 0) return <Text style={styles.muted}>Sin fotos.</Text>;
    return (
      <View>
        <Image
          source={{ uri: photos[photoIndex] }}
          style={[styles.photo, { width: photoWidth, height: photoWidth * 0.75 }]}
          accessibilityLabel={`Foto ${photoIndex + 1} de ${photos.length}`}
          accessibilityIgnoresInvertColors
        />
        {photos.length > 1 && (
          <>
            <Text style={styles.photoCount}>
              {photoIndex + 1} de {photos.length}
            </Text>
            <View style={styles.thumbs}>
              {photos.map((url, index) => (
                <Pressable
                  key={url}
                  onPress={() => setPhotoIndex(index)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver foto ${index + 1} de ${photos.length}`}
                  accessibilityState={{ selected: index === photoIndex }}
                >
                  <Image
                    source={{ uri: url }}
                    style={index === photoIndex ? styles.thumbSelected : styles.thumb}
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    );
  }

  function renderData() {
    const status = PUBLICATION_STATUS[publication.status];
    const slot = timeSlotText(publication.timeFrom, publication.timeTo);
    return (
      <View>
        <Text style={styles.title} accessibilityRole="header">
          {publication.title}
        </Text>
        {status ? <StateTag label={status.label} fg={status.color} bg={status.bg} /> : null}
        {publication.description ? <Text style={styles.description}>{publication.description}</Text> : null}
        <View style={styles.grid}>
          <InfoTile icon="search" label="Tipo" value={publication.type === 'found' ? 'Encontrado' : 'Perdido'} />
          <InfoTile icon="tag" label="Categoría" value={publication.category.name} />
          <InfoTile icon="location" label="Barrio" value={publication.neighborhood.name} />
          <InfoTile icon="calendar" label="Fecha" value={formatApiDate(publication.occurredOn)} />
          {slot ? <InfoTile icon="clock" label="Franja horaria" value={slot} wide /> : null}
          {publication.exactAddress ? <InfoTile icon="pin" label="Dirección" value={publication.exactAddress} wide /> : null}
        </View>
        {!publication.exactAddress && !publication.isOwner && (
          <Banner kind="info" message="La dirección exacta se muestra recién cuando se acepta un reclamo." />
        )}
      </View>
    );
  }

  function renderPublisher() {
    const { publisher } = publication;
    const { reputation } = publisher;
    const percent = reputation.positivePercent === null ? '' : ` · ${reputation.positivePercent}% positivas`;
    const summary = `${reputation.points} puntos · ${reputation.completedReturns} devoluciones${percent}`;
    return (
      <Card
        onPress={() => navigation.navigate('PublicProfile', { userId: publisher.id })}
        accessibilityLabel={`Publicado por ${publisher.name}. ${summary}. Ver perfil público`}
      >
        <View style={styles.publisher}>
          <Avatar uri={publisher.photoUri} name={publisher.name} size={48} />
          <View style={styles.publisherTexts}>
            <Text style={styles.publisherName}>Publicado por {publisher.name}</Text>
            <Text style={styles.publisherMeta}>{summary}</Text>
          </View>
          <Icon name="chevron" size={20} color={colors.textDim} />
        </View>
      </Card>
    );
  }

  // Barra de acción fija: el dueño ve «Gestionar mis publicaciones»; un tercero, el reclamo (solo si está abierta) y seguir.
  function renderActionBar() {
    if (publication.isOwner) {
      return (
        <BottomActionBar>
          <Button title="Gestionar mis publicaciones" onPress={() => navigation.navigate('MyPublications')} />
        </BottomActionBar>
      );
    }
    const follow = (
      <Button
        key="seguir"
        variant="secondary"
        title={saving ? 'Guardando…' : publication.isFollowing ? 'Siguiendo' : 'Seguir'}
        dimmed={!isOnline}
        style={styles.compact}
        accessibilityLabel={publication.isFollowing ? 'Siguiendo. Tocá para dejar de seguir' : 'Seguir publicación'}
        onPress={isOnline ? toggleFollow : () => showOfflineToast()}
      />
    );
    if (publication.status !== 'open') return <BottomActionBar>{follow}</BottomActionBar>;
    return (
      <BottomActionBar>
        {follow}
        <Button
          key="reclamar"
          title={publication.type === 'found' ? 'Es mío' : 'Lo encontré'}
          dimmed={!isOnline}
          onPress={() =>
            isOnline ? navigation.navigate('ClaimForm', { publicationId: publication.id }) : showOfflineToast()
          }
        />
      </BottomActionBar>
    );
  }

  return (
    <View style={styles.screen}>
      {savedAt && <Banner kind="offline" message="Dispositivo sin conexión, la información puede no estar actualizada." />}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.block}>{renderPhotos()}</View>
        <View style={styles.block}>{renderData()}</View>
        <View style={styles.block}>{renderPublisher()}</View>
      </ScrollView>
      {renderActionBar()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { justifyContent: 'center', padding: spacing.screen },
  content: { paddingHorizontal: spacing.screen, paddingVertical: spacing.sm },
  block: { paddingVertical: spacing.sm },
  photo: { borderRadius: radius.card, backgroundColor: colors.surface },
  photoCount: { ...typography.meta, color: colors.textDim, marginTop: spacing.sm },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: radius.thumb, marginRight: spacing.sm, opacity: 0.6 },
  thumbSelected: {
    width: 56,
    height: 56,
    borderRadius: radius.thumb,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: colors.blue600,
  },
  title: { ...typography.titleBar, color: colors.text, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  tile: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.ms,
    marginBottom: spacing.ms,
  },
  tileWide: { width: '100%' },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tileLabel: { ...typography.caption, color: colors.textDim },
  tileValue: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.xs },
  description: { ...typography.body, color: colors.text, marginTop: spacing.ms },
  muted: { ...typography.body, color: colors.textDim },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  publisherTexts: { flex: 1 },
  publisherName: { ...typography.bodyStrong, color: colors.text },
  publisherMeta: { ...typography.meta, color: colors.textDim },
  compact: { paddingHorizontal: spacing.sm },
});
