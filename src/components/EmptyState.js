import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/theme';

// action: elemento opcional (por ejemplo un <Button />) que se muestra debajo del mensaje.
export default function EmptyState({ title, message, action }) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
});
