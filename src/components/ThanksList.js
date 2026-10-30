import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Avatar from './Avatar';
import Button from './Button';
import { colors, spacing } from '../constants/theme';
import { formatReturnDate } from '../utils/formatHistory';

const MAX_LINES = 3;
const LONG_MESSAGE = 140; // a partir de acá se ofrece "Ver más" (aprox. 3 líneas)

function ThanksItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const long = [...item.message].length > LONG_MESSAGE;

  return (
    <View style={styles.item}>
      <View style={styles.author}>
        <Avatar uri={item.author.photoUri} name={item.author.name} size={32} />
        <Text style={styles.name}>{item.author.name}</Text>
        <Text style={styles.date}>{formatReturnDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.message} numberOfLines={expanded || !long ? undefined : MAX_LINES}>{item.message}</Text>
      {long ? <Button variant="link" title={expanded ? 'Ver menos' : 'Ver más'} onPress={() => setExpanded(!expanded)} /> : null}
    </View>
  );
}

// Agradecimientos públicos que recibió quien devolvió objetos (punto 10).
// thanks undefined (la respuesta no trae el campo): no se muestra nada.
export default function ThanksList({ thanks }) {
  if (thanks === undefined || thanks === null) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agradecimientos</Text>
      {thanks.length === 0 ? (
        <Text style={styles.muted}>Todavía no recibió agradecimientos.</Text>
      ) : (
        // Son 20 como máximo: alcanza con map dentro del ScrollView del perfil.
        thanks.map((item, i) => <ThanksItem key={`${item.createdAt}-${i}`} item={item} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  muted: { color: colors.muted },
  item: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  name: { marginLeft: spacing.sm, fontWeight: '600', color: colors.text, flex: 1 },
  date: { color: colors.muted, fontSize: 12 },
  message: { color: colors.text },
});
