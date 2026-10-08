import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../constants/theme';

// Se muestra al abrir la app si la biometría está activa.
export default function LockScreen() {
  const { unlock, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tryUnlock = useCallback(async () => {
    setLoading(true);
    setError('');
    const ok = await unlock();
    if (!ok) {
      setError('No se pudo desbloquear. Probá de nuevo o ingresá con tu contraseña.');
      setLoading(false);
    }
  }, [unlock]);

  // Pide la huella automáticamente al abrir
  useEffect(() => {
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hallado</Text>
      <Text style={styles.sub}>Usá tu huella o rostro para entrar.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Desbloquear" onPress={tryUnlock} loading={loading} />
      <Button variant="link" title="Ingresar con contraseña" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { color: colors.muted, textAlign: 'center', marginVertical: spacing.lg },
  error: { color: colors.error, textAlign: 'center', marginBottom: spacing.md },
});
