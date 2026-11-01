import { Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from './Avatar';
import Button from './Button';
import Card from './Card';
import Icon from './Icon';
import StateTag from './StateTag';
import { colors, radius, spacing, typography } from '../constants/theme';
import { HISTORY_TYPE_LABELS, formatReturnDate, historyStatus } from '../utils/formatHistory';

// Una devolución del historial: fecha, objeto, contraparte (toca para ver su perfil), estado y acciones.
// Sin sombra: la Card se separa con borde. Props sin cambios: item, onOpenProfile, onRate, onThank.
export default function HistoryCard({ item, onOpenProfile, onRate, onThank }) {
  const status = historyStatus(item);
  const other = item.counterpart;
  const canThank = item.canThank && item.role === 'recupere';
  const typeLabel = HISTORY_TYPE_LABELS[item.object?.type];
  const kind = [typeLabel, item.object?.category?.name].filter(Boolean).join(' · ');
  const personText = other ? `${item.role === 'devolvi' ? 'Se lo devolviste a ' : 'Te lo devolvió '}${other.name}` : '';

  return (
    <Card style={styles.card}>
      <Text style={styles.meta}>{formatReturnDate(item.date)}</Text>
      {item.object ? (
        <>
          <Text style={styles.title} numberOfLines={2}>{item.object.title}</Text>
          {kind ? <Text style={styles.meta}>{kind}</Text> : null}
        </>
      ) : (
        <Text style={styles.meta}>Objeto no disponible</Text>
      )}

      {other ? (
        <Pressable
          style={({ pressed }) => [styles.person, pressed && styles.pressed]}
          onPress={() => onOpenProfile(other.id)}
          accessibilityRole="button"
          accessibilityLabel={`${personText}. Ver perfil`}
        >
          <Avatar uri={other.photoUri} name={other.name} size={36} />
          <Text style={styles.personName} numberOfLines={2}>{personText}</Text>
          <Icon name="chevron" size={20} color={colors.textDim} />
        </Pressable>
      ) : (
        <Text style={[styles.meta, styles.noPerson]}>Persona no disponible</Text>
      )}

      {status.length > 0 ? (
        <View style={styles.row}>
          {status.map((label) => (
            <View key={label} style={styles.tag}>
              <StateTag label={label} fg={colors.success} bg={colors.successSoft} />
            </View>
          ))}
        </View>
      ) : null}

      {item.canRate || canThank ? (
        <View style={styles.row}>
          {item.canRate ? <Button variant="secondary" title="Valorar" onPress={() => onRate(item)} style={styles.action} /> : null}
          {canThank ? <Button variant="secondary" title="Agradecer" onPress={() => onThank(item)} style={styles.action} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  meta: { ...typography.meta, color: colors.textDim },
  title: { ...typography.bodyStrong, color: colors.text },
  person: {
    flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: spacing.sm,
    borderRadius: radius.button,
  },
  pressed: { backgroundColor: colors.blue50 },
  personName: { ...typography.bodyStrong, flex: 1, marginLeft: spacing.sm, color: colors.blue600 },
  noPerson: { marginTop: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  tag: { marginRight: spacing.sm, marginBottom: spacing.xs },
  action: { minWidth: 96, marginRight: spacing.sm },
});
