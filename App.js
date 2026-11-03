import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NovedadesProvider } from './src/context/NovedadesContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { PendingPublicationsProvider } from './src/context/PendingPublicationsContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <NovedadesProvider>
            <PendingPublicationsProvider>
              <AppNavigator />
              <StatusBar style="light" />
            </PendingPublicationsProvider>
          </NovedadesProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
