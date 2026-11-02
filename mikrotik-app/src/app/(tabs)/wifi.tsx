import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { confirm, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Badge, Button, Card, Divider, Empty, ErrorBox, Loading, Row, Screen, SectionTitle } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { useResource } from '@/lib/useResource';
import { loadBlocked, loadWifi, setEnabled, unblock, type WifiIface } from '@/lib/wifi';

export default function WifiScreen() {
  const api = useApi();
  const [busy, setBusy] = useState<string | null>(null);

  const wifi = useResource(async () => {
    const data = await loadWifi(api);
    const blocked = data.kind ? await loadBlocked(api, data.kind) : [];
    return { ...data, blocked };
  });

  async function toggle(iface: WifiIface, enabled: boolean) {
    if (
      !enabled &&
      !(await confirm(
        `Couper « ${iface.ssid || iface.name} » ?`,
        "Les clients connectés à ce réseau seront déconnectés. Si vous gérez le routeur via ce Wi-Fi, vous perdrez l'accès.",
        'Couper',
      ))
    )
      return;
    setBusy(iface.id);
    try {
      await setEnabled(api, iface, enabled);
      await wifi.reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  const d = wifi.data;

  return (
    <Screen refreshing={wifi.refreshing} onRefresh={wifi.refresh}>
      {wifi.error && <ErrorBox message={wifi.error} onRetry={wifi.refresh} />}
      {wifi.loading && !d ? (
        <Loading />
      ) : d && d.ifaces.length === 0 ? (
        <Card>
          <Empty icon="wifi-outline" text="Aucune interface Wi-Fi trouvée sur ce routeur." />
        </Card>
      ) : (
        d?.ifaces.map((iface) => (
          <Card key={iface.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{iface.ssid || '(sans nom)'}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  {[iface.name, iface.band, iface.frequency && `${iface.frequency} MHz`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Switch
                value={!iface.disabled}
                disabled={busy === iface.id}
                onValueChange={(v) => toggle(iface, v)}
                trackColor={{ true: colors.navy }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Badge
                text={iface.disabled ? 'Désactivé' : iface.running ? 'En service' : 'Inactif'}
                tone={iface.disabled ? 'muted' : iface.running ? 'ok' : 'warn'}
              />
              <Badge text={iface.open ? 'Ouvert (hotspot)' : 'Protégé par mot de passe'} tone="info" />
              {iface.hidden && <Badge text="Masqué" tone="muted" />}
            </View>
            <Button
              title="Nom et mot de passe"
              icon="create-outline"
              variant="secondary"
              small
              onPress={() => router.push({ pathname: '/wifi-edit', params: { id: iface.id } })}
            />
          </Card>
        ))
      )}

      {d && d.kind && (
        <>
          <SectionTitle>Appareils bloqués</SectionTitle>
          <Card>
            {d.blocked.length === 0 ? (
              <Text style={{ color: colors.muted }}>
                Aucun appareil bloqué. Bloquez un appareil depuis l'onglet Clients.
              </Text>
            ) : (
              d.blocked.map((b, i) => (
                <View key={b['.id']} style={{ gap: 10 }}>
                  {i > 0 && <Divider />}
                  <Row
                    icon="ban"
                    iconColor={colors.danger}
                    title={b['mac-address'] ?? '?'}
                    subtitle={b.comment}
                    right={
                      <Button
                        title="Débloquer"
                        small
                        variant="secondary"
                        onPress={async () => {
                          try {
                            await unblock(api, d.kind!, b['.id']);
                            await wifi.reload();
                          } catch (e) {
                            showError(e);
                          }
                        }}
                      />
                    }
                  />
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
