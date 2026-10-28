import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { MikroTik, type RouterConfig } from '@/lib/mikrotik';
import * as storage from '@/lib/storage';

type RouterState = {
  routers: RouterConfig[];
  ready: boolean;
  current: RouterConfig | null;
  api: MikroTik | null;
  connect: (router: RouterConfig) => void;
  disconnect: () => void;
  save: (router: RouterConfig) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const Ctx = createContext<RouterState | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<RouterConfig | null>(null);

  useEffect(() => {
    storage
      .loadRouters()
      .then(setRouters)
      .catch(() => setRouters([]))
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(async (router: RouterConfig) => {
    await storage.saveRouter(router);
    setRouters(await storage.loadRouters());
    setCurrent((c) => (c?.id === router.id ? router : c));
  }, []);

  const remove = useCallback(async (id: string) => {
    await storage.deleteRouter(id);
    setRouters(await storage.loadRouters());
    setCurrent((c) => (c?.id === id ? null : c));
  }, []);

  const api = useMemo(() => (current ? new MikroTik(current) : null), [current]);

  const value = useMemo<RouterState>(
    () => ({
      routers,
      ready,
      current,
      api,
      connect: setCurrent,
      disconnect: () => setCurrent(null),
      save,
      remove,
    }),
    [routers, ready, current, api, save, remove],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouters(): RouterState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRouters doit être utilisé dans RouterProvider');
  return ctx;
}

/** API du routeur connecté ; les écrans des onglets ne s'affichent que connectés. */
export function useApi(): MikroTik {
  const { api } = useRouters();
  if (!api) throw new Error('Aucun routeur connecté');
  return api;
}
