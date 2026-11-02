import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/**
 * Charge des données depuis le routeur à chaque fois que l'écran est affiché,
 * avec gestion du tirer-pour-rafraîchir et des erreurs.
 */
export function useResource<T>(loader: () => Promise<T>, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      setData(await loaderRef.current());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load('initial');
      if (!intervalMs) return;
      const timer = setInterval(() => load('silent'), intervalMs);
      return () => clearInterval(timer);
    }, [load, intervalMs]),
  );

  return {
    data,
    error,
    loading,
    refreshing,
    refresh: () => load('refresh'),
    reload: () => load('silent'),
  };
}
