import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMe, getReputation } from '../services/userApi';
import { getErrorMessage } from '../services/errors';

export default function useMyProfile() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reputation, setReputation] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const me = await getMe();
      setUser(me);
      setReputation(await getReputation(me.id));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    load();
  }, [load]);

  return { user, loading, reputation, error, load };
}
