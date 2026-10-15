import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import BadgeList from '../../components/BadgeList';
import Button from '../../components/Button';
import ReputationCard from '../../components/ReputationCard';
import { getPublicProfile } from '../../api/userApi';
import { getErrorMessage } from '../../api/errors';
import { formatMemberSince } from '../../utils/memberSince';
import { colors, spacing } from '../../constants/theme';

// Lo que ve otra persona: nombre, foto, reputación, insignias y antigüedad.
// No muestra teléfono ni historial (la API pública tampoco los devuelve).
export default function PublicProfileScreen({ route }) {
  const { userId } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfile(await getPublicProfile(userId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ActivityIndicator style={styles.center} size="large" />;

  if (error) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={styles.errorText}>{error}</Text>
        <Button variant="link" title="Reintentar" onPress={load} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Avatar uri={profile.photoUri} name={profile.name} size={110} />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.since}>{formatMemberSince(profile.memberSince)}</Text>
      </View>
      <ReputationCard reputation={profile.reputation} />
      <BadgeList reputation={profile.reputation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  container: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  header: { alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  since: { color: colors.muted, marginTop: 2 },
  errorBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: colors.error, textAlign: 'center' },
});
