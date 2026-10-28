import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { RouterConfig } from './mikrotik';

// La liste des routeurs est stockée sans mot de passe ; chaque mot de passe
// est rangé à part dans le trousseau sécurisé du téléphone.
const LIST_KEY = 'routers.v1';
const passwordKey = (id: string) => `router-password-${id}`;

type StoredRouter = Omit<RouterConfig, 'password'>;

// Le trousseau sécurisé n'existe pas dans un navigateur (aperçu web de développement).
const secret = {
  get: (key: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};

export async function loadRouters(): Promise<RouterConfig[]> {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  const list: StoredRouter[] = raw ? JSON.parse(raw) : [];
  return Promise.all(
    list.map(async (r) => ({ ...r, password: (await secret.get(passwordKey(r.id))) ?? '' })),
  );
}

export async function saveRouter(router: RouterConfig): Promise<void> {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  const list: StoredRouter[] = raw ? JSON.parse(raw) : [];
  const { password, ...rest } = router;
  const index = list.findIndex((r) => r.id === router.id);
  if (index >= 0) list[index] = rest;
  else list.push(rest);
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list));
  await secret.set(passwordKey(router.id), password);
}

export async function deleteRouter(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(LIST_KEY);
  const list: StoredRouter[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list.filter((r) => r.id !== id)));
  await secret.remove(passwordKey(id));
  await AsyncStorage.removeItem(prefsKey(id));
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export type TicketPrefs = { title: string; ssid: string; loginUrl: string };

const prefsKey = (routerId: string) => `ticket-prefs-${routerId}`;

export async function loadTicketPrefs(routerId: string): Promise<TicketPrefs | null> {
  const raw = await AsyncStorage.getItem(prefsKey(routerId));
  return raw ? JSON.parse(raw) : null;
}

export async function saveTicketPrefs(routerId: string, prefs: TicketPrefs): Promise<void> {
  await AsyncStorage.setItem(prefsKey(routerId), JSON.stringify(prefs));
}
