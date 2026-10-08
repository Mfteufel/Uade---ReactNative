import { useCallback, useEffect, useState } from 'react';

// Cuenta regresiva en segundos. start(n) la reinicia.
export default function useCountdown(initial = 0) {
  const [seconds, setSeconds] = useState(initial);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const start = useCallback((n) => setSeconds(n), []);
  return [seconds, start];
}
