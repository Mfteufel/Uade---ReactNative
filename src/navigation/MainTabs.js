import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import NoveltyBell from '../components/NoveltyBell';
import HeaderTitle from '../components/HeaderTitle';
import SearchScreen from '../screens/search/SearchScreen';
import MyClaimsScreen from '../screens/claims/MyClaimsScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';
import { colors, shadow, typography } from '../constants/theme';

// Navegador de pestañas inferior: Buscar, Publicar, Mis reclamos y Perfil.
// Regla del equipo: desde una pantalla del stack raíz, para ir a una pestaña se usa
// navigate('Main', { screen: 'MyClaims', params }). Desde una pestaña, un navigate hacia
// una pantalla que este navegador no conoce sube solo al stack raíz.
const Tab = createBottomTabNavigator();

// «Publicar» no es una pantalla: su toque se intercepta y abre el asistente del stack raíz.
// Este componente nunca se muestra.
function PublishPlaceholder() {
  return null;
}

const BAR_HEIGHT = 56;

// hasClaimsDot: punto de novedad accent500 sobre «Mis reclamos». Todavía no hay un dato real
// que lo alimente (choque C21), así que queda en false; cuando exista, pasar true desde acá.
export default function MainTabs({ hasClaimsDot = false }) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Search"
      screenOptions={{
        headerStyle: { backgroundColor: colors.blue600, ...shadow.header },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { ...typography.titleBar, color: colors.onPrimary },
        tabBarActiveTintColor: colors.blue600,
        tabBarInactiveTintColor: colors.textDim,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
          ...shadow.bar,
        },
        // Cuatro pestañas de igual ancho; ícono y etiqueta apilados y centrados.
        tabBarItemStyle: { flex: 1, height: BAR_HEIGHT, paddingVertical: 4 },
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Hallado',
          headerTitle: () => <HeaderTitle title="Hallado" subtitle="Objetos y mascotas en Buenos Aires" />,
          headerRight: () => <NoveltyBell />,
          headerStyle: { backgroundColor: colors.blue600, height: 72 + insets.top, ...shadow.header },
          ...tabOptions('Buscar', 'search', 'Buscar publicaciones'),
        }}
      />
      <Tab.Screen
        name="PublishTab"
        component={PublishPlaceholder}
        options={{
          headerShown: false,
          // Choque C1: el diseño pide «Publicar» en accent700 cuando está activa, pero como
          // intercepta el toque nunca queda activa. Se define el tinte activo tal cual lo pide
          // el plan; en la práctica el naranja casi no se ve en esta pestaña.
          tabBarActiveTintColor: colors.accent700,
          ...tabOptions('Publicar', 'plus', 'Publicar un objeto'),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            // Sube al stack raíz: el asistente se monta de cero (sin borrador de pestaña).
            navigation.navigate('Publish');
          },
        })}
      />
      <Tab.Screen
        name="MyClaims"
        component={MyClaimsScreen}
        options={{
          title: 'Mis reclamos',
          // Sin sombra: los segmentos de abajo (SegmentedTabs) quedan pegados al encabezado.
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.blue600, ...shadow.none },
          ...tabOptions('Mis reclamos', 'list', 'Mis reclamos', hasClaimsDot),
        }}
      />
      <Tab.Screen
        name="MyProfile"
        component={MyProfileScreen}
        options={{
          title: 'Perfil',
          ...tabOptions('Perfil', 'user', 'Mi perfil'),
        }}
      />
    </Tab.Navigator>
  );
}

// Opciones comunes de una pestaña: ícono de 24, etiqueta de 12 sp siempre visible
// (peso 500 si está activa) y etiqueta de accesibilidad.
function tabOptions(label, icon, a11yLabel, dot = false) {
  return {
    tabBarAccessibilityLabel: a11yLabel,
    tabBarLabel: ({ focused, color }) => (
      <Text
        style={[styles.label, { color, fontWeight: focused ? '500' : '400' }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    ),
    tabBarIcon: ({ color }) => (
      <View>
        <Icon name={icon} size={24} color={color} />
        {dot ? <View style={styles.dot} /> : null}
      </View>
    ),
  };
}

const styles = StyleSheet.create({
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  // Punto de novedad: 8 dp, accent500 con borde blanco de 1,5.
  dot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent500,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
});
