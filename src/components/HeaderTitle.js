import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../constants/theme';

// Título del encabezado azul con subtítulo (alto 72). Se usa en la raíz de Buscar.
// Texto blanco sobre blue600; el subtítulo va atenuado con opacidad (no con un color suelto).
export default function HeaderTitle({ title, subtitle }) {
  return (
    <View style={styles.box} accessible accessibilityRole="header" accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 72, justifyContent: 'center' },
  title: { ...typography.titleBar, color: colors.onPrimary },
  subtitle: { ...typography.meta, color: colors.onPrimary, opacity: 0.78 },
});
