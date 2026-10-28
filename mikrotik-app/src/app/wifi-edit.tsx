import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { confirm, notify, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Button, Card, ErrorBox, Field, Loading, Screen, Toggle } from '@/components/ui';
import { useApi } from '@/context/RouterContext';
import { loadWifi, updateWifi, type WifiIface } from '@/lib/wifi';

export default function WifiEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [iface, setIface] = useState<WifiIface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ssid, setSsid] = useState('');
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWifi(api)
      .then(({ ifaces }) => {
        const found = ifaces.find((i) => i.id === id);
        if (!found) throw new Error('Interface introuvable.');
        setIface(found);
        setSsid(found.ssid);
        setHidden(found.hidden);
        setOpen(found.open);
      })
      .catch((e) => setError(e.message));
  }, [api, id]);

  async function save() {
    if (!iface) return;
    if (!ssid.trim()) return notify('Nom manquant', 'Le nom du réseau (SSID) ne peut pas être vide.');
    if (!open && password && password.length < 8)
      return notify('Mot de passe trop court', 'Le mot de passe Wi-Fi doit contenir au moins 8 caractères.');
    if (!open && iface.open && !password)
      return notify('Mot de passe requis', 'Choisissez un mot de passe pour protéger ce réseau.');
    const ok = await confirm(
      'Appliquer les changements ?',
      'Les appareils connectés vont être déconnectés et devront se reconnecter avec les nouveaux réglages.',
      'Appliquer',
      false,
    );
    if (!ok) return;
    setSaving(true);
    try {
      await updateWifi(api, iface, { ssid: ssid.trim(), hidden, open, password: password || undefined });
      notify('Wi-Fi mis à jour', 'Les nouveaux réglages sont actifs.');
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <Screen>
        <ErrorBox message={error} />
      </Screen>
    );
  }
  if (!iface) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Field label="Nom du réseau (SSID)" value={ssid} onChangeText={setSsid} maxLength={32} />
        <Toggle label="Masquer le réseau" value={hidden} onChange={setHidden} hint="Le réseau n'apparaît plus dans la liste des téléphones." />
      </Card>
      <Card>
        <Toggle
          label="Réseau ouvert"
          value={open}
          onChange={setOpen}
          hint="Pour une Wi-Fi zone : pas de mot de passe Wi-Fi, l'accès se fait par ticket sur la page hotspot."
        />
        {!open && (
          <Field
            label={iface.open ? 'Mot de passe Wi-Fi' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            hint="8 caractères minimum."
          />
        )}
      </Card>
      {iface.kind === 'wireless' && iface.securityProfile && (
        <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 4 }}>
          Le mot de passe est enregistré dans le profil de sécurité « {iface.securityProfile} ». Les autres interfaces
          qui utilisent ce profil changent aussi.
        </Text>
      )}
      <Button title="Enregistrer" icon="save-outline" loading={saving} onPress={save} />
    </Screen>
  );
}
