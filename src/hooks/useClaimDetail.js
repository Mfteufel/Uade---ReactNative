import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { acceptClaim, getClaim, rejectClaim } from '../services/claimsApi';
import { getErrorMessage } from '../services/errors';

// Detalle de un reclamo y, para el publicador, aceptar o rechazar.
// El servidor es la fuente de verdad: si el estado cambió mientras la pantalla estaba abierta,
// el error 409 se muestra y se vuelve a pedir el reclamo.
export default function useClaimDetail(claimId) {
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [actionError, setActionError] = useState('');
  const decidingRef = useRef(false); // evita la doble pulsación

  const load = useCallback(async () => {
    setError('');
    try {
      setClaim(await getClaim(claimId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const decide = async (action) => {
    if (decidingRef.current) return;
    decidingRef.current = true;
    setDeciding(true);
    setActionError('');
    try {
      setClaim(await action(claimId)); // respuesta real del servidor con el estado nuevo
    } catch (e) {
      setActionError(getErrorMessage(e));
      await load();
    } finally {
      decidingRef.current = false;
      setDeciding(false);
    }
  };

  return {
    claim, loading, error, load,
    deciding, actionError,
    onAccept: () => decide(acceptClaim),
    onReject: () => decide(rejectClaim),
  };
}
