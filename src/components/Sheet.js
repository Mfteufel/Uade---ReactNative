import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/theme';

// Hoja que sube desde abajo (Modal transparente).
// visible: muestra u oculta. onClose: se llama al tocar afuera y con el botón atrás de Android.
// title: título opcional de la hoja. children: contenido.
// footer: contenido fijo al pie de la hoja (por ejemplo, botones), con el margen de la zona de gestos.
// avoidKeyboard: sube la hoja cuando aparece el teclado (para formularios).
export default function Sheet({ visible = false, onClose, title, children, footer, avoidKeyboard = false }) {
  const insets = useSafeAreaInsets();
  const Wrapper = avoidKeyboard ? KeyboardAvoidingView : View;
  const wrapperProps = avoidKeyboard ? { behavior: Platform.OS === 'ios' ? 'padding' : 'height' } : {};

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Wrapper style={styles.root} {...wrapperProps}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <View style={styles.scrimFill} />
        </Pressable>
        <View
          style={[styles.sheet, { paddingBottom: footer ? 0 : insets.bottom + spacing.md }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} importantForAccessibility="no" />
          {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
          <View style={styles.content}>{children}</View>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.ms }]}>{footer}</View>
          ) : null}
        </View>
      </Wrapper>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject },
  scrimFill: { flex: 1, backgroundColor: colors.text, opacity: 0.5 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  title: { ...typography.section, color: colors.text, paddingHorizontal: spacing.screen, paddingBottom: spacing.sm },
  content: { flexShrink: 1, paddingHorizontal: spacing.screen },
  footer: {
    paddingTop: spacing.ms,
    paddingHorizontal: spacing.screen,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
