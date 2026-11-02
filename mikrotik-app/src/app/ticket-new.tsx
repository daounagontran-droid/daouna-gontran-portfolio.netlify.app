import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { notify, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Button, Card, Chips, Field, Loading, ProgressBar, Screen, SectionTitle, Toggle } from '@/components/ui';
import { useApi, useRouters } from '@/context/RouterContext';
import { formatMoney } from '@/lib/format';
import { inBatches, MikroTikError } from '@/lib/mikrotik';
import { printTickets, shareTicketsPdf, shareTicketsText } from '@/lib/printTickets';
import { loadTicketPrefs, saveTicketPrefs } from '@/lib/storage';
import { useResource } from '@/lib/useResource';
import { randomCode, ticketComment, type CodeStyle, type PrintOptions, type Ticket } from '@/lib/vouchers';

const DURATIONS = [
  { value: '1h', label: '1 heure' },
  { value: '3h', label: '3 heures' },
  { value: '1d', label: '24 heures' },
  { value: '7d', label: '1 semaine' },
  { value: '30d', label: '1 mois' },
  { value: 'none', label: 'Illimité' },
  { value: 'custom', label: 'Autre…' },
];

const PLAN_LABELS: Record<string, string> = {
  '1h': '1 heure',
  '3h': '3 heures',
  '1d': '24 heures',
  '7d': '1 semaine',
  '30d': '1 mois',
  none: 'Illimité',
};

