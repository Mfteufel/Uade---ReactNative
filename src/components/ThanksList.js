import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Avatar from './Avatar';
import Button from './Button';
import Card from './Card';
import SectionTitle from './SectionTitle';
import { colors, spacing, typography } from '../constants/theme';
import { formatReturnDate } from '../utils/formatHistory';

const MAX_LINES = 3;
const LONG_MESSAGE = 140; // a partir de acá se ofrece "Ver más" (aprox. 3 líneas)

function ThanksItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const long = [...item.message].length > LONG_MESSAGE;

  return (
    <Card tight style={styles.item}>
      <View style={styles.author}>
        <Avatar uri={item.author.photoUri} name={item.author.name} size={32} />
        <View style={styles.authorText}>
          <Text style={styles.name}>{item.author.name}</Text>
          <Text style={styles.date}>{formatReturnDate(item.createdAt)}</Text>
        </View>
      </View>
      <Text style={styles.message} numberOfLines={expanded || !long ? undefined : MAX_LINES}>{item.message}</Text>
      {long ? <Button variant="link" title={expanded ? 'Ver menos' : 'Ver más'} onPress={() => setExpanded(!expanded)} /> : null}
    </Card>
  );
}

// Agradecimientos públicos que recibió quien devolvió objetos (punto 10).
// thanks undefined (la respuesta no trae el campo): no se muestra nada.
export default function ThanksList({ thanks }) {
  if (thanks === undefined || thanks === null) return null;

  return (
    <View style={styles.container}>
      <SectionTitle title="Agradecimientos" />
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
  container: { marginTop: spacing.md },
  muted: { ...typography.body, color: colors.textDim },
  item: { marginBottom: spacing.sm },
  author: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  authorText: { marginLeft: spacing.sm, flex: 1 },
  name: { ...typography.bodyStrong, color: colors.text },
  date: { ...typography.meta, color: colors.textDim },
  message: { ...typography.body, color: colors.text },
});
