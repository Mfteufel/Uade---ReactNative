import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import ClaimCard from '../../components/ClaimCard';
import Input from '../../components/Input';
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
  const [testPublicationId, setTestPublicationId] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[styles.tab, tab === item.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* TEMPORAL (solo desarrollo): hasta que exista el detalle de publicación (punto 4) no hay
          desde dónde abrir el formulario. Se quita antes del PR. */}
      {__DEV__ ? (
        <View style={styles.devBox}>
          <Input label="DEV · ID de publicación a reclamar" value={testPublicationId} onChangeText={setTestPublicationId} autoCapitalize="none" />
          <Button
            variant="link"
            title="Abrir formulario de reclamo"
            disabled={!testPublicationId.trim()}
            onPress={() => navigation.navigate('ClaimForm', { publicationId: testPublicationId.trim() })}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button variant="link" title="Reintentar" onPress={load} loading={loading} />
        </View>
      ) : null}

      {loading && claims.length === 0 && !error ? (
        <ActivityIndicator style={styles.center} size="large" />
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(claim) => claim.id}
          renderItem={({ item }) => (
            <ClaimCard claim={item} onPress={() => navigation.navigate('ClaimDetail', { claimId: item.id })} />
          )}
          ListEmptyComponent={error ? null : <Text style={styles.empty}>{EMPTY_TEXT[tab]}</Text>}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', padding: spacing.md, paddingBottom: 0 },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: colors.border },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  list: { padding: spacing.md },
  center: { flex: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  devBox: { margin: spacing.md, marginBottom: 0, padding: spacing.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 8 },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: spacing.md, margin: spacing.md },
  errorText: { color: colors.error },
});
