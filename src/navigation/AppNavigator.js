import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

import LockScreen from '../screens/auth/LockScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterEmailScreen from '../screens/auth/RegisterEmailScreen';
import RegisterOtpScreen from '../screens/auth/RegisterOtpScreen';
import RegisterPasswordScreen from '../screens/auth/RegisterPasswordScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import SearchScreen from '../screens/search/SearchScreen';
import ResultsScreen from '../screens/search/ResultsScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ClaimFormScreen from '../screens/claims/ClaimFormScreen';
import MyClaimsScreen from '../screens/claims/MyClaimsScreen';
import ClaimDetailScreen from '../screens/claims/ClaimDetailScreen';
import MeetingPointScreen from '../screens/claims/MeetingPointScreen';
import PublishScreen from '../screens/publications/PublishScreen';
import MyPublicationsScreen from '../screens/publications/MyPublicationsScreen';
import PublicationDetailScreen from '../screens/publications/PublicationDetailScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isLoggedIn, loading, locked } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {locked ? (
          <Stack.Screen name="Lock" component={LockScreen} options={{ headerShown: false }} />
        ) : isLoggedIn ? (
          <>
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Hallado' }} />
            <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Resultados' }} />
            <Stack.Screen name="PublicationDetail" component={PublicationDetailScreen} options={{ title: 'Publicación' }} />
            <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: 'Mi perfil' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Perfil público' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
            <Stack.Screen name="MyClaims" component={MyClaimsScreen} options={{ title: 'Mis reclamos' }} />
            {/* Params: { publicationId }. El detalle de publicación (punto 4) navega acá desde "Es mío" / "Lo encontré". */}
            <Stack.Screen name="ClaimForm" component={ClaimFormScreen} options={{ title: 'Reclamar' }} />
            <Stack.Screen name="ClaimDetail" component={ClaimDetailScreen} options={{ title: 'Reclamo' }} />
            {/* Params: { claimId }. Solo se entra desde un reclamo aceptado (punto 8). */}
            <Stack.Screen name="MeetingPoint" component={MeetingPointScreen} options={{ title: 'Punto de encuentro' }} />
            <Stack.Screen name="Publish" component={PublishScreen} options={{ title: 'Publicar' }} />
            <Stack.Screen name="MyPublications" component={MyPublicationsScreen} options={{ title: 'Mis publicaciones' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Ingresar' }} />
            <Stack.Screen name="RegisterEmail" component={RegisterEmailScreen} options={{ title: 'Registro' }} />
            <Stack.Screen name="RegisterOtp" component={RegisterOtpScreen} options={{ title: 'Código' }} />
            <Stack.Screen name="RegisterPassword" component={RegisterPasswordScreen} options={{ title: 'Contraseña' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
