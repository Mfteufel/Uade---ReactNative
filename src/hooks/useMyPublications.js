import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { usePendingPublications } from '../context/PendingPublicationsContext';
import { getMyPublications, renewPublication } from '../services/publicationsApi';
import { readCache, writeCache } from '../services/offlineCache';
import { getErrorMessage, isNetworkError } from '../services/errors';
import { categoryName } from '../constants/categories';

// Le damos a la pendiente la forma de una publicación para usar la misma tarjeta.
const pendingToCard = (item) => ({
  id: item.clientId,
  title: item.body.title,
  type: item.body.type,
  category: { name: categoryName(item.body.categoryId) },
  neighborhood: { name: item.neighborhoodName },
  occurredOn: item.body.occurredOn,
  photoUrls: item.photoUris,
  status: 'pending',
  error: item.error,
});

export default function useMyPublications() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { pending, sentCount, sendAll, discard } = usePendingPublications();
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null si los datos vienen del servidor. Sin conexión: { savedAt } de la copia (null si no hay copia).
  const [offlineCopy, setOfflineCopy] = useState(null);
  const [renewingId, setRenewingId] = useState(null);
  const cacheName = `mis_publicaciones_${user.id}`;

  const showCached = useCallback(async () => {
    const cached = await readCache(cacheName);
    setPublications(cached ? cached.data : []);
    setOfflineCopy({ savedAt: cached ? cached.savedAt : null });
  }, [cacheName]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!isOnline) return await showCached();
      const list = await getMyPublications();
      setPublications(list);
      setOfflineCopy(null);
      writeCache(cacheName, list);
    } catch (e) {
      if (isNetworkError(e)) await showCached();
      else setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
    // Con sentCount también recarga: así una pendiente que se mandó aparece ya publicada.
  }, [isOnline, cacheName, showCached, sentCount]);

  // Al entrar, al tirar para refrescar y cuando vuelve la conexión. De paso reintenta las pendientes.
  const refresh = useCallback(() => {
    if (isOnline) sendAll();
    load();
  }, [isOnline, sendAll, load]);

  useFocusEffect(refresh);

  const renew = async (id) => {
    setRenewingId(id);
    setError('');
    try {
      const updated = await renewPublication(id);
      setPublications((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRenewingId(null);
    }
  };

  return {
    publications: [...pending.map(pendingToCard), ...publications],
    loading, error, offlineCopy, isOnline,
    refresh, renew, renewingId, discard,
  };
}
