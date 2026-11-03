import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { USE_MOCK } from '../config';
import { useAuth } from './AuthContext';
import { getAlerts } from '../services/alertsApi';
import { getFollows } from '../services/followsApi';
import { getErrorMessage } from '../services/errors';

const NovedadesContext = createContext(null);
const POLLING_MS = 30 * 1000; // cada cuánto se le pregunta al servidor si hay novedades

// Alertas y seguidas: las comparten todas las pantallas, junto con los contadores de novedades.
export function NovedadesProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [seguidas, setSeguidas] = useState([]);
  const [cargado, setCargado] = useState(false); // ya llegó la primera respuesta
  const [error, setError] = useState('');

  // Trae las dos listas. La usa el polling y cada pantalla después de un cambio, para no esperar al próximo.
  const recargar = useCallback(async () => {
    // Con el mock no hay backend real: si se le preguntara con una sesión de mentira, respondería 401.
    if (USE_MOCK) {
      setError('Las alertas y las seguidas necesitan el backend real (EXPO_PUBLIC_USE_MOCK=false).');
      return;
    }
    try {
      setAlertas(await getAlerts());
      setSeguidas(await getFollows());
      setCargado(true);
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, []);

  // Polling: con la sesión iniciada pregunta ahora y después cada 30 s. Al cerrar sesión se corta y se vacía todo.
  useEffect(() => {
    if (!isLoggedIn) {
      setAlertas([]);
      setSeguidas([]);
      setCargado(false);
      setError('');
      return;
    }
    recargar();
    const intervalo = setInterval(recargar, POLLING_MS);
    return () => clearInterval(intervalo);
  }, [isLoggedIn, recargar]);

  // Contadores de los avisos: publicaciones nuevas de las alertas y seguidas que cambiaron de estado.
  let alertasNuevas = 0;
  for (const alerta of alertas) alertasNuevas += alerta.cantidadNuevas;
  let seguidasConNovedad = 0;
  for (const seguida of seguidas) if (seguida.tieneNovedad) seguidasConNovedad += 1;

  const value = { alertas, seguidas, cargado, error, recargar, alertasNuevas, seguidasConNovedad };
  return <NovedadesContext.Provider value={value}>{children}</NovedadesContext.Provider>;
}

export function useNovedades() {
  const ctx = useContext(NovedadesContext);
  if (!ctx) throw new Error('useNovedades debe usarse dentro de NovedadesProvider');
  return ctx;
}
