import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Page } from '../types';
export function useList<T>(path: string) {
  const [data, setData] = useState<Page<T>>({ items: [], total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      api<Page<T>>(path, { signal: controller.signal })
        .then(setData)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [path, retry]);
  return { data, loading, error, retry: () => setRetry((n) => n + 1) };
}
