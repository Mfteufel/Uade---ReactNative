import { FlatList, StyleSheet, View } from 'react-native';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import MyPublicationCard from '../../components/MyPublicationCard';
import SkeletonCard from '../../components/SkeletonCard';
import useMyPublications from '../../hooks/useMyPublications';
import { colors, spacing } from '../../constants/theme';

export default function MyPublicationsScreen({ navigation }) {
  const { publications, loading, error, offlineCopy, isOnline, refresh, renew, renewingId, discard } = useMyPublications();

  let offlineText = '';
  if (offlineCopy?.savedAt) {
    offlineText = 'Dispositivo sin conexión, mostrando la última copia de tus publicaciones. La información puede no estar actualizada.';
  } else if (offlineCopy) {
    offlineText = 'Dispositivo sin conexión, todavía no hay publicaciones guardadas.';
  }

  return (
    <View style={styles.container}>
      {/* Aviso sin conexión pegado al encabezado, a todo el ancho. */}
      {offlineText ? <Banner kind="offline" message={offlineText} /> : null}

      {error ? (
        <View style={styles.errorBox}>
          <Banner kind="warn" message={error} />
          <Button variant="link" title="Reintentar" onPress={refresh} loading={loading} />
        </View>
      ) : null}

      {loading && publications.length === 0 && !error ? (
        <View style={styles.list}>
          <SkeletonCard count={3} />
        </View>
      ) : (
        <FlatList
          data={publications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MyPublicationCard
              publication={item}
              onPress={(publicationId) => navigation.navigate('PublicationDetail', { publicationId })}
              onRenew={renew}
              renewing={renewingId === item.id}
              onDiscard={discard}
              offline={!isOnline}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={refresh}
          ListEmptyComponent={
            error || (offlineCopy && !offlineCopy.savedAt) ? null : (
              <EmptyState
                icon="list"
                title="Todavía no publicaste nada."
                message="Cuando publiques algo que perdiste o encontraste, va a aparecer acá."
              />
            )
          }
        />
      )}

      <BottomActionBar>
        <Button title="Nueva publicación" onPress={() => navigation.navigate('Publish')} />
      </BottomActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  list: { padding: spacing.screen },
  errorBox: { margin: spacing.screen, marginBottom: 0 },
});
