import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { useActionSheet } from '@/components/ActionSheet';
import { confirm, notify, showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Badge, Button, Card, Divider, Empty, ErrorBox, Field, Loading, Row, Screen, SectionTitle, Stat } from '@/components/ui';
import { useApi, useRouters } from '@/context/RouterContext';
import { formatDuration, formatMoney, parseDuration } from '@/lib/format';
import { getOptional, inBatches, type Row as RosRow } from '@/lib/mikrotik';
import { printTickets, shareTicketsPdf, shareTicketsText } from '@/lib/printTickets';
import { loadTicketPrefs } from '@/lib/storage';
import { useResource } from '@/lib/useResource';
import { isTicketUsed, parseTicketComment, type PrintOptions } from '@/lib/vouchers';

type Status = 'new' | 'active' | 'used' | 'exhausted';

const STATUS: Record<Status, { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' | 'info' }> = {
  new: { label: 'Neuf', tone: 'ok' },
  active: { label: 'Connecté', tone: 'info' },
  used: { label: 'Entamé', tone: 'warn' },
  exhausted: { label: 'Épuisé', tone: 'muted' },
};

function statusOf(user: RosRow, active: Set<string>): Status {
  if (active.has(user.name ?? '')) return 'active';
  const limit = parseDuration(user['limit-uptime']);
  if (limit > 0 && parseDuration(user.uptime) >= limit) return 'exhausted';
  return isTicketUsed(user) ? 'used' : 'new';
}

type Lot = { lot: string; plan: string; price: number; users: RosRow[]; counts: Record<Status, number> };

