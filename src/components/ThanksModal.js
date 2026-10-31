import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Banner from './Banner';
import Button from './Button';
import Input from './Input';
import Sheet from './Sheet';
import useReturnAction from '../hooks/useReturnAction';
import { thankReturn } from '../services/historyApi';
import { charCount, singleLine } from '../utils/textInput';
import { colors, spacing, typography } from '../constants/theme';

const MAX_MESSAGE = 500;

// Se monta solo mientras está abierto: cada vez arranca vacío.
// Hoja inferior con avoidKeyboard: el teclado no tapa «Enviar agradecimiento», que va fijo en el pie.
function ThanksForm({ item, onDone, onStale, onClose }) {
  const [message, setMessage] = useState('');
  const { sending, error, send, isOnline } = useReturnAction({ onDone, onStale });
  const name = item.counterpart?.name || 'quien te lo devolvió';
  const empty = message.trim() === '';

  const submit = () => send(() => thankReturn(item.id, message));

  const footer = (
    <View>
      <Button
        title="Enviar agradecimiento"
        loadingTitle="Enviando…"
        onPress={submit}
        loading={sending}
        dimmed={!isOnline}
        disabled={empty}
        disabledReason={empty ? 'Escribí un mensaje.' : undefined}
      />
      <Button variant="link" title="Cancelar" onPress={onClose} disabled={sending} />
    </View>
  );

  return (
    <Sheet visible onClose={onClose} title={`Agradecer a ${name}`} avoidKeyboard footer={footer}>
      <ScrollView keyboardShouldPersistTaps="handled">
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

        {error ? <Banner kind="warn" message={error} style={styles.error} /> : null}
      </ScrollView>
    </Sheet>
  );
}

export default function ThanksModal({ item, onDone, onStale, onClose }) {
  return item ? <ThanksForm item={item} onDone={onDone} onStale={onStale} onClose={onClose} /> : null;
}

const styles = StyleSheet.create({
  hint: { ...typography.body, color: colors.textDim, marginBottom: spacing.md },
  counter: { ...typography.meta, color: colors.textDim, textAlign: 'right', marginTop: -spacing.md, marginBottom: spacing.md },
  error: { marginBottom: spacing.md },
});
