import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { Pressable, type ColorValue } from 'react-native';

import { colors } from '@/components/theme';
import type { IconName } from '@/components/ui';
import { useRouters } from '@/context/RouterContext';

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color as string} />;

export default function TabsLayout() {
  const { current, disconnect } = useRouters();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
        headerRight: () => (
          <Pressable
            hitSlop={10}
            style={{ marginRight: 16 }}
            onPress={() => {
              disconnect();
              router.replace('/');
            }}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: current?.name ?? 'Accueil', tabBarLabel: 'Accueil', tabBarIcon: icon('speedometer') }} />
      <Tabs.Screen name="wifi" options={{ title: 'Wi-Fi', tabBarIcon: icon('wifi') }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets', tabBarIcon: icon('ticket') }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients connectés', tabBarLabel: 'Clients', tabBarIcon: icon('people') }} />
      <Tabs.Screen name="more" options={{ title: 'Plus', tabBarIcon: icon('grid') }} />
    </Tabs>
  );
}
