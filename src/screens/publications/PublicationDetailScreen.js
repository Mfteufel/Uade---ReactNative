import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import OfflineNotice from '../../components/OfflineNotice';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { getPublication } from '../../services/publicationDetailApi';
import { followPublication, unfollowPublication } from '../../services/followsApi';
import { getViewed, saveViewed } from '../../services/viewedPublications';
import { getErrorMessage, isNetworkError } from '../../services/errors';
import { showOfflineToast } from '../../utils/offlineToast';
import { PUBLICATION_STATUS } from '../../constants/publications';
import { colors, spacing } from '../../constants/theme';

const PHOTO_WIDTH = Dimensions.get('window').width - spacing.md * 2;

// La pantalla es una lista de bloques: así scrollea con FlatList.
const BLOCKS = ['fotos', 'datos', 'publicador', 'acciones'];

// '2026-10-24' -> '24/10/2026'
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export default function PublicationDetailScreen({ route, navigation }) {
  const { publicationId } = route.params;
  const [publication, setPublication] = useState(null);
  const [error, setError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [savedAt, setSavedAt] = useState(null); // con valor: se muestra la copia guardada en el celular
  const [missingOffline, setMissingOffline] = useState(false); // sin conexión y sin copia guardada

  // Se recarga cada vez que la pantalla vuelve a verse (por ejemplo, después de reclamar) y cuando vuelve la conexión.
  // Sin conexión se usa la copia guardada, si ya se había abierto antes.
  useFocusEffect(
    useCallback(() => {
      const showSaved = async () => {
        const saved = await getViewed(user.id, publicationId);
        if (saved) {
          setPublication(saved.publication);
          setSavedAt(saved.savedAt);
        } else {
          setMissingOffline(true);
        }
      };
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
    }, [publicationId, user.id, isOnline])
  );

  if (missingOffline && !publication) {
    return (
      <View style={[styles.screen, styles.block]}>
        <OfflineNotice text="Dispositivo sin conexión, no se puede acceder al detalle." />
      </View>
    );
  }
  if (error) return <Text style={styles.message}>{error}</Text>;
  if (!publication) return <Text style={styles.message}>Cargando...</Text>;

  async function toggleFollow() {
    if (saving) return;
    setSaving(true);
    try {
      if (publication.isFollowing) await unfollowPublication(publication.id);
      else await followPublication(publication.id);
      setPublication({ ...publication, isFollowing: !publication.isFollowing });
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
        <Image source={{ uri: photos[photoIndex] }} style={styles.photo} />
        {photos.length > 1 && (
          <View style={styles.thumbs}>
            {photos.map((url, index) => (
              <TouchableOpacity key={url} onPress={() => setPhotoIndex(index)}>
                <Image source={{ uri: url }} style={index === photoIndex ? styles.thumbSelected : styles.thumb} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderData() {
    const status = PUBLICATION_STATUS[publication.status];
    const hours = publication.timeFrom && publication.timeTo ? `, de ${publication.timeFrom} a ${publication.timeTo} h` : '';
    return (
      <View>
        <Text style={styles.title}>{publication.title}</Text>
        <Text style={{ color: status.color, fontWeight: 'bold' }}>{status.label}</Text>
        <Text style={styles.text}>
          {publication.type === 'found' ? 'Encontrado' : 'Perdido'} · {publication.category.name}
        </Text>
        <Text style={styles.text}>Barrio: {publication.neighborhood.name}</Text>
        <Text style={styles.text}>Cuándo: {formatDate(publication.occurredOn)}{hours}</Text>
        {publication.description ? <Text style={styles.text}>{publication.description}</Text> : null}
        {publication.exactAddress ? <Text style={styles.text}>Dirección: {publication.exactAddress}</Text> : null}
        {!publication.exactAddress && !publication.isOwner && (
          <Text style={styles.muted}>La dirección exacta se muestra cuando se acepta tu reclamo.</Text>
        )}
      </View>
    );
  }

  function renderPublisher() {
    const { publisher } = publication;
    const { reputation } = publisher;
    const percent = reputation.positivePercent === null ? '' : ` · ${reputation.positivePercent}% positivas`;
    return (
      <View style={styles.card}>
        <Text style={styles.subtitle}>Publicado por {publisher.name}</Text>
        <Text style={styles.text}>
          {reputation.points} puntos · {reputation.completedReturns} devoluciones{percent}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: publisher.id })}>
          <Text style={styles.link}>Ver perfil público</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderActions() {
    if (publication.isOwner) {
      return (
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MyPublications')}>
          <Text style={styles.buttonText}>Gestionar mis publicaciones</Text>
        </TouchableOpacity>
      );
    }
    return (
      <View>
        {publication.status === 'open' && (
          <TouchableOpacity
            style={[styles.button, !isOnline && styles.disabled]}
            onPress={() =>
              isOnline ? navigation.navigate('ClaimForm', { publicationId: publication.id }) : showOfflineToast()
            }
          >
            <Text style={styles.buttonText}>{publication.type === 'found' ? 'Es mío' : 'Lo encontré'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.buttonOutline, !isOnline && styles.disabled]}
          onPress={isOnline ? toggleFollow : () => showOfflineToast()}
        >
          <Text style={styles.buttonOutlineText}>
            {saving ? 'Guardando...' : publication.isFollowing ? 'Dejar de seguir' : 'Seguir publicación'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderBlock = { fotos: renderPhotos, datos: renderData, publicador: renderPublisher, acciones: renderActions };

  return (
    <View style={styles.screen}>
      {savedAt && (
        <View style={styles.block}>
          <OfflineNotice text="Dispositivo sin conexión, la información puede no estar actualizada." />
        </View>
      )}
      <FlatList
        data={BLOCKS}
        keyExtractor={(block) => block}
        renderItem={({ item }) => <View style={styles.block}>{renderBlock[item]()}</View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  block: { paddingVertical: spacing.sm },
  message: { padding: spacing.md, color: colors.text },
  photo: { width: PHOTO_WIDTH, height: PHOTO_WIDTH * 0.75, borderRadius: 8, backgroundColor: colors.surface },
  thumbs: { flexDirection: 'row', marginTop: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: 6, marginRight: spacing.sm, opacity: 0.6 },
  thumbSelected: {
    width: 56,
    height: 56,
    borderRadius: 6,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  text: { fontSize: 15, color: colors.text, marginTop: spacing.xs },
  muted: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md },
  link: { color: colors.primary, fontWeight: 'bold', marginTop: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonOutlineText: { color: colors.primary, fontWeight: 'bold', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
