import { useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import Banner from '../../components/Banner';
import Button from '../../components/Button';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import SkeletonCard from '../../components/SkeletonCard';
import StateTag from '../../components/StateTag';
import { useNovedades } from '../../context/NovedadesContext';
import { markFollowSeen } from '../../services/followsApi';
import { PUBLICATION_STATUS } from '../../constants/publications';
import { colors, radius, spacing, typography } from '../../constants/theme';

const NEWS_LABEL = 'Cambió de estado';

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
    const label = [item.title, item.neighborhood.name, `Estado: ${status.label}`, item.tieneNovedad ? NEWS_LABEL : '']
      .filter(Boolean)
      .join('. ');

    return (
      <Card tight style={styles.card} onPress={() => openPublication(item)} accessibilityLabel={label}>
        <View style={styles.row}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.thumb} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.thumb, styles.noPhoto]}>
              <Icon name="image" size={32} color={colors.textDim} />
            </View>
          )}
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.category.name} · {item.neighborhood.name}
            </Text>
            <View style={styles.tag}>
              <StateTag label={status.label} fg={status.color} bg={status.bg} />
            </View>
            {item.tieneNovedad ? (
              <View style={styles.tag}>
                <StateTag label={NEWS_LABEL} fg={colors.accent800} bg={colors.warnSoft} />
              </View>
            ) : null}
          </View>
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
          data={seguidas}
          keyExtractor={(seguida) => seguida.id}
          renderItem={renderFollow}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="heart"
                title="Todavía no seguís ninguna publicación."
                message='En el detalle de una publicación, tocá "Seguir".'
              />
            )
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  list: { padding: spacing.screen },
  errorBox: { margin: spacing.screen, marginBottom: 0 },
  card: { marginBottom: spacing.ms },
  row: { flexDirection: 'row' },
  thumb: { width: 88, height: 88, borderRadius: radius.thumb, backgroundColor: colors.neutral200 },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: spacing.ms },
  title: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.meta, color: colors.textDim },
  tag: { marginTop: spacing.xs },
});
