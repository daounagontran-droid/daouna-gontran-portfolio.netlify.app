import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { colors } from '@/components/theme';
import { Card, Divider, Row, Screen, SectionTitle, type IconName } from '@/components/ui';
import { useRouters } from '@/context/RouterContext';
import { baseUrl } from '@/lib/mikrotik';

const ITEMS: { icon: IconName; title: string; subtitle: string; href: Href }[] = [
  { icon: 'git-branch-outline', title: 'Interfaces', subtitle: 'Ports, état, trafic, activer / désactiver', href: '/interfaces' },
  { icon: 'list-outline', title: 'Baux DHCP', subtitle: 'Adresses IP, IP fixe, blocage', href: '/dhcp' },
  { icon: 'options-outline', title: 'Forfaits hotspot', subtitle: 'Débits et appareils par ticket', href: '/profiles' },
  { icon: 'document-text-outline', title: 'Journal', subtitle: 'Événements récents du routeur', href: '/logs' },
  { icon: 'settings-outline', title: 'Système', subtitle: 'Nom, mises à jour, sauvegarde, redémarrage', href: '/system' },
  { icon: 'terminal-outline', title: 'Terminal', subtitle: 'Commandes RouterOS avancées', href: '/terminal' },
];

export default function MoreScreen() {
  const { current, disconnect } = useRouters();
  return (
    <Screen>
      <SectionTitle>Gestion</SectionTitle>
      <Card>
        {ITEMS.map((item, i) => (
          <View key={item.title} style={{ gap: 10 }}>
            {i > 0 && <Divider />}
            <Row icon={item.icon} title={item.title} subtitle={item.subtitle} onPress={() => router.push(item.href)} />
          </View>
        ))}
      </Card>
      <SectionTitle>Connexion</SectionTitle>
      <Card>
        <Row icon="hardware-chip-outline" title={current?.name} subtitle={current ? baseUrl(current).replace(/\/rest$/, '') : ''} />
        <Divider />
        <Row
          icon="swap-horizontal"
          title="Changer de routeur"
          onPress={() => {
            disconnect();
            router.replace('/');
          }}
        />
      </Card>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
        MikroTik Manager · DAOUNA Gontran
      </Text>
    </Screen>
  );
}
