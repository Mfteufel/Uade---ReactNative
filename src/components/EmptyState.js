import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';
import Icon from './Icon';

// icon: nombre de un ícono de Icon.js (72 dp en accent500, decorativo; no lleva texto encima).
// action / secondaryAction: elementos opcionales (por ejemplo un <Button />) debajo del mensaje:
// un primario y como máximo un secundario.
export default function EmptyState({ title, message, action, secondaryAction, icon }) {
  return (
    <View style={styles.container}>
      {icon ? <Icon name={icon} size={72} color={colors.accent500} style={styles.icon} /> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
      {secondaryAction ? <View style={styles.secondary}>{secondaryAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { marginBottom: spacing.md },
  title: { ...typography.section, color: colors.text, textAlign: 'center' },
  message: {
    ...typography.body,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 272,
  },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
  secondary: { marginTop: spacing.sm, alignSelf: 'stretch' },
});
