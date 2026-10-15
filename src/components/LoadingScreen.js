import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

// Pantalla de carga con el logo de Hallado (mientras se restaura la sesión al abrir la app).
export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.splash },
  logo: { width: 180, height: 180 },
  spinner: { marginTop: spacing.lg },
});
