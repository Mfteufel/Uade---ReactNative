import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getMyPublications, renewPublication } from '../services/publicationsApi';
import { getErrorMessage } from '../services/errors';

export default function useMyPublications() {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renewingId, setRenewingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPublications(await getMyPublications());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Se recarga cada vez que se vuelve a la pantalla (por ejemplo, después de publicar).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

  return { publications, loading, error, load, renew, renewingId };
}
