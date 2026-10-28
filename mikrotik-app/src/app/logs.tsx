import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { colors } from '@/components/theme';
import { Card, Chips, Divider, ErrorBox, Field, Loading, Screen } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { useResource } from '@/lib/useResource';

type Filter = 'all' | 'error' | 'hotspot' | 'wireless' | 'system';

const MAX_LINES = 300;

export default function LogsScreen() {
  const api = useApi();
  const res = useResource(() => api.get('/log'), 10000);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (res.data ?? [])
      .slice(-1000)
      .reverse()
      .filter((l) => {
        const topics = l.topics ?? '';
        if (filter === 'error' && !/error|critical|warning/.test(topics)) return false;
        if (filter === 'hotspot' && !topics.includes('hotspot')) return false;
        if (filter === 'wireless' && !/wireless|wifi|caps/.test(topics)) return false;
        if (filter === 'system' && !topics.includes('system')) return false;
        return !q || l.message?.toLowerCase().includes(q);
      })
      .slice(0, MAX_LINES);
  }, [res.data, filter, query]);

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      <Chips
        options={[
          { value: 'all', label: 'Tout' },
          { value: 'error', label: 'Erreurs' },
          { value: 'hotspot', label: 'Hotspot' },
          { value: 'wireless', label: 'Wi-Fi' },
          { value: 'system', label: 'Système' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <Field label="Rechercher" value={query} onChangeText={setQuery} placeholder="ex. login failed" />
      {res.error && <ErrorBox message={res.error} onRetry={res.refresh} />}
      {res.loading && !res.data ? (
        <Loading />
      ) : (
        <Card>
          {lines.length === 0 && <Text style={{ color: colors.muted }}>Aucune entrée.</Text>}
          {lines.map((l, i) => {
            const isError = /error|critical/.test(l.topics ?? '');
            return (
              <View key={l['.id']} style={{ gap: 6 }}>
                {i > 0 && <Divider />}
                <Text style={{ fontSize: 11, color: isError ? colors.danger : colors.muted }}>
                  {l.time} · {l.topics}
                </Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{l.message}</Text>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
