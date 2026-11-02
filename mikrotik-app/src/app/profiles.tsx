import { useState } from 'react';
import { Text, View } from 'react-native';

import { confirm, notify, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Button, Card, Divider, ErrorBox, Field, Loading, Row, Screen, SectionTitle } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import type { Row as RosRow } from '@/lib/mikrotik';
import { useResource } from '@/lib/useResource';

type Form = { id?: string; name: string; down: string; up: string; shared: string };

const empty: Form = { name: '', down: '2', up: '1', shared: '1' };

/** "2M/5M" (envoi/réception côté client) <-> débits en Mbit/s. */
function parseRate(rate?: string): { up: string; down: string } {
  const [up = '', down = ''] = (rate ?? '').split(' ')[0].split('/');
  const toMb = (v: string) => (v.endsWith('M') ? v.slice(0, -1) : v.endsWith('k') ? String(Number(v.slice(0, -1)) / 1000) : v);
  return { up: toMb(up), down: toMb(down) };
}

export default function ProfilesScreen() {
  const api = useApi();
  const profiles = useResource(() => api.get('/ip/hotspot/user/profile'));
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  function edit(p: RosRow) {
    const r = parseRate(p['rate-limit']);
    setForm({ id: p['.id'], name: p.name ?? '', up: r.up, down: r.down, shared: p['shared-users'] ?? '1' });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) return notify('Nom manquant', 'Donnez un nom au forfait.');
    const body: Record<string, string> = {
      name: form.name.trim(),
      'shared-users': form.shared || '1',
      // Pour le hotspot, « rx/tx » est vu depuis le client : envoi/réception.
      'rate-limit': form.up && form.down ? `${form.up}M/${form.down}M` : '',
    };
    setSaving(true);
    try {
      if (form.id) await api.set('/ip/hotspot/user/profile', form.id, body);
      else await api.add('/ip/hotspot/user/profile', body);
      setForm(null);
      await profiles.reload();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: RosRow) {
    if (!(await confirm(`Supprimer « ${p.name} » ?`, 'Les tickets qui utilisent ce profil devront être changés.', 'Supprimer'))) return;
    try {
      await api.remove('/ip/hotspot/user/profile', p['.id']);
      await profiles.reload();
    } catch (e) {
      showError(e);
    }
  }

  if (form) {
    return (
      <Screen>
        <Card>
          <Field label="Nom du forfait" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="ex. 2Mbps" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Débit descendant (Mbit/s)"
                value={form.down}
                onChangeText={(down) => setForm({ ...form, down: down.replace(/[^\d.]/g, '') })}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Débit montant (Mbit/s)"
                value={form.up}
                onChangeText={(up) => setForm({ ...form, up: up.replace(/[^\d.]/g, '') })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Field
            label="Appareils simultanés par ticket"
            value={form.shared}
            onChangeText={(shared) => setForm({ ...form, shared: shared.replace(/\D/g, '') })}
            keyboardType="number-pad"
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Laissez un débit vide pour ne pas limiter.</Text>
        </Card>
        <Button title="Enregistrer" icon="save-outline" loading={saving} onPress={save} />
        <Button title="Annuler" variant="ghost" onPress={() => setForm(null)} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={profiles.refreshing} onRefresh={profiles.refresh}>
      {profiles.error && <ErrorBox message={profiles.error} onRetry={profiles.refresh} />}
      <Button title="Nouveau forfait" icon="add" onPress={() => setForm(empty)} />
      <SectionTitle>Profils utilisateurs hotspot</SectionTitle>
      {profiles.loading && !profiles.data ? (
        <Loading />
      ) : (
        <Card>
          {(profiles.data ?? []).map((p, i) => {
            const r = parseRate(p['rate-limit']);
            return (
              <View key={p['.id']} style={{ gap: 8 }}>
                {i > 0 && <Divider />}
                <Row
                  icon="speedometer-outline"
                  title={p.name}
                  subtitle={`${p['rate-limit'] ? `↓ ${r.down} Mbit/s · ↑ ${r.up} Mbit/s` : 'Débit illimité'} · ${p['shared-users'] ?? 1} appareil(s)`}
                  onPress={() => edit(p)}
                />
                {p.name !== 'default' && (
                  <Button title="Supprimer" small variant="ghost" icon="trash-outline" onPress={() => remove(p)} />
                )}
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