function lotId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${randomCode(3, 'letters')}`;
}

export default function TicketNewScreen() {
  const api = useApi();
  const { current } = useRouters();
  const profiles = useResource(() => api.get('/ip/hotspot/user/profile'));

  const [profile, setProfile] = useState('default');
  const [duration, setDuration] = useState('1h');
  const [customDuration, setCustomDuration] = useState('');
  const [dataMb, setDataMb] = useState('');
  const [price, setPrice] = useState('100');
  const [count, setCount] = useState('20');
  const [sameCode, setSameCode] = useState(true);
  const [style, setStyle] = useState<CodeStyle>('digits');
  const [length, setLength] = useState('6');
  const [prefix, setPrefix] = useState('');
  const [title, setTitle] = useState('Wi-Fi Zone');
  const [ssid, setSsid] = useState('');
  const [loginUrl, setLoginUrl] = useState('');

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ tickets: Ticket[]; options: PrintOptions } | null>(null);

  useEffect(() => {
    if (!current) return;
    loadTicketPrefs(current.id).then((p) => {
      if (!p) return;
      setTitle(p.title);
      setSsid(p.ssid);
      setLoginUrl(p.loginUrl);
    });
  }, [current]);

  async function generate() {
    const total = parseInt(count, 10);
    const len = parseInt(length, 10);
    const limit = duration === 'custom' ? customDuration.trim() : duration;
    if (!(total >= 1 && total <= 500)) return notify('Quantité invalide', 'Entre 1 et 500 tickets par lot.');
    if (!(len >= 4 && len <= 12)) return notify('Longueur invalide', 'Les codes doivent faire entre 4 et 12 caractères.');
    if (duration === 'custom' && !/^(\d+[wdhms])+$/.test(limit))
      return notify('Durée invalide', 'Utilisez le format RouterOS : 30m, 2h, 1d12h, 2w…');

    const plan = duration === 'custom' ? limit : PLAN_LABELS[duration];
    const lot = lotId();
    const comment = ticketComment({ lot, price: Number(price) || 0, plan });
    if (current) await saveTicketPrefs(current.id, { title, ssid, loginUrl });

    setResult(null);
    setProgress({ done: 0, total });
    try {
      const created = await inBatches(
        Array.from({ length: total }),
        async () => {
          // En cas de doublon avec un code existant, on retente avec un autre code.
          for (let attempt = 0; ; attempt++) {
            const name = prefix + randomCode(len, style);
            const password = sameCode ? name : randomCode(Math.max(4, len - 2), 'digits');
            const body: Record<string, string> = { name, password, profile, comment };
            if (limit !== 'none') body['limit-uptime'] = limit;
            if (Number(dataMb) > 0) body['limit-bytes-total'] = String(Math.round(Number(dataMb) * 1024 * 1024));
            try {
              await api.add('/ip/hotspot/user', body);
              return { name, password };
            } catch (e) {
              if (attempt < 3 && e instanceof MikroTikError && /already/i.test(e.message)) continue;
              throw e;
            }
          }
        },
        (done) => setProgress({ done, total }),
      );
      setResult({
        tickets: created,
        options: { title, ssid, loginUrl, plan, price: Number(price) || 0, sameCode },
      });
    } catch (e) {
      showError(e);
    } finally {
      setProgress(null);
    }
  }

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      showError(e);
    }
  }

  if (result) {
    const { tickets, options } = result;
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>🎟️</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{tickets.length} tickets créés</Text>
          <Text style={{ color: colors.muted }}>
            {options.plan} · {formatMoney(options.price)} l'unité
          </Text>
        </Card>
        <Button title="Imprimer" icon="print-outline" onPress={() => run(() => printTickets(tickets, options))} />
        <Button title="Partager en PDF" icon="document-outline" variant="secondary" onPress={() => run(() => shareTicketsPdf(tickets, options))} />
        <Button
          title="Envoyer les codes par message"
          icon="logo-whatsapp"
          variant="secondary"
          onPress={() => run(() => shareTicketsText(tickets, options))}
        />
        <Card>
          <Text style={{ fontFamily: 'monospace', color: colors.text, lineHeight: 22 }}>
            {tickets.map((t) => (options.sameCode ? t.name : `${t.name} / ${t.password}`)).join('\n')}
          </Text>
        </Card>
        <Button title="Générer un autre lot" variant="ghost" onPress={() => setResult(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>Forfait</SectionTitle>
      <Card>
        <Text style={{ fontWeight: '600', color: colors.text }}>Profil hotspot (débit, partage)</Text>
        {profiles.loading ? (
          <Loading />
        ) : (
          <Chips
            options={(profiles.data ?? []).map((p) => ({
              value: p.name ?? '',
              label: p['rate-limit'] ? `${p.name} (${p['rate-limit']})` : p.name ?? '',
            }))}
            value={profile}
            onChange={setProfile}
          />
        )}
        <Text style={{ fontWeight: '600', color: colors.text }}>Temps de connexion</Text>
        <Chips options={DURATIONS} value={duration} onChange={setDuration} />
        {duration === 'custom' && (
          <Field label="Durée (format RouterOS)" value={customDuration} onChangeText={setCustomDuration} placeholder="ex. 2h30m, 2d, 2w" />
        )}
        <Field
          label="Volume de données max (Mo, optionnel)"
          value={dataMb}
          onChangeText={(v) => setDataMb(v.replace(/[^\d.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="Illimité"
        />
        <Field label="Prix de vente (FCFA)" value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      </Card>

      <SectionTitle>Codes</SectionTitle>
      <Card>
        <Field label="Nombre de tickets" value={count} onChangeText={(v) => setCount(v.replace(/\D/g, ''))} keyboardType="number-pad" />
        <Toggle
          label="Code unique"
          value={sameCode}
          onChange={setSameCode}
          hint="Le client tape le même code comme utilisateur et mot de passe."
        />
        <Chips
          options={[
            { value: 'digits', label: 'Chiffres' },
            { value: 'letters', label: 'Lettres' },
            { value: 'mixed', label: 'Mélange' },
          ]}
          value={style}
          onChange={setStyle}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Longueur" value={length} onChangeText={(v) => setLength(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Préfixe (optionnel)" value={prefix} onChangeText={setPrefix} autoCapitalize="characters" />
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Exemple : {prefix}
          {randomCode(Math.min(12, Math.max(4, parseInt(length, 10) || 6)), style)}
        </Text>
      </Card>

      <SectionTitle>Impression</SectionTitle>
      <Card>
        <Field label="Titre sur le ticket" value={title} onChangeText={setTitle} autoCapitalize="words" />
        <Field label="Nom du réseau Wi-Fi (optionnel)" value={ssid} onChangeText={setSsid} />
        <Field label="Adresse de la page de connexion (optionnel)" value={loginUrl} onChangeText={setLoginUrl} placeholder="ex. http://wifi.zone" />
      </Card>

      {progress ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            Création en cours… {progress.done} / {progress.total}
          </Text>
          <ProgressBar value={(progress.done / progress.total) * 100} color={colors.gold} />
        </Card>
      ) : (
        <Button title={`Générer ${count || 0} tickets`} icon="flash-outline" onPress={generate} />
      )}
    </Screen>
  );
}
