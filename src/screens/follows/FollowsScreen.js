import { useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNovedades } from '../../context/NovedadesContext';
import { markFollowSeen } from '../../services/followsApi';
import { PUBLICATION_STATUS } from '../../constants/publications';
import { colors, spacing } from '../../constants/theme';

// Publicaciones que sigo. Las que cambiaron de estado desde la última vez que las vi vienen primero, marcadas.
export default function FollowsScreen({ navigation }) {
  const { seguidas, cargado, error, recargar } = useNovedades();

  // Al entrar se trae la lista al día, sin esperar al próximo polling.
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Abre el detalle. Si tenía novedad, ya la vio: se apaga la marca.
  function openPublication(item) {
    if (item.tieneNovedad) {
      markFollowSeen(item.id)
        .then(recargar)
        .catch(() => {});
    }
    navigation.navigate('PublicationDetail', { publicationId: item.id });
  }

  function renderFollow({ item }) {
    const status = PUBLICATION_STATUS[item.status];
    return (
      <TouchableOpacity style={styles.card} onPress={() => openPublication(item)}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.muted}>Sin foto</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={{ color: status.color, fontWeight: 'bold' }}>{status.label}</Text>
          <Text style={styles.muted}>
            {item.category.name} · {item.neighborhood.name}
          </Text>
          {item.tieneNovedad ? (
            <View style={styles.news}>
              <Text style={styles.newsText}>Cambió de estado</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
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
      {seguidas.length === 0 ? (
        <Text style={styles.message}>
          Todavía no seguís ninguna publicación. En el detalle de una publicación tocá "Seguir publicación".
        </Text>
      ) : (
        <FlatList data={seguidas} keyExtractor={(seguida) => seguida.id} renderItem={renderFollow} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  message: { color: colors.text, marginBottom: spacing.sm },
  error: { color: colors.error, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: 'bold' },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  photo: { width: 88, height: 88, borderRadius: 8, backgroundColor: colors.border },
  noPhoto: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.md },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, marginTop: spacing.xs },
  news: {
    alignSelf: 'flex-start',
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  newsText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});
