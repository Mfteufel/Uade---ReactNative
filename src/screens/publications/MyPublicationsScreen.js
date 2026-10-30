import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import MyPublicationCard from '../../components/MyPublicationCard';
import OfflineNotice from '../../components/OfflineNotice';
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
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button variant="link" title="Reintentar" onPress={refresh} loading={loading} />
        </View>
      ) : null}

      {loading && publications.length === 0 && !error ? (
        <ActivityIndicator style={styles.center} size="large" />
      ) : (
        <FlatList
          data={publications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MyPublicationCard
              publication={item}
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
            error || (offlineCopy && !offlineCopy.savedAt) ? null : <Text style={styles.empty}>Todavía no publicaste nada.</Text>
          }
          ListHeaderComponent={
            <View style={styles.header}>
              {offlineText ? <OfflineNotice text={offlineText} /> : null}
              <Button title="Nueva publicación" onPress={() => navigation.navigate('Publish')} />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1 },
  list: { padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: spacing.md, margin: spacing.lg, marginBottom: 0 },
  errorText: { color: colors.error },
});
