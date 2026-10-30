import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { USE_MOCK } from '../config';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import { createPublication } from '../services/publicationsApi';
import { addPending, deletePhotos, loadPending, markFailed, removePending } from '../services/pendingPublications';
import { getErrorMessage, getErrorStatus, isNetworkError } from '../services/errors';

const PendingPublicationsContext = createContext(null);

// Errores que se arreglan solos (sin red, sesión vencida, servidor caído): se reintenta más tarde.
// Mientras haya pendientes, cada cuánto se reintenta (por ejemplo, con wifi pero sin internet).
const RETRY_MS = 60 * 1000;

const isTemporary = (error) => {
  const status = getErrorStatus(error);
  return isNetworkError(error) || status === 401 || status === 429 || status >= 500;
};

// Va arriba de todo para que las pendientes se manden estés en la pantalla que estés.
export function PendingPublicationsProvider({ children }) {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const userId = user?.id;
  const [pending, setPending] = useState([]);
  const [sentCount, setSentCount] = useState(0); // sube con cada envío, así Mis publicaciones recarga
  const sendingRef = useRef(false);
  // El token es uno solo para toda la app: si cambia la cuenta a mitad del envío, las de la anterior no se mandan.
  const userRef = useRef(userId);
  userRef.current = userId;

  const reload = useCallback(async () => {
    setPending(userId ? await loadPending(userId).catch(() => []) : []);
  }, [userId]);

  const enqueue = async (body, photoUris, neighborhoodName) => {
    await addPending(userId, { body, photoUris, neighborhoodName });
    await reload();
  };

  const discard = async (clientId) => {
    await removePending(userId, clientId);
    deletePhotos(clientId);
    await reload();
  };

  const sendAll = useCallback(async () => {
    if (!userId || sendingRef.current) return;
    sendingRef.current = true;
    try {
      for (const item of await loadPending(userId)) {
        if (userRef.current !== userId) break;
        if (item.error) continue;
        try {
          // Mismo clientId: si ya había llegado en un intento anterior, el servidor no la duplica.
          await createPublication(item.body, item.photoUris);
          await removePending(userId, item.clientId);
          // En el mock, las fotos de la publicación son estas mismas URIs: no se pueden borrar.
          if (!USE_MOCK) deletePhotos(item.clientId);
          setSentCount((n) => n + 1);
        } catch (e) {
          if (isTemporary(e)) break; // se cortó de nuevo, las demás salen en el próximo intento
          await markFailed(userId, item.clientId, getErrorMessage(e));
        }
      }
    } catch {
      // Si no se pudo leer la lista, se prueba la próxima vez.
    } finally {
      sendingRef.current = false;
      if (userRef.current === userId) await reload(); // si cambió la cuenta, no pisar la lista de la nueva
    }
  }, [userId, reload]);

  // Se mandan al entrar y cada vez que vuelve la conexión.
  useEffect(() => {
    reload();
    if (isOnline) sendAll();
  }, [isOnline, reload, sendAll]);

  // Estar conectado no asegura tener internet: si el envío falló, se reintenta al volver a la app
  // y cada tanto mientras siga abierta.
  const waiting = pending.some((item) => !item.error);
  useEffect(() => {
    if (!isOnline || !waiting) return undefined;
    const timer = setInterval(sendAll, RETRY_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sendAll();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isOnline, waiting, sendAll]);

  const value = { pending, sentCount, enqueue, discard, sendAll };
  return <PendingPublicationsContext.Provider value={value}>{children}</PendingPublicationsContext.Provider>;
}

export function usePendingPublications() {
  const ctx = useContext(PendingPublicationsContext);
  if (!ctx) throw new Error('usePendingPublications debe usarse dentro de PendingPublicationsProvider');
  return ctx;
}
