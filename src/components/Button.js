import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../constants/theme';

// variant: 'primary' (relleno) | 'link' (solo texto)
export default function Button({ title, onPress, loading = false, disabled = false, variant = 'primary' }) {
  const isLink = variant === 'link';
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[styles.base, isLink ? styles.link : styles.primary, inactive && styles.inactive]}
    >
      {loading ? (
        <ActivityIndicator color={isLink ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, isLink && styles.linkText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  primary: { backgroundColor: colors.primary },
  link: { minHeight: 40 },
  inactive: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkText: { color: colors.primary },
});