export default function TicketsScreen() {
  const api = useApi();
  const { current } = useRouters();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const sheet = useActionSheet();

  const res = useResource(async () => {
    const [users, active] = await Promise.all([
      getOptional(api, '/ip/hotspot/user'),
      getOptional(api, '/ip/hotspot/active'),
    ]);
    return { users, active: new Set((active ?? []).map((a) => a.user ?? '')) };
  });

  const lots = useMemo<Lot[]>(() => {
    const map = new Map<string, Lot>();
    for (const u of res.data?.users ?? []) {
      const meta = parseTicketComment(u.comment);
      if (!meta) continue;
      let lot = map.get(meta.lot);
      if (!lot) {
        lot = { ...meta, users: [], counts: { new: 0, active: 0, used: 0, exhausted: 0 } };
        map.set(meta.lot, lot);
      }
      lot.users.push(u);
      lot.counts[statusOf(u, res.data!.active)]++;
    }
    return [...map.values()].reverse();
  }, [res.data]);

  const totals = useMemo(() => {
    let revenue = 0;
    let stock = 0;
    for (const l of lots) {
      revenue += (l.users.length - l.counts.new) * l.price;
      stock += l.counts.new;
    }
    return { revenue, stock };
  }, [lots]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return (res.data?.users ?? []).filter((u) => u.name?.toLowerCase().includes(q)).slice(0, 20);
  }, [query, res.data]);

  async function printOptions(lot: Lot): Promise<PrintOptions> {
    const prefs = current ? await loadTicketPrefs(current.id) : null;
    const first = lot.users[0];
    return {
      title: prefs?.title || 'Wi-Fi Zone',
      ssid: prefs?.ssid,
      loginUrl: prefs?.loginUrl,
      plan: lot.plan,
      price: lot.price,
      sameCode: first ? (first.password ?? '') === first.name : true,
    };
  }

  async function lotAction(lot: Lot, action: string) {
    const unused = lot.users
      .filter((u) => statusOf(u, res.data!.active) === 'new')
      .map((u) => ({ name: u.name ?? '', password: u.password ?? '' }));
    setBusy(lot.lot);
    try {
      if (action === 'print' || action === 'pdf' || action === 'text') {
        if (unused.length === 0) return notify('Rien à imprimer', "Tous les tickets de ce lot ont déjà servi.");
        const o = await printOptions(lot);
        if (action === 'print') await printTickets(unused, o);
        if (action === 'pdf') await shareTicketsPdf(unused, o);
        if (action === 'text') await shareTicketsText(unused, o);
      }
      if (action === 'clean') {
        const done = lot.users.filter((u) => statusOf(u, res.data!.active) === 'exhausted');
        if (done.length === 0) return notify('Rien à nettoyer', 'Aucun ticket épuisé dans ce lot.');
        if (!(await confirm('Supprimer les tickets épuisés ?', `${done.length} ticket(s) seront supprimés du routeur.`, 'Supprimer')))
          return;
        await inBatches(done, (u) => api.remove('/ip/hotspot/user', u['.id']));
        await res.reload();
      }
      if (action === 'delete') {
        if (
          !(await confirm(
            'Supprimer tout le lot ?',
            `Les ${lot.users.length} tickets du lot ${lot.lot} ne fonctionneront plus, même ceux déjà vendus.`,
            'Supprimer le lot',
          ))
        )
          return;
        await inBatches(lot.users, (u) => api.remove('/ip/hotspot/user', u['.id']));
        await res.reload();
      }
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  }

  function openLotMenu(lot: Lot) {
    sheet.show(`Lot ${lot.lot}`, [
      { label: 'Imprimer les tickets neufs', icon: 'print-outline', run: () => lotAction(lot, 'print') },
      { label: 'Partager en PDF', icon: 'document-outline', run: () => lotAction(lot, 'pdf') },
      { label: 'Envoyer les codes (WhatsApp, SMS…)', icon: 'chatbubble-outline', run: () => lotAction(lot, 'text') },
      { label: 'Supprimer les tickets épuisés', icon: 'trash-bin-outline', run: () => lotAction(lot, 'clean') },
      { label: 'Supprimer tout le lot', icon: 'trash-outline', destructive: true, run: () => lotAction(lot, 'delete') },
    ], `${lot.plan} · ${formatMoney(lot.price)}`);
  }

  async function userAction(u: RosRow, action: 'reset' | 'delete') {
    try {
      if (action === 'reset') {
        await api.run('/ip/hotspot/user/reset-counters', { '.id': u['.id'] });
      } else {
        if (!(await confirm(`Supprimer « ${u.name} » ?`, 'Ce code ne fonctionnera plus.', 'Supprimer'))) return;
        await api.remove('/ip/hotspot/user', u['.id']);
      }
      await res.reload();
    } catch (e) {
      showError(e);
    }
  }

  if (res.data && res.data.users === null) {
    return (
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        <Card>
          <Empty icon="ticket-outline" text="Le hotspot n'est pas configuré sur ce routeur (IP › Hotspot)." />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
      {sheet.element}
      {res.error && <ErrorBox message={res.error} onRetry={res.refresh} />}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat icon="cash-outline" label="Recette (tickets vendus)" value={formatMoney(totals.revenue)} />
        <Stat icon="layers-outline" label="Tickets neufs en stock" value={String(totals.stock)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Générer des tickets" icon="add-circle-outline" onPress={() => router.push('/ticket-new')} />
        </View>
        <Button title="Forfaits" icon="options-outline" variant="secondary" onPress={() => router.push('/profiles')} />
      </View>

      <Card>
        <Field label="Rechercher un code" value={query} onChangeText={setQuery} placeholder="Ex. 4827" autoCapitalize="characters" />
        {matches.map((u) => {
          const st = statusOf(u, res.data!.active);
          return (
            <View key={u['.id']} style={{ gap: 8 }}>
              <Divider />
              <Row
                title={u.name}
                subtitle={`Utilisé : ${formatDuration(u.uptime)}${u['limit-uptime'] ? ` / ${formatDuration(u['limit-uptime'])}` : ''} · profil ${u.profile ?? 'default'}`}
                right={<Badge text={STATUS[st].label} tone={STATUS[st].tone} />}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Remettre à zéro" small variant="secondary" icon="refresh" onPress={() => userAction(u, 'reset')} />
                <Button title="Supprimer" small variant="secondary" icon="trash-outline" onPress={() => userAction(u, 'delete')} />
              </View>
            </View>
          );
        })}
        {query.trim().length >= 2 && matches.length === 0 && <Text style={{ color: colors.muted }}>Aucun code trouvé.</Text>}
      </Card>

      <SectionTitle>Lots de tickets</SectionTitle>
      {res.loading && !res.data ? (
        <Loading />
      ) : lots.length === 0 ? (
        <Card>
          <Empty icon="ticket-outline" text="Aucun lot généré depuis l'application pour l'instant." />
        </Card>
      ) : (
        lots.map((lot) => (
          <Card key={lot.lot}>
            <Row
              icon="ticket"
              iconColor={colors.gold}
              title={`${lot.plan} · ${formatMoney(lot.price)}`}
              subtitle={`Lot ${lot.lot} · ${lot.users.length} tickets`}
              onPress={() => openLotMenu(lot)}
              right={busy === lot.lot ? <Loading /> : undefined}
            />
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(STATUS) as Status[])
                .filter((s) => lot.counts[s] > 0)
                .map((s) => (
                  <Badge key={s} text={`${lot.counts[s]} ${STATUS[s].label.toLowerCase()}`} tone={STATUS[s].tone} />
                ))}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
