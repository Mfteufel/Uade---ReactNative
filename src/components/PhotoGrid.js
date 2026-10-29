import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Miniaturas de las fotos. Si viene onRemove, cada una tiene una cruz para sacarla.
export default function PhotoGrid({ uris, onRemove }) {
  return (
    <View style={styles.grid}>
      {uris.map((uri) => (
        <View key={uri} style={styles.item}>
          <Image source={{ uri }} style={styles.image} />
          {onRemove ? (
            <Pressable onPress={() => onRemove(uri)} style={styles.remove} hitSlop={8}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const SIZE = 96;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  item: { width: SIZE, height: SIZE },
  image: { width: SIZE, height: SIZE, borderRadius: 8, backgroundColor: colors.surface },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
