import { Alert, Platform } from 'react-native';

// Alert.alert ne fait rien dans un navigateur : l'aperçu web utilise les boîtes natives du navigateur.
const isWeb = Platform.OS === 'web';

export function confirm(title: string, message: string, actionLabel = 'Confirmer', destructive = true): Promise<boolean> {
  if (isWeb) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: actionLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message?: string) {
  if (isWeb) window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function showError(e: unknown) {
  notify('Erreur', (e as any)?.message ?? String(e));
}
