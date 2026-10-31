import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../constants/theme';

// Se muestra al abrir la app si la biometría está activa.
// Es la única pantalla de fondo azul pleno: se lee como una puerta.
export default function LockScreen() {
  const { unlock, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tryUnlock = useCallback(async () => {
    setLoading(true);
    setError('');
    const { ok, message } = await unlock();
    if (!ok) {
      setError(message); // vacío si el usuario solo canceló
      setLoading(false);
    }
  }, [unlock]);

  // Pide la huella automáticamente al abrir
  useEffect(() => {
    tryUnlock();
  }, [tryUnlock]);

  return (
    <View style={styles.container}>
      {/* Fondo azul pleno sin encabezado: íconos claros en la barra de estado. */}
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.badge}>
          <Icon name="lock" size={40} color={colors.onPrimary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">Hallado</Text>
        <Text style={styles.sub}>Usá tu huella o rostro para entrar.</Text>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
        <Button variant="inverse" title="Usar huella" loadingTitle="Verificando…" onPress={tryUnlock} loading={loading} style={styles.fullWidth} />
        <Button variant="inverseOutline" title="Entrar con contraseña" onPress={logout} style={styles.fullWidth} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  content: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  badge: {
    width: 80,
    height: 80,
    borderRadius: radius.avatar,
    borderWidth: 1.5,
    borderColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.display, color: colors.onPrimary, textAlign: 'center' },
  sub: { ...typography.body, color: colors.onPrimary, textAlign: 'center', marginTop: spacing.sm },
  error: { ...typography.body, color: colors.onPrimary, textAlign: 'center', marginTop: spacing.md },
  actions: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.ms },
  fullWidth: { alignSelf: 'stretch' },
});
