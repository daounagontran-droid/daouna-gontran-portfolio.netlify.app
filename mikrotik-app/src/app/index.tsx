import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { showError } from '@/components/confirm';
import { colors } from '@/components/theme';
import { Badge, Button, Card, Empty, Loading, Row, Screen } from '@/components/ui';
import { useRouters } from '@/context/RouterContext';
import { baseUrl, MikroTik, type RouterConfig } from '@/lib/mikrotik';

export default function RoutersScreen() {
  const { routers, ready, connect } = useRouters();
  const [connecting, setConnecting] = useState<string | null>(null);

  async function open(r: RouterConfig) {
    setConnecting(r.id);
    try {
      // Vérifie les identifiants avant d'ouvrir le tableau de bord.
      await new MikroTik(r).get('/system/identity');
      connect(r);
      router.push('/(tabs)');
    } catch (e) {
      showError(e);
    } finally {
      setConnecting(null);
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/router-form')} hitSlop={10}>
              <Ionicons name="add-circle" size={28} color="#fff" />
            </Pressable>
          ),
        }}
      />
      <View style={{ paddingVertical: 8, gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Gérer mon MikroTik</Text>
        <Text style={{ color: colors.muted }}>
          Choisissez un routeur pour gérer le Wi-Fi, les tickets et les clients à distance.
        </Text>
      </View>

      {!ready ? (
        <Loading />
      ) : routers.length === 0 ? (
        <Card>
          <Empty icon="hardware-chip-outline" text="Aucun routeur enregistré pour l'instant." />
          <Button title="Ajouter mon routeur" icon="add" onPress={() => router.push('/router-form')} />
        </Card>
      ) : (
        routers.map((r) => (
          <Card key={r.id}>
            <Row
              icon="hardware-chip"
              title={r.name}
              subtitle={baseUrl(r).replace(/\/rest$/, '')}
              right={<Badge text={r.https ? 'HTTPS' : 'HTTP'} tone={r.https ? 'ok' : 'warn'} />}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Se connecter"
                  icon="log-in-outline"
                  loading={connecting === r.id}
                  disabled={!!connecting}
                  onPress={() => open(r)}
                />
              </View>
              <Button
                title="Modifier"
                variant="secondary"
                icon="create-outline"
                onPress={() => router.push({ pathname: '/router-form', params: { id: r.id } })}
              />
            </View>
          </Card>
        ))
      )}

      <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy }}>
        <Text style={{ color: colors.gold, fontWeight: '800' }}>Avant la première connexion</Text>
        <Text style={{ color: '#fff', lineHeight: 20 }}>
          L'application utilise l'API REST de RouterOS 7. Activez le service « www-ssl » (ou « www » sur le réseau
          local) et créez un utilisateur dédié. Les étapes détaillées sont dans le fichier README du projet.
        </Text>
      </Card>
    </Screen>
  );
}
