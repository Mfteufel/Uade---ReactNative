import { createContext, useContext } from 'react';
import { useNetworkState } from 'expo-network';

const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  const state = useNetworkState();
  // Solo miramos isConnected: isInternetReachable tarda unos segundos en confirmarse cuando vuelve la red.
  // Mientras no se sabe (undefined), asumimos que hay conexión.
  const isOnline = state.isConnected !== false;
  return <NetworkContext.Provider value={{ isOnline }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork debe usarse dentro de NetworkProvider');
  return ctx;
}
