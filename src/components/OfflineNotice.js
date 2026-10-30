import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Aviso amarillo para cuando no hay conexión.
export default function OfflineNotice({ text }) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.warningBackground, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md },
  text: { color: colors.warning },
});
