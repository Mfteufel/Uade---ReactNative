import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { PendingPublicationsProvider } from './src/context/PendingPublicationsContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <PendingPublicationsProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </PendingPublicationsProvider>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
