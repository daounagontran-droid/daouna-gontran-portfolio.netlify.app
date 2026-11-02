import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { confirm, notify, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Button, Card, Divider, ErrorBox, Field, Loading, Row, Screen, SectionTitle } from '@/components/ui';
import { useApi, useRouters } from '@/context/RouterContext';
import { formatBytes, formatDuration } from '@/lib/format';
import { getOptional, type Row as RosRow } from '@/lib/mikrotik';
import { useResource } from '@/lib/useResource';

type Info = {
  identity: string;
  resource: Record<string, string>;
  clock: Record<string, string> | null;
  update: Record<string, string> | null;
  files: RosRow[];
};

export default function SystemScreen() {
  const api = useApi();
  const { disconnect } = useRouters();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const res = useResource<Info>(async () => {
    const [identity, resource, clock, update, files] = await Promise.all([
      api.get<{ name: string }>('/system/identity'),
      api.get<Record<string, string>>('/system/resource'),
      getOptional<Record<string, string>>(api, '/system/clock'),
      getOptional<Record<string, string>>(api, '/system/package/update'),
      getOptional(api, '/file'),
    ]);
    return {
      identity: identity.name,
      resource,
      clock,
      update,
      files: (files ?? []).filter((f) => f.type === 'backup'),
    };
  });

  useEffect(() => {
    if (res.data) setName(res.data.identity);
  }, [res.data?.identity]);

  async function task(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  const rename = () =>
    task('name', async () => {
      await api.run('/system/identity/set', { name: name.trim() });
      await res.reload();
      notify('Nom modifié', `Le routeur s'appelle maintenant « ${name.trim()} ».`);
    });

  const checkUpdates = () =>
    task('check', async () => {
      await api.run('/system/package/update/check-for-updates', { once: '' }).catch(() => undefined);
      await res.reload();
    });

  const installUpdate = () =>
    task('install', async () => {
      const ok = await confirm(
        'Installer la mise à jour ?',
        'Le routeur va télécharger RouterOS puis redémarrer. Internet sera coupé quelques minutes.',
        'Installer',
      );
      if (!ok) return;
      await api.run('/system/package/update/install').catch(() => undefined);
      notify('Mise à jour lancée', 'Le routeur redémarrera tout seul. Reconnectez-vous dans quelques minutes.');
      disconnect();
      router.replace('/');
    });

  const backup = () =>
    task('backup', async () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const file = `app-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
      await api.run('/system/backup/save', { name: file });
      await res.reload();
      notify('Sauvegarde créée', `Fichier ${file}.backup enregistré sur le routeur.`);
    });

  const reboot = () =>
    task('reboot', async () => {
      const ok = await confirm('Redémarrer le routeur ?', 'Tous les clients seront déconnectés pendant environ une minute.', 'Redémarrer');
      if (!ok) return;
      // Le routeur coupe la connexion en redémarrant : l'erreur réseau est normale.
      await api.run('/system/reboot').catch(() => undefined);
      notify('Redémarrage en cours', 'Reconnectez-vous dans une minute environ.');
      disconnect();
      router.replace('/');
    });

  const d = res.data;
  const update = d?.update;
  const hasUpdate = update && update['latest-version'] && update['latest-version'] !== update['installed-version'];

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      {res.error && <ErrorBox message={res.error} onRetry={res.refresh} />}
      {res.loading && !d ? (
        <Loading />
      ) : d ? (
        <>
          <SectionTitle>Informations</SectionTitle>
          <Card>
            <Row icon="hardware-chip-outline" title={d.resource['board-name']} subtitle={`${d.resource['architecture-name'] ?? ''} · ${d.resource['cpu-count'] ?? 1} cœur(s) · ${d.resource['cpu-frequency'] ?? '?'} MHz`} />
            <Divider />
            <Row icon="time-outline" title={`Allumé depuis ${formatDuration(d.resource.uptime)}`} subtitle={d.clock ? `Heure du routeur : ${d.clock.date ?? ''} ${d.clock.time ?? ''}` : undefined} />
          </Card>

          <SectionTitle>Nom du routeur</SectionTitle>
          <Card>
            <Field label="Identité" value={name} onChangeText={setName} />
            <Button title="Renommer" small variant="secondary" loading={busy === 'name'} disabled={!name.trim() || name === d.identity} onPress={rename} />
          </Card>

          <SectionTitle>Mises à jour</SectionTitle>
          <Card>
            <Row
              icon="cloud-download-outline"
              title={`RouterOS ${d.resource.version}`}
              subtitle={
                update?.['latest-version']
                  ? hasUpdate
                    ? `Nouvelle version disponible : ${update['latest-version']} (canal ${update.channel})`
                    : `À jour (canal ${update.channel})`
                  : update?.status ?? 'Vérifiez pour connaître la dernière version.'
              }
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Vérifier" small variant="secondary" icon="refresh" loading={busy === 'check'} onPress={checkUpdates} />
              {hasUpdate && <Button title="Installer" small icon="download-outline" loading={busy === 'install'} onPress={installUpdate} />}
            </View>
          </Card>

          <SectionTitle>Sauvegardes</SectionTitle>
          <Card>
            {d.files.length === 0 ? (
              <Text style={{ color: colors.muted }}>Aucune sauvegarde sur le routeur.</Text>
            ) : (
              d.files.map((f) => <Row key={f.name} icon="archive-outline" title={f.name} subtitle={formatBytes(f.size)} />)
            )}
            <Button title="Créer une sauvegarde" small variant="secondary" icon="save-outline" loading={busy === 'backup'} onPress={backup} />
          </Card>

          <SectionTitle>Alimentation</SectionTitle>
          <Button title="Redémarrer le routeur" icon="power" variant="danger" loading={busy === 'reboot'} onPress={reboot} />
        </>
      ) : null}
    </Screen>
  );
}
