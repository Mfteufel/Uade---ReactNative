import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Banner from './Banner';
import Button from './Button';
import Chip from './Chip';
import Input from './Input';
import Sheet from './Sheet';
import useReturnAction from '../hooks/useReturnAction';
import { rateReturn } from '../services/historyApi';
import { charCount, singleLine } from '../utils/textInput';
import { colors, spacing, typography } from '../constants/theme';

const MAX_COMMENT = 280;

// Se monta solo mientras está abierto: cada vez arranca vacío.
// Hoja inferior con avoidKeyboard: el teclado no tapa «Enviar valoración», que va fijo en el pie.
function RatingForm({ item, onDone, onStale, onClose }) {
  const [positive, setPositive] = useState(null); // null hasta que elija
  const [comment, setComment] = useState('');
  const { sending, error, send, isOnline } = useReturnAction({ onDone, onStale });

  const submit = () => send(() => rateReturn(item.id, { positive, comment }));

  const footer = (
    <View>
      <Button
        title="Enviar valoración"
        loadingTitle="Enviando…"
        onPress={submit}
        loading={sending}
        dimmed={!isOnline}
        disabled={positive === null}
        disabledReason={positive === null ? 'Elegí si fue positiva o negativa.' : undefined}
      />
      <Button variant="link" title="Cancelar" onPress={onClose} disabled={sending} />
    </View>
  );

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Valorar a ${item.counterpart?.name || 'la otra persona'}`}
      avoidKeyboard
      footer={footer}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>Tenés hasta 7 días desde la devolución.</Text>

        <View style={styles.row}>
          <Chip label="👍 Positiva" selected={positive === true} onPress={() => setPositive(true)} />
          <Chip label="👎 Negativa" selected={positive === false} onPress={() => setPositive(false)} />
        </View>

        <Input
          label="Comentario (opcional)"
          value={comment}
          onChangeText={(text) => setComment(singleLine(text, MAX_COMMENT))}
          placeholder="Contá brevemente cómo fue"
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
        />
        <Text style={styles.counter}>{charCount(comment)}/{MAX_COMMENT}</Text>

        {error ? <Banner kind="warn" message={error} style={styles.error} /> : null}
      </ScrollView>
    </Sheet>
  );
}

export default function RatingModal({ item, onDone, onStale, onClose }) {
  return item ? <RatingForm item={item} onDone={onDone} onStale={onStale} onClose={onClose} /> : null;
}

const styles = StyleSheet.create({
  hint: { ...typography.body, color: colors.textDim, marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  counter: { ...typography.meta, color: colors.textDim, textAlign: 'right', marginTop: -spacing.md, marginBottom: spacing.md },
  error: { marginBottom: spacing.md },
});
