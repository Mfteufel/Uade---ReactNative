import { FlatList, StyleSheet, View } from 'react-native';
import Banner from '../../components/Banner';
import Button from '../../components/Button';
import ClaimCard from '../../components/ClaimCard';
import EmptyState from '../../components/EmptyState';
import SegmentedTabs from '../../components/SegmentedTabs';
import SkeletonCard from '../../components/SkeletonCard';
import useMyClaims from '../../hooks/useMyClaims';
import { colors, spacing } from '../../constants/theme';

const TABS = [
  { key: 'sent', label: 'Enviados' },
  { key: 'received', label: 'Recibidos' },
];

const EMPTY_TEXT = {
  sent: 'Todavía no enviaste ningún reclamo.',
  received: 'Todavía no recibiste reclamos en tus publicaciones.',
};

export default function MyClaimsScreen({ navigation }) {
  const { tab, setTab, claims, loading, error, load } = useMyClaims();

  return (
    <View style={styles.container}>
      {/* Pegados al encabezado azul (que en esta pestaña va sin sombra). Sin contador: el hook devuelve una sola lista. */}
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {error ? (
        <View style={styles.errorBox}>
          <Banner kind="warn" message={error} />
          <Button variant="link" title="Reintentar" onPress={load} loading={loading} />
        </View>
      ) : null}

      {loading && claims.length === 0 && !error ? (
        <View style={styles.list}>
          <SkeletonCard count={3} />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(claim) => claim.id}
          renderItem={({ item }) => (
            <ClaimCard claim={item} onPress={() => navigation.navigate('ClaimDetail', { claimId: item.id })} />
          )}
          ListEmptyComponent={error ? null : <EmptyState icon="list" title={EMPTY_TEXT[tab]} />}
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
});
