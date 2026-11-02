import { getOptional, isTrue, type MikroTik, type Row } from './mikrotik';

// RouterOS a trois menus Wi-Fi selon le matériel et la version :
//  - /interface/wireless   : ancien pilote (hAP lite, hAP ac², cAP, SXT…)
//  - /interface/wifi       : nouveau pilote (RouterOS 7.13+, hAP ax², ax³, cAP ax…)
//  - /interface/wifiwave2  : nom du nouveau pilote avant RouterOS 7.13
export type WifiKind = 'wireless' | 'wifi' | 'wifiwave2';

const PREFIX: Record<WifiKind, string> = {
  wireless: '/interface/wireless',
  wifi: '/interface/wifi',
  wifiwave2: '/interface/wifiwave2',
};

export type WifiIface = {
  id: string;
  name: string;
  kind: WifiKind;
  ssid: string;
  disabled: boolean;
  running: boolean;
  hidden: boolean;
  open: boolean;
  band: string;
  frequency: string;
  securityProfile?: string;
  raw: Row;
};

export type WifiClient = {
  id: string;
  kind: WifiKind;
  mac: string;
  iface: string;
  signal?: string;
  txRate?: string;
  rxRate?: string;
  uptime?: string;
  ip?: string;
};

export async function loadWifi(api: MikroTik): Promise<{ kind: WifiKind | null; ifaces: WifiIface[] }> {
  for (const kind of ['wifi', 'wifiwave2', 'wireless'] as WifiKind[]) {
    const rows = await getOptional(api, PREFIX[kind]);
    if (!rows || rows.length === 0) continue;

    if (kind === 'wireless') {
      const profiles = (await getOptional(api, `${PREFIX.wireless}/security-profiles`)) ?? [];
      return {
        kind,
        ifaces: rows.map((r) => {
          const profile = profiles.find((p) => p.name === r['security-profile']);
          return {
            id: r['.id'],
            name: r.name ?? '',
            kind,
            ssid: r.ssid ?? '',
            disabled: isTrue(r.disabled),
            running: isTrue(r.running),
            hidden: isTrue(r['hide-ssid']),
            open: !profile || profile.mode === 'none',
            band: r.band ?? '',
            frequency: r.frequency ?? '',
            securityProfile: r['security-profile'],
            raw: r,
          };
        }),
      };
    }

    const configs = (await getOptional(api, `${PREFIX[kind]}/configuration`)) ?? [];
    const securities = (await getOptional(api, `${PREFIX[kind]}/security`)) ?? [];
    return {
      kind,
      ifaces: rows.map((r) => {
        const cfg = configs.find((c) => c.name === r.configuration);
        const sec = securities.find((s) => s.name === (r['security'] ?? cfg?.security));
        const auth = r['security.authentication-types'] ?? sec?.['authentication-types'] ?? '';
        return {
          id: r['.id'],
          name: r.name ?? '',
          kind,
          ssid: r['configuration.ssid'] ?? cfg?.ssid ?? '',
          disabled: isTrue(r.disabled),
          running: isTrue(r.running),
          hidden: isTrue(r['configuration.hide-ssid'] ?? cfg?.['hide-ssid']),
          open: auth === '',
          band: r['channel.band'] ?? r.band ?? '',
          frequency: r['channel.frequency'] ?? r.frequency ?? '',
          raw: r,
        };
      }),
    };
  }
  return { kind: null, ifaces: [] };
}

export async function loadWifiClients(api: MikroTik, kind: WifiKind): Promise<WifiClient[]> {
  const rows = (await getOptional(api, `${PREFIX[kind]}/registration-table`)) ?? [];
  return rows.map((r) => ({
    id: r['.id'],
    kind,
    mac: r['mac-address'] ?? '',
    iface: r.interface ?? '',
    signal: r['signal-strength'] ?? r.signal,
    txRate: r['tx-rate'],
    rxRate: r['rx-rate'],
    uptime: r.uptime,
    ip: r['last-ip'],
  }));
}

export async function setEnabled(api: MikroTik, iface: WifiIface, enabled: boolean) {
  await api.set(PREFIX[iface.kind], iface.id, { disabled: enabled ? 'false' : 'true' });
}

export async function updateWifi(
  api: MikroTik,
  iface: WifiIface,
  changes: { ssid: string; hidden: boolean; open: boolean; password?: string },
) {
  const { ssid, hidden, open, password } = changes;

  if (iface.kind === 'wireless') {
    await api.set(PREFIX.wireless, iface.id, { ssid, 'hide-ssid': hidden ? 'yes' : 'no' });
    if (!iface.securityProfile) return;
    const [profile] = await api.get(
      `${PREFIX.wireless}/security-profiles?name=${encodeURIComponent(iface.securityProfile)}`,
    );
    if (!profile) return;
    if (open) {
      await api.set(`${PREFIX.wireless}/security-profiles`, profile['.id'], { mode: 'none' });
    } else if (password) {
      await api.set(`${PREFIX.wireless}/security-profiles`, profile['.id'], {
        mode: 'dynamic-keys',
        'authentication-types': 'wpa2-psk',
        'wpa2-pre-shared-key': password,
      });
    }
    return;
  }

  // Nouveau pilote : les réglages posés directement sur l'interface
  // ont priorité sur les profils de configuration et de sécurité.
  const body: Record<string, string> = {
    'configuration.ssid': ssid,
    'configuration.hide-ssid': hidden ? 'yes' : 'no',
  };
  if (open) body['security.authentication-types'] = '';
  else if (password) {
    body['security.authentication-types'] = 'wpa2-psk,wpa3-psk';
    body['security.passphrase'] = password;
  }
  await api.set(PREFIX[iface.kind], iface.id, body);
}

export async function disconnectClient(api: MikroTik, client: WifiClient) {
  await api.remove(`${PREFIX[client.kind]}/registration-table`, client.id);
}

export const BLOCK_COMMENT = "Bloqué depuis l'application";

export async function blockClient(api: MikroTik, client: WifiClient) {
  const body: Record<string, string> =
    client.kind === 'wireless'
      ? { 'mac-address': client.mac, authentication: 'no', forwarding: 'no', comment: BLOCK_COMMENT }
      : { 'mac-address': client.mac, action: 'reject', comment: BLOCK_COMMENT };
  await api.add(`${PREFIX[client.kind]}/access-list`, body);
  await disconnectClient(api, client).catch(() => undefined);
}

export async function loadBlocked(api: MikroTik, kind: WifiKind): Promise<Row[]> {
  const rows = (await getOptional(api, `${PREFIX[kind]}/access-list`)) ?? [];
  return rows.filter((r) => r.action === 'reject' || r.authentication === 'false' || r.authentication === 'no');
}

export async function unblock(api: MikroTik, kind: WifiKind, id: string) {
  await api.remove(`${PREFIX[kind]}/access-list`, id);
}
