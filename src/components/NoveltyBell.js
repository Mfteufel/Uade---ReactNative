import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNovedades } from '../context/NovedadesContext';
import { colors, spacing } from '../constants/theme';

const BELL = colors.onPrimary; // blanco sobre el encabezado azul

// Campana de novedades del encabezado de Buscar: alertas con publicaciones nuevas y seguidas que cambiaron.
// Lleva a la sección que tiene novedades; si las tienen las dos (o ninguna), a Perfil, donde están ambas.
export default function NoveltyBell() {
  const navigation = useNavigation();
  const { alertasNuevas, seguidasConNovedad } = useNovedades();
  const total = alertasNuevas + seguidasConNovedad;

  function open() {
    if (alertasNuevas > 0 && seguidasConNovedad === 0) navigation.navigate('MyAlerts');
    else if (seguidasConNovedad > 0 && alertasNuevas === 0) navigation.navigate('Follows');
    else navigation.navigate('MyProfile');
  }

  return (
    <TouchableOpacity
      onPress={open}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={total > 0 ? `Novedades: ${total}` : 'Novedades: no hay'}
    >
      {/* La campana dibujada: agarre, cúpula, borde y badajo. */}
      <View style={styles.bell}>
        <View style={styles.knob} />
        <View style={styles.dome} />
        <View style={styles.rim} />
        <View style={styles.clapper} />
      </View>
      {total > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{total > 99 ? '99+' : total}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  bell: { alignItems: 'center' },
  knob: { width: 4, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: BELL },
  dome: { width: 16, height: 13, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: BELL },
  rim: { width: 22, height: 3, borderRadius: 1.5, backgroundColor: BELL },
  clapper: {
    width: 6,
    height: 4,
    marginTop: 1,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: BELL,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.onPrimary,
    backgroundColor: colors.accent700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '500' },
});
