import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

// Foto de perfil, o las iniciales si no hay foto.
export default function Avatar({ uri, name = '', size = 96 }) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={[styles.image, dimension]} />;

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.placeholder, dimension]}>
      <Text style={[styles.initials, { fontSize: size / 2.6 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '700' },
});
