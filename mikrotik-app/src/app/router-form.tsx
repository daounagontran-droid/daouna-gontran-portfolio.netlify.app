import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { confirm, notify, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Button, Card, Field, Screen, Toggle } from '@/components/ui';
import { useRouters } from '@/context/RouterContext';
import { MikroTik, type RouterConfig } from '@/lib/mikrotik';
import { newId } from '@/lib/storage';

export default function RouterFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { routers, save, remove } = useRouters();
  const existing = routers.find((r) => r.id === id);

  const [form, setForm] = useState<RouterConfig>(
    existing ?? {
      id: newId(),
      name: 'Mon routeur',
      host: '192.168.88.1',
      port: '',
      https: false,
      username: 'admin',
      password: '',
    },
  );
  const [testing, setTesting] = useState(false);
  const set = (patch: Partial<RouterConfig>) => setForm((f) => ({ ...f, ...patch }));

  async function test() {
    setTesting(true);
    try {
      const api = new MikroTik(form);
      const [identity, res] = await Promise.all([
        api.get<{ name: string }>('/system/identity'),
        api.get<Record<string, string>>('/system/resource'),
      ]);
      notify(
        'Connexion réussie',
        `${identity.name}\n${res['board-name'] ?? ''} — RouterOS ${res.version ?? ''}`,
      );
    } catch (e) {
      showError(e);
    } finally {
      setTesting(false);
    }
  }

  async function submit() {
    if (!form.host.trim() || !form.username.trim()) {
      notify('Champs manquants', "L'adresse et l'utilisateur sont obligatoires.");
      return;
    }
    try {
      await save({ ...form, name: form.name.trim() || form.host.trim(), host: form.host.trim() });
      router.back();
    } catch (e) {
      showError(e);
    }
  }

  async function onDelete() {
    if (!(await confirm('Supprimer ce routeur ?', `« ${form.name} » sera retiré de l'application.`, 'Supprimer'))) return;
    await remove(form.id);
    router.back();
  }

  return (
    <Screen>
      <Card>
        <Field label="Nom" value={form.name} onChangeText={(name) => set({ name })} autoCapitalize="words" />
        <Field
          label="Adresse du routeur"
          value={form.host}
          onChangeText={(host) => set({ host })}
          placeholder="192.168.88.1 ou xxxx.sn.mynetname.net"
          keyboardType="url"
          hint="IP locale, IP publique ou nom DDNS (IP › Cloud)."
        />
        <Toggle
          label="Connexion sécurisée (HTTPS)"
          value={form.https}
          onChange={(https) => set({ https })}
          hint="Obligatoire depuis internet. Nécessite un certificat valide (Let's Encrypt)."
        />
        <Field
          label="Port (optionnel)"
          value={form.port}
          onChangeText={(port) => set({ port: port.replace(/\D/g, '') })}
          placeholder={form.https ? '443' : '80'}
          keyboardType="number-pad"
        />
      </Card>

      <Card>
        <Field label="Utilisateur" value={form.username} onChangeText={(username) => set({ username })} />
        <Field
          label="Mot de passe"
          value={form.password}
          onChangeText={(password) => set({ password })}
          secureTextEntry
          hint="Conservé chiffré dans le trousseau du téléphone."
        />
      </Card>

      {!form.https && (
        <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 4 }}>
          En HTTP, le mot de passe circule en clair. Réservez ce mode au réseau local ou à un tunnel VPN.
        </Text>
      )}

      <Button title="Tester la connexion" icon="pulse" variant="secondary" loading={testing} onPress={test} />
      <Button title="Enregistrer" icon="save-outline" onPress={submit} />
      {existing && <Button title="Supprimer ce routeur" icon="trash-outline" variant="ghost" onPress={onDelete} />}
    </Screen>
  );
}
