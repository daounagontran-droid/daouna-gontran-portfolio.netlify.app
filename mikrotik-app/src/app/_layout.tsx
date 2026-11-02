import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/components/theme';
import { RouterProvider, useRouters } from '@/context/RouterContext';

function RootStack() {
  const { api } = useRouters();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mes routeurs' }} />
      <Stack.Screen name="router-form" options={{ title: 'Routeur', presentation: 'modal' }} />
      <Stack.Protected guard={!!api}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="wifi-edit" options={{ title: 'Modifier le Wi-Fi' }} />
        <Stack.Screen name="ticket-new" options={{ title: 'Générer des tickets' }} />
        <Stack.Screen name="profiles" options={{ title: 'Forfaits (profils)' }} />
        <Stack.Screen name="interfaces" options={{ title: 'Interfaces' }} />
        <Stack.Screen name="dhcp" options={{ title: 'Baux DHCP' }} />
        <Stack.Screen name="logs" options={{ title: 'Journal' }} />
        <Stack.Screen name="system" options={{ title: 'Système' }} />
        <Stack.Screen name="terminal" options={{ title: 'Terminal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <RouterProvider>
      <StatusBar style="light" />
      <RootStack />
    </RouterProvider>
  );
}
