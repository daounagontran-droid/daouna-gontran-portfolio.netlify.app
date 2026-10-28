import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { confirm, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Badge, Card, Divider, ErrorBox, Loading, Screen } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { formatBytes } from '@/lib/format';
import { isTrue, type Row } from '@/lib/mikrotik';
import { useResource } from '@/lib/useResource';

export default function InterfacesScreen() {
  const api = useApi();
  const res = useResource(() => api.get('/interface'), 10000);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(i: Row, enabled: boolean) {
    if (
      !enabled &&
      !(await confirm(
        `Désactiver ${i.name} ?`,
        "Si vous êtes connecté au routeur par cette interface (ou si c'est l'accès internet), vous perdrez l'accès à distance.",
        'Désactiver',
      ))
    )
      return;
    setBusy(i['.id']);
    try {
      await api.set('/interface', i['.id'], { disabled: enabled ? 'false' : 'true' });
      await res.reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      {res.error && <ErrorBox message={res.error} onRetry={res.refresh} />}
      {res.loading && !res.data ? (
        <Loading />
      ) : (
        <Card>
          {(res.data ?? []).map((i, idx) => {
            const disabled = isTrue(i.disabled);
            const running = isTrue(i.running);
            return (
              <View key={i['.id']} style={{ gap: 10 }}>
                {idx > 0 && <Divider />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>{i.name}</Text>
                      <Badge
                        text={disabled ? 'désactivée' : running ? 'active' : 'débranchée'}
                        tone={disabled ? 'muted' : running ? 'ok' : 'warn'}
                      />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {i.type}
                      {i.comment ? ` · ${i.comment}` : ''} · ↓ {formatBytes(i['rx-byte'])} · ↑ {formatBytes(i['tx-byte'])}
                    </Text>
                  </View>
                  <Switch
                    value={!disabled}
                    disabled={busy === i['.id']}
                    onValueChange={(v) => toggle(i, v)}
                    trackColor={{ true: colors.navy }}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
