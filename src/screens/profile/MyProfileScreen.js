import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Banner from '../../components/Banner';
import BadgeList from '../../components/BadgeList';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ListRow from '../../components/ListRow';
import ReputationCard from '../../components/ReputationCard';
import SectionTitle from '../../components/SectionTitle';
import { USE_MOCK } from '../../config';
import { SAMPLE_USERS } from '../../constants/sampleUsers';
import { colors, radius, spacing, typography } from '../../constants/theme';
import useMyProfile from '../../hooks/useMyProfile';
import { formatMemberSince } from '../../utils/memberSince';

export default function MyProfileScreen({ navigation }) {
  const { user, loading, reputation, error, load } = useMyProfile();

  if (loading && !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.blue600} accessibilityLabel="Cargando tu perfil" />
      </View>
    );
  }

  // Antigüedad solo si el usuario la trae (memberSince, o createdAt que es lo que devuelve /me).
  const memberSince = user.memberSince || user.createdAt;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Banner kind="warn" message={error} />
          <Button variant="secondary" title="Reintentar" onPress={load} loading={loading} />
        </View>
      ) : null}

      <Card>
        <View style={styles.header}>
          <Avatar uri={user.photoUri} name={user.name} size={96} />
          <Text style={styles.name}>{user.name}</Text>
          {user.neighborhood ? <Text style={styles.meta}>{user.neighborhood}</Text> : null}
          {memberSince ? <Text style={styles.meta}>{formatMemberSince(memberSince)}</Text> : null}
        </View>

        {reputation ? (
          <>
            <ReputationCard reputation={reputation} />
            <BadgeList reputation={reputation} />
          </>
        ) : null}
      </Card>

      {/* Sin contadores: no hay dato real de cantidades. Previstas: Mis alertas, Seguidas (punto 9). */}
      <View style={styles.group}>
        <ListRow icon="list" title="Mis publicaciones" onPress={() => navigation.navigate('MyPublications')} />
        <ListRow icon="tag" title="Mis reclamos" onPress={() => navigation.navigate('MyClaims')} />
        <ListRow icon="history" title="Mi historial" onPress={() => navigation.navigate('History')} />
        <ListRow icon="edit" title="Editar perfil" onPress={() => navigation.navigate('EditProfile')} />
        <ListRow icon="eye" title="Cómo me ven otros" onPress={() => navigation.navigate('PublicProfile', { userId: user.id })} />
        <ListRow icon="settings" title="Configuración" last onPress={() => navigation.navigate('Settings')} />
      </View>

      {USE_MOCK ? (
        <View style={styles.samples}>
          <SectionTitle title="Perfiles de ejemplo (solo para probar)" />
          <View style={styles.group}>
            {SAMPLE_USERS.map((u, i) => (
              <ListRow
                key={u.id}
                icon="user"
                title={u.name}
                last={i === SAMPLE_USERS.length - 1}
                onPress={() => navigation.navigate('PublicProfile', { userId: u.id })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  container: { padding: spacing.screen, backgroundColor: colors.surface, flexGrow: 1 },
  header: { alignItems: 'center' },
  name: { ...typography.section, color: colors.text, marginTop: spacing.ms },
  meta: { ...typography.meta, color: colors.textDim },
  errorBox: { marginBottom: spacing.md },
  group: {
    marginTop: spacing.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  samples: { marginTop: spacing.md },
});
