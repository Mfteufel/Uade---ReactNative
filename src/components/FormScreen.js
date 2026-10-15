import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Contenedor común de formularios: scroll + teclado + título + mensaje de error general.
export default function FormScreen({ title, subtitle, error, children }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {error ? <Text style={styles.formError}>{error}</Text> : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  subtitle: { color: colors.muted, marginBottom: spacing.lg, fontSize: 15 },
  formError: {
    backgroundColor: '#FDECEA',
    color: colors.error,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
});
