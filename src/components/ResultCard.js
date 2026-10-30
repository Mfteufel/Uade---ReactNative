import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import Icon from './Icon';
import StateTag from './StateTag';

// Tarjeta de resultado: una sola zona tocable, sin botones adentro, sin sombra ni coordenadas.
// title: título (máx. 2 líneas).
// categoryName / neighborhood: primera línea meta («Categoría · Barrio»).
// dateText: segunda línea meta, ya formateada (por ejemplo «Ocurrió el 12/10/2026»).
// photoUri: primera foto; si no hay, se muestra `icon` (nombre de Icon.js) sobre neutral200.
// statusLabel / statusFg / statusBg: etiqueta de estado (siempre con palabra).
// onPress: acción al tocar la tarjeta.
export default function ResultCard({
  title = '',
  categoryName = '',
  neighborhood = '',
  dateText = '',
  photoUri,
  icon = 'image',
  statusLabel,
  statusFg = colors.textDim,
  statusBg = colors.surface,
  onPress,
}) {
  const meta1 = [categoryName, neighborhood].filter(Boolean).join(' · ');
  const label = [title, neighborhood, dateText, statusLabel].filter(Boolean).join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: colors.blue50 }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, styles.placeholder]}>
          <Icon name={icon} size={32} color={colors.textDim} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {meta1 ? <Text style={styles.meta} numberOfLines={1}>{meta1}</Text> : null}
        {dateText ? <Text style={styles.meta} numberOfLines={1}>{dateText}</Text> : null}
        {statusLabel ? (
          <View style={styles.tag}>
            <StateTag label={statusLabel} fg={statusFg} bg={statusBg} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    minHeight: 112,
    padding: spacing.cardTight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.blue50 },
  thumb: { width: 88, height: 88, borderRadius: radius.thumb, backgroundColor: colors.neutral200 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: spacing.ms },
  title: { ...typography.bodyStrong, color: colors.text },
  meta: { ...typography.meta, color: colors.textDim },
  tag: { marginTop: spacing.xs },
});
