import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import Button from './Button';

// Diálogo de confirmación. El título es la pregunta, el cuerpo dice qué se pierde y qué no,
// y el botón de confirmar repite el verbo exacto (nunca «Aceptar»).
// visible: muestra u oculta. title: la pregunta. message: qué se pierde y qué no.
// confirmLabel: el verbo («Cerrar sesión»). cancelLabel: por defecto «Cancelar».
// danger: el botón de confirmar usa la variante danger (si no, primary).
// loading / loadingLabel: estado de carga del botón de confirmar (gerundio).
// onConfirm / onCancel: acciones. Atrás de Android y tocar afuera llaman a onCancel (salvo con loading).
export default function ConfirmDialog({
  visible = false,
  title = '',
  message = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  loadingLabel,
  onConfirm,
  onCancel,
}) {
  const close = () => {
    if (!loading && onCancel) onCancel();
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={close} accessible={false} importantForAccessibility="no">
          <View style={styles.scrimFill} />
        </Pressable>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" onPress={close} disabled={loading} style={styles.action} />
            <Button
              title={confirmLabel}
              variant={danger ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              loadingTitle={loadingLabel}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  scrim: { ...StyleSheet.absoluteFillObject },
  scrimFill: { flex: 1, backgroundColor: colors.text, opacity: 0.5 },
  dialog: { backgroundColor: colors.bg, borderRadius: radius.card, padding: spacing.lg },
  title: { ...typography.section, color: colors.text },
  message: { ...typography.body, color: colors.text, marginTop: spacing.ms },
  // Los botones se acomodan en renglones si no entran en el ancho del diálogo (el confirmar queda a la derecha / abajo).
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: spacing.lg, marginLeft: -spacing.sm, marginBottom: -spacing.sm },
  action: { flexGrow: 1, marginLeft: spacing.sm, marginBottom: spacing.sm },
});
