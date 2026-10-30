import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';

// Contenedor común de formularios: scroll + teclado + título + mensaje de error general.
// footer: elemento opcional (por ejemplo un <BottomActionBar />) fijo abajo, fuera del ScrollView.
export default function FormScreen({ title, subtitle, error, children, footer }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title ? (
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {/* Aspecto del Banner de error (barra izquierda de 4 dp). Pasa a Banner cuando exista (paso 9). */}
        {error ? (
          <View style={styles.formError} accessibilityRole="alert">
            <Text style={styles.formErrorText}>{error}</Text>
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer || null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.screen, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { ...typography.display, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textDim, marginBottom: spacing.lg },
  formError: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.ms,
    borderRadius: radius.button,
    marginBottom: spacing.md,
  },
  formErrorText: { ...typography.body, color: colors.danger800 },
});
