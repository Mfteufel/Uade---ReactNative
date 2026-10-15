import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import LockScreen from '../screens/auth/LockScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterEmailScreen from '../screens/auth/RegisterEmailScreen';
import RegisterOtpScreen from '../screens/auth/RegisterOtpScreen';
import RegisterPasswordScreen from '../screens/auth/RegisterPasswordScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PublicProfileScreen from '../screens/profile/PublicProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isLoggedIn, loading, locked } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {locked ? (
          <Stack.Screen name="Lock" component={LockScreen} options={{ headerShown: false }} />
        ) : isLoggedIn ? (
          <>
            <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: 'Mi perfil' }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ title: 'Perfil público' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
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
