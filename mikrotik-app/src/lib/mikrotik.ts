// Client minimal pour l'API REST de RouterOS v7 (https://help.mikrotik.com/docs/display/ROS/REST+API).
// Toutes les valeurs renvoyées par RouterOS sont des chaînes : "true", "12", "1d02:03:04"...

export type RouterConfig = {
  id: string;
  name: string;
  host: string;
  port?: string;
  https: boolean;
  username: string;
  password: string;
};

export type Row = { '.id': string; [key: string]: string | undefined };

export class MikroTikError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 15000;

function base64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}

export function baseUrl(cfg: Pick<RouterConfig, 'host' | 'port' | 'https'>): string {
  const host = cfg.host.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const port = cfg.port?.trim();
  return `${cfg.https ? 'https' : 'http'}://${host}${port ? `:${port}` : ''}/rest`;
}

export class MikroTik {
  private url: string;
  private auth: string;

  constructor(cfg: RouterConfig) {
    this.url = baseUrl(cfg);
    this.auth = 'Basic ' + base64(`${cfg.username}:${cfg.password}`);
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(this.url + path, {
        method,
        headers: {
          Authorization: this.auth,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new MikroTikError("Le routeur ne répond pas (délai dépassé). Vérifiez l'adresse et le port.", 0);
      }
      throw new MikroTikError(
        "Connexion impossible. Vérifiez l'adresse, le port, le service www/www-ssl et votre connexion internet.",
        0,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data: any = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      if (res.status === 401) throw new MikroTikError('Identifiant ou mot de passe incorrect.', 401);
      if (res.status === 404) throw new MikroTikError("Cette fonction n'existe pas sur ce routeur.", 404);
      const detail = data?.detail || data?.message || `Erreur ${res.status}`;
      throw new MikroTikError(detail, res.status);
    }
    return data as T;
  }

  get<T = Row[]>(path: string) {
    return this.request<T>('GET', path);
  }
  /** Crée un élément (PUT dans l'API REST de RouterOS). */
  add(path: string, body: Record<string, string>) {
    return this.request<Row>('PUT', path, body);
  }
  set(path: string, id: string, body: Record<string, string>) {
    return this.request<Row>('PATCH', `${path}/${encodeURIComponent(id)}`, body);
  }
  remove(path: string, id: string) {
    return this.request<void>('DELETE', `${path}/${encodeURIComponent(id)}`);
  }
  /** Exécute une commande (POST), par ex. /system/reboot. */
  run<T = unknown>(path: string, body: Record<string, string> = {}) {
    return this.request<T>('POST', path, body);
  }

  async trafficOnce(iface: string): Promise<{ rx: number; tx: number }> {
    const r = await this.run<Row[]>('/interface/monitor-traffic', { interface: iface, once: '' });
    const row = r?.[0] ?? ({} as Row);
    return {
      rx: Number(row['rx-bits-per-second'] ?? 0),
      tx: Number(row['tx-bits-per-second'] ?? 0),
    };
  }

  /** Exécute un script RouterOS et renvoie sa sortie texte (RouterOS 7.x). */
  async execute(script: string): Promise<string> {
    const r = await this.run<{ ret?: string }>('/execute', { script, 'as-string': '' });
    return r?.ret ?? '';
  }
}

/** Retourne null si le menu n'existe pas sur le routeur (paquet absent). */
export async function getOptional<T = Row[]>(api: MikroTik, path: string): Promise<T | null> {
  try {
    return await api.get<T>(path);
  } catch (e) {
    if (e instanceof MikroTikError && (e.status === 400 || e.status === 404 || e.status === 500)) return null;
    throw e;
  }
}

export const isTrue = (v?: string) => v === 'true' || v === 'yes';

/** Lance des requêtes par petits groupes pour ne pas saturer le routeur. */
export async function inBatches<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  onProgress?: (done: number) => void,
  size = 5,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
    onProgress?.(results.length);
  }
  return results;
}
