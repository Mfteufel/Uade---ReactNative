import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import MyPublicationCard from '../../components/MyPublicationCard';
import useMyPublications from '../../hooks/useMyPublications';
import { colors, spacing } from '../../constants/theme';

export default function MyPublicationsScreen({ navigation }) {
  const { publications, loading, error, load, renew, renewingId } = useMyPublications();

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button variant="link" title="Reintentar" onPress={load} loading={loading} />
        </View>
      ) : null}

      {loading && publications.length === 0 && !error ? (
        <ActivityIndicator style={styles.center} size="large" />
      ) : (
        <FlatList
          data={publications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MyPublicationCard publication={item} onRenew={renew} renewing={renewingId === item.id} />
          )}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            error ? null : <Text style={styles.empty}>Todavía no publicaste nada.</Text>
          }
          ListHeaderComponent={
            <View style={styles.header}>
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
