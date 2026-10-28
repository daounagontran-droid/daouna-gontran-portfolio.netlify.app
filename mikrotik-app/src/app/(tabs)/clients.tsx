import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useActionSheet, type SheetAction } from '@/components/ActionSheet';
import { confirm, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Badge, Button, Card, Chips, Divider, Empty, ErrorBox, Loading, Row, Screen } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { formatBytes, formatDuration, signalInfo } from '@/lib/format';
import { getOptional, type Row as RosRow } from '@/lib/mikrotik';
import { useResource } from '@/lib/useResource';
import { blockClient, disconnectClient, loadWifi, loadWifiClients, type WifiClient } from '@/lib/wifi';

type Tab = 'wifi' | 'hotspot';

export default function ClientsScreen() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('wifi');
  const sheet = useActionSheet();
  const menu = (title: string, actions: SheetAction[]) => sheet.show(title, actions);

  const res = useResource(async () => {
    const [wifi, hotspot, leases] = await Promise.all([
      loadWifi(api),
      getOptional(api, '/ip/hotspot/active'),
      getOptional(api, '/ip/dhcp-server/lease'),
    ]);
    const clients = wifi.kind ? await loadWifiClients(api, wifi.kind) : [];
    const names = new Map<string, RosRow>();
    for (const l of leases ?? []) if (l['mac-address']) names.set(l['mac-address'].toUpperCase(), l);
    return { clients, hotspot, names };
  }, 10000);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await res.reload();
    } catch (e) {
      showError(e);
    }
  }

  function wifiMenu(c: WifiClient, label: string) {
    menu(label, [
      { label: 'Déconnecter', icon: 'exit-outline', run: () => act(() => disconnectClient(api, c)) },
      {
        label: 'Bloquer cet appareil',
        icon: 'ban',
        destructive: true,
        run: async () => {
          if (await confirm('Bloquer cet appareil ?', `${label} ne pourra plus se connecter au Wi-Fi. Vous pourrez le débloquer depuis l'onglet Wi-Fi.`, 'Bloquer'))
            act(() => blockClient(api, c));
        },
      },
    ]);
  }

  function hotspotMenu(s: RosRow) {
    menu(s.user ?? '', [
      {
        label: 'Déconnecter la session',
        icon: 'exit-outline',
        destructive: true,
        run: () => act(() => api.remove('/ip/hotspot/active', s['.id'])),
      },
    ]);
  }

  const d = res.data;

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      {sheet.element}
      <Chips
        options={[
          { value: 'wifi', label: `Appareils Wi-Fi${d ? ` (${d.clients.length})` : ''}` },
          { value: 'hotspot', label: `Sessions hotspot${d?.hotspot ? ` (${d.hotspot.length})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {res.error && <ErrorBox message={res.error} onRetry={res.refresh} />}
      {res.loading && !d ? (
        <Loading />
      ) : !d ? null : tab === 'wifi' ? (
        <Card>
          {d.clients.length === 0 ? (
            <Empty icon="phone-portrait-outline" text="Aucun appareil connecté au Wi-Fi." />
          ) : (
            d.clients.map((c, i) => {
              const lease = d.names.get(c.mac.toUpperCase());
              const label = lease?.['host-name'] || lease?.comment || c.mac;
              const sig = signalInfo(c.signal);
              return (
                <View key={c.id} style={{ gap: 10 }}>
                  {i > 0 && <Divider />}
                  <Row
                    icon="phone-portrait-outline"
                    title={label}
                    subtitle={`${lease?.address ?? c.ip ?? c.mac} · ${c.iface} · ${formatDuration(c.uptime)}`}
                    right={<Badge text={sig.dbm === null ? '—' : `${sig.dbm} dBm`} tone={(['danger', 'warn', 'ok', 'ok'] as const)[sig.level]} />}
                    onPress={() => wifiMenu(c, label)}
                  />
                </View>
              );
            })
          )}
        </Card>
      ) : (
        <Card>
          {d.hotspot === null ? (
            <Empty icon="ticket-outline" text="Le hotspot n'est pas configuré sur ce routeur." />
          ) : d.hotspot.length === 0 ? (
            <Empty icon="ticket-outline" text="Aucune session hotspot en cours." />
          ) : (
            d.hotspot.map((s, i) => (
              <View key={s['.id']} style={{ gap: 10 }}>
                {i > 0 && <Divider />}
                <Row
                  icon="ticket-outline"
                  iconColor={colors.gold}
                  title={s.user}
                  subtitle={`${s.address} · connecté depuis ${formatDuration(s.uptime)}${
                    s['session-time-left'] ? ` · reste ${formatDuration(s['session-time-left'])}` : ''
                  }\n↓ ${formatBytes(s['bytes-out'])} · ↑ ${formatBytes(s['bytes-in'])}`}
                  onPress={() => hotspotMenu(s)}
                />
              </View>
            ))
          )}
        </Card>
      )}
      <Button title="Voir tous les baux DHCP" icon="list-outline" variant="secondary" onPress={() => router.push('/dhcp')} />
    </Screen>
  );
}
