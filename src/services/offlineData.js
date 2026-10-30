import { clearCache, lastResultsCache, myPublicationsCache } from './offlineCache';
import { clearPending } from './pendingPublications';
import { clearViewed } from './viewedPublications';

// Todo lo que el modo sin conexión guarda de un usuario en el celular. Se borra al cerrar sesión.
// Si una parte falla, se siguen borrando las demás.
export async function clearOfflineData(userId) {
  await Promise.allSettled([
    clearViewed(userId),
    clearPending(userId),
    clearCache(myPublicationsCache(userId)),
    clearCache(lastResultsCache(userId)),
  ]);
}
