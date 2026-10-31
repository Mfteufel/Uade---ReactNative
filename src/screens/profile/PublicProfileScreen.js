import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Banner from '../../components/Banner';
import BadgeList from '../../components/BadgeList';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ReputationCard from '../../components/ReputationCard';
import ThanksList from '../../components/ThanksList';
import { getPublicProfile } from '../../services/userApi';
import { getErrorMessage } from '../../services/errors';
import { formatMemberSince } from '../../utils/memberSince';
import { colors, spacing, typography } from '../../constants/theme';

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue600} accessibilityLabel="Cargando el perfil" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Banner kind="warn" message={error} style={styles.errorBanner} />
        <Button variant="secondary" title="Reintentar" onPress={load} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Banner kind="info" message="No mostramos el teléfono ni las publicaciones de otras personas." />

      <Card style={styles.card}>
        <View style={styles.header}>
          <Avatar uri={profile.photoUri} name={profile.name} size={96} />
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.since}>{formatMemberSince(profile.memberSince)}</Text>
        </View>
        <ReputationCard reputation={profile.reputation} />
        <BadgeList reputation={profile.reputation} />
      </Card>

      <ThanksList thanks={profile.thanks} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  container: { padding: spacing.screen, backgroundColor: colors.surface, flexGrow: 1 },
  card: { marginTop: spacing.md },
  header: { alignItems: 'center' },
  name: { ...typography.section, color: colors.text, marginTop: spacing.ms },
  since: { ...typography.meta, color: colors.textDim },
  errorBox: { padding: spacing.screen },
  errorBanner: { alignSelf: 'stretch', marginBottom: spacing.md },
});
