import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/components/theme';
import { Card, Chips, ErrorBox, Loading, ProgressBar, Row, Screen, SectionTitle, Stat } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { formatBits, formatBytes, formatDuration } from '@/lib/format';
import { getOptional, isTrue, type Row as RosRow } from '@/lib/mikrotik';
import { useResource } from '@/lib/useResource';
import { loadWifi, loadWifiClients } from '@/lib/wifi';

type Overview = {
  identity: string;
  resource: Record<string, string>;
  routerboard: Record<string, string> | null;
  health: RosRow[];
  cloud: Record<string, string> | null;
  interfaces: RosRow[];
  wifiClients: number;
  hotspotActive: number | null;
  leases: number;
};

const HISTORY = 30;

export default function DashboardScreen() {
  const api = useApi();

  const overview = useResource<Overview>(async () => {
    const [identity, resource, routerboard, health, cloud, interfaces, hotspot, leases, wifi] = await Promise.all([
      api.get<{ name: string }>('/system/identity'),
      api.get<Record<string, string>>('/system/resource'),
      getOptional<Record<string, string>>(api, '/system/routerboard'),
      getOptional(api, '/system/health'),
      getOptional<Record<string, string>>(api, '/ip/cloud'),
      api.get('/interface'),
      getOptional(api, '/ip/hotspot/active'),
      getOptional(api, '/ip/dhcp-server/lease'),
      loadWifi(api),
    ]);
    const wifiClients = wifi.kind ? (await loadWifiClients(api, wifi.kind)).length : 0;
    return {
      identity: identity.name,
      resource,
      routerboard,
      health: Array.isArray(health) ? health : [],
      cloud,
      interfaces,
      wifiClients,
      hotspotActive: hotspot ? hotspot.length : null,
      leases: leases ? leases.filter((l) => l.status === 'bound').length : 0,
    };
  }, 15000);

  const d = overview.data;
  const ifaceOptions = (d?.interfaces ?? [])
    .filter((i) => isTrue(i.running) && ['ether', 'wlan', 'wifi', 'bridge', 'pppoe-out', 'lte'].includes(i.type ?? ''))
    .map((i) => ({ value: i.name ?? '', label: i.name ?? '' }));

  return (
    <Screen refreshing={overview.refreshing} onRefresh={overview.refresh}>
      {overview.error && <ErrorBox message={overview.error} onRetry={overview.refresh} />}
      {overview.loading && !d ? (
        <Loading />
      ) : d ? (
        <>
          <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy }}>
            <Text style={{ color: colors.gold, fontWeight: '700' }}>{d.routerboard?.model ?? d.resource['board-name']}</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{d.identity}</Text>
            <Text style={{ color: '#cbd5e1' }}>
              RouterOS {d.resource.version} · allumé depuis {formatDuration(d.resource.uptime)}
            </Text>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Stat icon="wifi" label="Appareils Wi-Fi" value={String(d.wifiClients)} />
            <Stat
              icon="ticket"
              label="Sessions hotspot"
              value={d.hotspotActive === null ? '—' : String(d.hotspotActive)}
            />
            <Stat icon="git-network" label="Baux DHCP actifs" value={String(d.leases)} />
            <Stat icon="speedometer" label="Processeur" value={`${d.resource['cpu-load'] ?? 0} %`} />
          </View>

          <SectionTitle>Trafic en direct</SectionTitle>
          {ifaceOptions.length > 0 && <TrafficCard options={ifaceOptions} />}

          <SectionTitle>Ressources</SectionTitle>
          <Card>
            <Usage
              label="Mémoire"
              used={Number(d.resource['total-memory']) - Number(d.resource['free-memory'])}
              total={Number(d.resource['total-memory'])}
            />
            <Usage
              label="Stockage"
              used={Number(d.resource['total-hdd-space']) - Number(d.resource['free-hdd-space'])}
              total={Number(d.resource['total-hdd-space'])}
            />
            {d.health
              .filter((h) => h.name && h.value)
              .map((h) => (
                <Row
                  key={h['.id'] ?? h.name}
                  icon={h.name?.includes('temp') ? 'thermometer-outline' : 'flash-outline'}
                  title={healthLabel(h.name!)}
                  right={<Text style={{ fontWeight: '700' }}>{`${h.value} ${h.type ?? ''}`}</Text>}
                />
              ))}
          </Card>

          {d.cloud && (
            <>
              <SectionTitle>Accès à distance (IP › Cloud)</SectionTitle>
              <Card>
                <Row
                  icon="cloud-outline"
                  title={d.cloud['dns-name'] || 'DDNS désactivé'}
                  subtitle={d.cloud['public-address'] ? `IP publique : ${d.cloud['public-address']}` : undefined}
                />
              </Card>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function healthLabel(name: string): string {
  const labels: Record<string, string> = {
    temperature: 'Température',
    'cpu-temperature': 'Température processeur',
    'board-temperature1': 'Température carte',
    voltage: 'Tension',
    'psu1-voltage': 'Tension alimentation',
  };
  return labels[name] ?? name;
}

function Usage({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '600', color: colors.text }}>{label}</Text>
        <Text style={{ color: colors.muted }}>
          {formatBytes(used)} / {formatBytes(total)}
        </Text>
      </View>
      <ProgressBar value={pct} />
    </View>
  );
}

function TrafficCard({ options }: { options: { value: string; label: string }[] }) {
  const api = useApi();
  const [iface, setIface] = useState(options[0].value);
  const [history, setHistory] = useState<{ rx: number; tx: number }[]>([]);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!focused) return;
    let alive = true;
    setHistory([]);
    const tick = async () => {
      try {
        const t = await api.trafficOnce(iface);
        if (alive) setHistory((h) => [...h.slice(-(HISTORY - 1)), t]);
      } catch {
        // Une mesure manquée n'est pas grave, la suivante arrive dans 2 s.
      }
    };
    tick();
    const timer = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [api, iface, focused]);

  const last = history[history.length - 1] ?? { rx: 0, tx: 0 };
  const max = Math.max(1, ...history.map((h) => Math.max(h.rx, h.tx)));

  return (
    <Card>
      <Chips options={options} value={iface} onChange={setIface} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 18 }}>↓ {formatBits(last.rx)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Réception</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 18 }}>↑ {formatBits(last.tx)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Envoi</Text>
        </View>
      </View>
      <View style={{ height: 70, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {Array.from({ length: HISTORY }, (_, i) => history[i - (HISTORY - history.length)]).map((h, i) => (
          <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', gap: 1 }}>
            <View style={{ height: `${((h?.tx ?? 0) / max) * 50}%`, backgroundColor: colors.gold, borderRadius: 1 }} />
            <View style={{ height: `${((h?.rx ?? 0) / max) * 50}%`, backgroundColor: colors.blue, borderRadius: 1 }} />
          </View>
        ))}
      </View>
    </Card>
  );
}
