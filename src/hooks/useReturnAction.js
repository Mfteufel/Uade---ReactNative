import { useRef, useState } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { getErrorMessage, getErrorStatus } from '../services/errors';
import { showOfflineToast } from '../utils/offlineToast';

// Envío de una valoración o un agradecimiento, con guarda contra el doble toque.
// onDone(result): salió bien (201). onStale(): 409/422, el estado de la devolución cambió y hay que recargar.
// Cualquier otro error queda en `error` y el modal sigue abierto para reintentar.
export default function useReturnAction({ onDone, onStale }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const sendingRef = useRef(false);
  const { isOnline } = useNetwork();

  const send = async (request) => {
    if (!isOnline) return showOfflineToast();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const result = await request();
      onDone(result);
    } catch (e) {
      setError(getErrorMessage(e));
      const status = getErrorStatus(e);
      if (status === 409 || status === 422) onStale();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return { sending, error, setError, send, isOnline };
}
