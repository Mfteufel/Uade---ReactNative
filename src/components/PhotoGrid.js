import { Image, Pressable, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import { colors, radius, spacing } from '../constants/theme';

// Miniaturas de las fotos (casilleros de 72 dp). Si viene onRemove, cada una tiene una X para sacarla.
// Si viene onAdd y todavía hay lugar (uris.length < max), se suma un casillero «+» al final.
export default function PhotoGrid({ uris, onRemove, onAdd, max = Infinity }) {
  const canAdd = !!onAdd && uris.length < max;
  return (
    <View style={styles.grid}>
      {uris.map((uri, index) => (
        <View key={uri} style={styles.item}>
          <Image
            source={{ uri }}
            style={styles.image}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Foto ${index + 1}`}
          />
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(uri)}
              style={styles.remove}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Quitar foto ${index + 1}`}
            >
              <Icon name="close" size={14} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {canAdd ? (
        <Pressable
          onPress={onAdd}
          style={({ pressed }) => [styles.item, styles.add, pressed && styles.addPressed]}
          accessibilityRole="button"
          accessibilityLabel="Agregar una foto"
        >
          <Icon name="plus" size={24} color={colors.blue600} />
        </Pressable>
      ) : null}
    </View>
  );
}

const SIZE = 72;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  item: { width: SIZE, height: SIZE },
  image: { width: SIZE, height: SIZE, borderRadius: radius.thumb, backgroundColor: colors.surface },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.thumb,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.blue600,
    backgroundColor: colors.bg,
  },
  addPressed: { backgroundColor: colors.blue50 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: radius.avatar,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
