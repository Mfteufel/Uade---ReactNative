import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import Input from './Input';
import useReturnAction from '../hooks/useReturnAction';
import { thankReturn } from '../services/historyApi';
import { charCount, singleLine } from '../utils/textInput';
import { colors, spacing } from '../constants/theme';

const MAX_MESSAGE = 500;

// Se monta solo mientras está abierto: cada vez arranca vacío.
function ThanksForm({ item, onDone, onStale, onClose }) {
  const [message, setMessage] = useState('');
  const { sending, error, send } = useReturnAction({ onDone, onStale });
  const name = item.counterpart?.name || 'quien te lo devolvió';

  const submit = () => send(() => thankReturn(item.id, message));

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Agradecer a {name}</Text>
        <Text style={styles.hint}>Se va a ver en el perfil público de {name}.</Text>

        <Input
          label="Mensaje"
          value={message}
          onChangeText={(text) => setMessage(singleLine(text, MAX_MESSAGE))}
          placeholder="¡Gracias por devolverme…!"
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
        />
        <Text style={styles.counter}>{charCount(message)}/{MAX_MESSAGE}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Enviar" onPress={submit} loading={sending} disabled={message.trim() === ''} />
        <Button variant="link" title="Cancelar" onPress={onClose} disabled={sending} />
      </View>
    </View>
  );
}

export default function ThanksModal({ item, onDone, onStale, onClose }) {
  return (
    <Modal visible={Boolean(item)} animationType="slide" onRequestClose={onClose}>
      {item ? <ThanksForm item={item} onDone={onDone} onStale={onStale} onClose={onClose} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  hint: { color: colors.muted, marginBottom: spacing.md },
  counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.surface },
});
