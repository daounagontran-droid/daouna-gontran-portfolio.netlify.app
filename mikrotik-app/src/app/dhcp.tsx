import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useActionSheet } from '@/components/ActionSheet';
import { confirm, showError } from '@/components/confirm';
import { Badge, Card, Divider, Empty, ErrorBox, Field, Loading, Row, Screen } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { getOptional, isTrue, type Row as RosRow } from '@/lib/mikrotik';
import { useResource } from '@/lib/useResource';

export default function DhcpScreen() {
  const api = useApi();
  const res = useResource(() => getOptional(api, '/ip/dhcp-server/lease'));
  const [query, setQuery] = useState('');
  const sheet = useActionSheet();

  const leases = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (res.data ?? []).filter(
      (l) => !q || [l.address, l['mac-address'], l['host-name'], l.comment].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [res.data, query]);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await res.reload();
    } catch (e) {
      showError(e);
    }
  }

  function open(l: RosRow) {
    const blocked = isTrue(l['block-access']);
    const dynamic = isTrue(l.dynamic);
    const name = l['host-name'] || l['mac-address'] || '';
    sheet.show(name, [
      ...(dynamic
        ? [{ label: 'Réserver cette IP (IP fixe)', icon: 'pin-outline' as const, run: () => act(() => api.run('/ip/dhcp-server/lease/make-static', { '.id': l['.id'] })) }]
        : []),
      {
        label: blocked ? "Rétablir l'accès" : "Bloquer l'accès",
        icon: blocked ? 'checkmark-circle-outline' : 'ban',
        destructive: !blocked,
        run: async () => {
          if (dynamic && !blocked) {
            // Un bail dynamique doit d'abord devenir statique pour garder le blocage.
            await act(async () => {
              await api.run('/ip/dhcp-server/lease/make-static', { '.id': l['.id'] });
              const [lease] = await api.get(`/ip/dhcp-server/lease?mac-address=${encodeURIComponent(l['mac-address'] ?? '')}`);
              if (lease) await api.set('/ip/dhcp-server/lease', lease['.id'], { 'block-access': 'yes' });
            });
          } else {
            act(() => api.set('/ip/dhcp-server/lease', l['.id'], { 'block-access': blocked ? 'no' : 'yes' }));
          }
        },
      },
      {
        label: 'Supprimer le bail',
        icon: 'trash-outline',
        destructive: true,
        run: async () => {
          if (await confirm('Supprimer ce bail ?', "L'appareil recevra une nouvelle adresse à sa prochaine connexion.", 'Supprimer'))
            act(() => api.remove('/ip/dhcp-server/lease', l['.id']));
        },
      },
    ], `${l.address} · ${l['mac-address']}`);
  }

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      {sheet.element}
      {res.error && <ErrorBox message={res.error} onRetry={res.refresh} />}
      <Field label="Rechercher" value={query} onChangeText={setQuery} placeholder="IP, MAC ou nom" />
      {res.loading && !res.data ? (
        <Loading />
      ) : (
        <Card>
          {leases.length === 0 ? (
            <Empty icon="list-outline" text="Aucun bail DHCP." />
          ) : (
            leases.map((l, i) => (
              <View key={l['.id']} style={{ gap: 10 }}>
                {i > 0 && <Divider />}
                <Row
                  icon={isTrue(l['block-access']) ? 'ban' : 'laptop-outline'}
                  title={l['host-name'] || l.comment || l['mac-address']}
                  subtitle={`${l.address} · ${l['mac-address']}`}
                  right={
                    isTrue(l['block-access']) ? (
                      <Badge text="bloqué" tone="danger" />
                    ) : (
                      <Badge text={isTrue(l.dynamic) ? (l.status === 'bound' ? 'connecté' : l.status ?? '') : 'IP fixe'} tone={l.status === 'bound' ? 'ok' : 'muted'} />
                    )
                  }
                  onPress={() => open(l)}
                />
              </View>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}
