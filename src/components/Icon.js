import { StyleSheet, Text } from 'react-native';
import { colors } from '../constants/theme';

// Íconos como caracteres Unicode básicos (sin dependencias). Se evitan los emojis de color.
// Los que tienen versión emoji llevan el selector de texto ︎ para forzar el glifo monocromo.
export const ICONS = {
  search: '◎', // ◎
  plus: '+',
  list: '≡', // ≡
  user: '☺︎', // ☺
  chevron: '›', // ›
  settings: '⚙︎', // ⚙
  edit: '✎', // ✎
  eye: '◉', // ◉
  pin: '◆', // ◆
  camera: '▣', // ▣
  image: '▤', // ▤
  back: '‹', // ‹
  clock: '◷', // ◷
  check: '✓︎', // ✓
  close: '✕︎', // ✕
  info: 'ℹ︎', // ℹ
  warning: '⚠︎', // ⚠
  calendar: '▦', // ▦
  tag: '#',
  location: '⌖', // ⌖
  lock: '⚿', // ⚿
  history: '↺', // ↺
  star: '★︎', // ★ (Valorar)
  heart: '♥︎', // ♥ (Agradecer)
  filter: '▽', // ▽
};

// Decorativo: lo describe el texto o el accessibilityLabel del contenedor.
// Si se pasa accessibilityLabel, el ícono deja de ser decorativo y se anuncia.
export default function Icon({ name, size = 24, color = colors.text, style, accessibilityLabel }) {
  const glyph = ICONS[name];
  if (!glyph) return null;
  const decorative = !accessibilityLabel;
  return (
    <Text
      style={[styles.icon, { fontSize: size, lineHeight: size * 1.2, color }, style]}
      accessible={!decorative}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      allowFontScaling={false}
    >
      {glyph}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: { textAlign: 'center', includeFontPadding: false },
});
