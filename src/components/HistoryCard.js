import { Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from './Avatar';
import Button from './Button';
import { colors, spacing } from '../constants/theme';
import { formatReturnDate, historyStatus } from '../utils/formatHistory';

// Una devolución del historial: fecha, objeto, contraparte (toca para ver su perfil), estado y acciones.
export default function HistoryCard({ item, onOpenProfile, onRate, onThank }) {
  const status = historyStatus(item);
  const other = item.counterpart;
  const canThank = item.canThank && item.role === 'recupere';

  return (
    <View style={styles.card}>
      <Text style={styles.date}>{formatReturnDate(item.date)}</Text>
      {item.object ? (
        <>
          <Text style={styles.title} numberOfLines={2}>{item.object.title}</Text>
          {item.object.category ? <Text style={styles.muted}>{item.object.category.name}</Text> : null}
        </>
      ) : (
        <Text style={styles.muted}>Objeto no disponible</Text>
      )}

      {other ? (
        <Pressable style={styles.person} onPress={() => onOpenProfile(other.id)}>
          <Avatar uri={other.photoUri} name={other.name} size={36} />
          <Text style={styles.personName}>{item.role === 'devolvi' ? 'Se lo devolviste a ' : 'Te lo devolvió '}{other.name}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.muted, styles.person]}>Persona no disponible</Text>
      )}

      {status.length > 0 ? (
        <View style={styles.row}>
          {status.map((label) => (
            <Text key={label} style={styles.status}>{label}</Text>
          ))}
        </View>
      ) : null}

      {item.canRate || canThank ? (
        <View style={styles.actions}>
          {item.canRate ? <Button variant="link" title="Valorar" onPress={() => onRate(item)} /> : null}
          {canThank ? <Button variant="link" title="Agradecer" onPress={() => onThank(item)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  date: { color: colors.muted, fontSize: 13, marginBottom: spacing.xs },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  personName: { marginLeft: spacing.sm, color: colors.primary, fontWeight: '600', flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.xs },
  status: {
    fontSize: 12, fontWeight: '600', color: colors.text, backgroundColor: colors.background,
    borderRadius: 12, paddingVertical: 2, paddingHorizontal: spacing.sm, marginRight: spacing.sm, marginTop: spacing.xs,
  },
});
