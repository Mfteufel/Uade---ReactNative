import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { PUBLICATION_STATUS } from '../constants/search';
import { colors, spacing } from '../constants/theme';
import { formatDate, formatDistance } from '../utils/formatSearch';

// Una fila de resultados: primera foto (o un recuadro vacío), título, categoría, barrio, fecha, coordenadas, estado y distancia.
export default function PublicationCard({ item, onPress }) {
  const status = PUBLICATION_STATUS[item.status];
  const photo = item.photoUrls[0];
  const hasCoords = item.lat !== null && item.lng !== null;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <Text style={styles.placeholderText}>Sin foto</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          {status ? <Text style={[styles.status, { color: status.color }]}>{status.label}</Text> : null}
        </View>
        <Text style={styles.line}>{item.category.name} · {item.neighborhood.name}</Text>
        <Text style={styles.muted}>Ocurrió el {formatDate(item.occurredOn)}</Text>
        {hasCoords ? <Text style={styles.muted}>{item.lat}, {item.lng}</Text> : null}
        {item.distanceM !== undefined && item.distanceM !== null ? (
          <Text style={styles.distance}>A {formatDistance(item.distanceM)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm, marginBottom: spacing.md },
  photo: { width: 88, height: 88, borderRadius: 8, backgroundColor: colors.border },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.muted, fontSize: 12 },
  body: { flex: 1, marginLeft: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  status: { fontSize: 12, fontWeight: '700' },
  line: { color: colors.text, marginTop: 2 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  distance: { color: colors.primary, fontWeight: '600', marginTop: 2 },
});
