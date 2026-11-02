export function formatBytes(value?: string | number): string {
  const n = Number(value ?? 0);
  if (!isFinite(n) || n <= 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatBits(value?: number): string {
  const n = Number(value ?? 0);
  if (!isFinite(n) || n <= 0) return '0 bps';
  const units = ['bps', 'kbps', 'Mbps', 'Gbps'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1000)), units.length - 1);
  return `${(n / 1000 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convertit une durée RouterOS ("1w2d03:04:05", "3h20m", "45s") en secondes. */
export function parseDuration(value?: string): number {
  if (!value) return 0;
  let total = 0;
  const clock = value.match(/(\d+):(\d+):(\d+)/);
  if (clock) total += +clock[1] * 3600 + +clock[2] * 60 + +clock[3];
  const rest = value.replace(/(\d+):(\d+):(\d+)/, '');
  const mult: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  for (const [, num, unit] of rest.matchAll(/(\d+)(ms|w|d|h|m|s)/g)) {
    if (unit !== 'ms') total += +num * mult[unit];
  }
  return total;
}

/** Affiche une durée RouterOS en français : "2 j 3 h 4 min". */
export function formatDuration(value?: string): string {
  const s = parseDuration(value);
  if (s === 0) return value === undefined ? '—' : '0 s';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d} j`);
  if (h) parts.push(`${h} h`);
  if (m && !d) parts.push(`${m} min`);
  if (!d && !h && (sec || !m)) parts.push(`${sec} s`);
  return parts.join(' ');
}

export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
}

/** Puissance du signal Wi-Fi ("-63@1Mbps" ou "-63") vers une qualité lisible. */
export function signalInfo(value?: string): { dbm: number | null; label: string; level: 0 | 1 | 2 | 3 } {
  const dbm = value ? parseInt(value, 10) : NaN;
  if (isNaN(dbm)) return { dbm: null, label: '—', level: 0 };
  if (dbm >= -60) return { dbm, label: 'Excellent', level: 3 };
  if (dbm >= -70) return { dbm, label: 'Bon', level: 2 };
  if (dbm >= -80) return { dbm, label: 'Faible', level: 1 };
  return { dbm, label: 'Très faible', level: 0 };
}
