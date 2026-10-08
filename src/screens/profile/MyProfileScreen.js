import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { getMe, getReputation } from '../../api/userApi';
import BadgeList from '../../components/BadgeList';
import ReputationCard from '../../components/ReputationCard';
import { SAMPLE_USERS } from '../../constants/sampleUsers';
import { getErrorMessage } from '../../api/errors';
import { colors, spacing } from '../../constants/theme';

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Sin completar'}</Text>
    </View>
  );
}

export default function MyProfileScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await getMe();
      setUser(me);
      setReputation(await getReputation(me.id));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !user) return <ActivityIndicator style={styles.center} size="large" />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button variant="link" title="Reintentar" onPress={load} loading={loading} />
        </View>
      ) : null}

      <View style={styles.header}>
        <Avatar uri={user.photoUri} name={user.name} size={110} />
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <Field label="Barrio" value={user.neighborhood} />
      <Field label="Teléfono de contacto" value={user.phone} />
      <Field
        label="Privacidad del teléfono"
        value={user.phoneVisibleOnClaim ? 'Se muestra cuando se acepta un reclamo' : 'Solo me comunican por la app'}
      />

      {reputation ? (
        <>
          <ReputationCard reputation={reputation} />
          <BadgeList reputation={reputation} />
        </>
      ) : null}

      <View style={styles.actions}>
        <Button title="Editar perfil" onPress={() => navigation.navigate('EditProfile')} />
        <Button variant="link" title="Ver cómo me ven otros" onPress={() => navigation.navigate('PublicProfile', { userId: user.id })} />
        <Button variant="link" title="Configuración" onPress={() => navigation.navigate('Settings')} />
      </View>

      <View style={styles.samples}>
        <Text style={styles.fieldLabel}>Perfiles de ejemplo (solo para probar)</Text>
        {SAMPLE_USERS.map((u) => (
          <Button key={u.id} variant="link" title={u.name} onPress={() => navigation.navigate('PublicProfile', { userId: u.id })} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  container: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  email: { color: colors.muted },
  field: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surface },
  fieldLabel: { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  fieldValue: { fontSize: 16, color: colors.text, marginTop: 2 },
  actions: { marginTop: spacing.lg },
  samples: { marginTop: spacing.lg, alignItems: 'flex-start' },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error },
});
