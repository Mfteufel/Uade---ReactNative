import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import Chip from './Chip';
import Input from './Input';
import useReturnAction from '../hooks/useReturnAction';
import { rateReturn } from '../services/historyApi';
import { charCount, singleLine } from '../utils/textInput';
import { colors, spacing } from '../constants/theme';

const MAX_COMMENT = 280;

// Se monta solo mientras está abierto: cada vez arranca vacío.
function RatingForm({ item, onDone, onStale, onClose }) {
  const [positive, setPositive] = useState(null); // null hasta que elija
  const [comment, setComment] = useState('');
  const { sending, error, send } = useReturnAction({ onDone, onStale });

  const submit = () => send(() => rateReturn(item.id, { positive, comment }));

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Valorar a {item.counterpart?.name || 'la otra persona'}</Text>
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

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Enviar" onPress={submit} loading={sending} disabled={positive === null} />
        <Button variant="link" title="Cancelar" onPress={onClose} disabled={sending} />
      </View>
    </View>
  );
}

export default function RatingModal({ item, onDone, onStale, onClose }) {
  return (
    <Modal visible={Boolean(item)} animationType="slide" onRequestClose={onClose}>
      {item ? <RatingForm item={item} onDone={onDone} onStale={onStale} onClose={onClose} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  hint: { color: colors.muted, marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.surface },
});
