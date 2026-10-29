import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getReceivedClaims, getSentClaims } from '../services/claimsApi';
import { getErrorMessage } from '../services/errors';

// "Mis reclamos": enviados y recibidos del usuario. Se vuelven a pedir al servidor cada vez que
// la pantalla recupera el foco, así nunca se muestra un estado viejo (aceptado, vencido, etc.).
export default function useMyClaims() {
  const [tab, setTab] = useState('sent'); // 'sent' | 'received'
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sentList, receivedList] = await Promise.all([getSentClaims(), getReceivedClaims()]);
      setSent(sentList);
      setReceived(receivedList);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { tab, setTab, claims: tab === 'sent' ? sent : received, loading, error, load };
}
