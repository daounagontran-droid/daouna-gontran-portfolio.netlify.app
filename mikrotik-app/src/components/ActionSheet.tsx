import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from './theme';
import type { IconName } from './ui';

export type SheetAction = { label: string; icon?: IconName; destructive?: boolean; run: () => void };

type SheetState = { title: string; message?: string; actions: SheetAction[] };

/**
 * Menu d'actions en bas d'écran, identique sur Android et iOS
 * (Alert.alert est limité à trois boutons sur Android).
 */
export function useActionSheet() {
  const [state, setState] = useState<SheetState | null>(null);
  const insets = useSafeAreaInsets();
  const close = () => setState(null);

  const element = (
    <Modal transparent visible={!!state} animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <Text style={styles.title} numberOfLines={1}>
            {state?.title}
          </Text>
          {state?.message ? <Text style={styles.message}>{state.message}</Text> : null}
          {state?.actions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.bg }]}
              onPress={() => {
                close();
                // Laisse le menu se fermer avant d'ouvrir une éventuelle confirmation.
                setTimeout(a.run, 300);
              }}
            >
              {a.icon && <Ionicons name={a.icon} size={20} color={a.destructive ? colors.danger : colors.navy} />}
              <Text style={[styles.actionText, a.destructive && { color: colors.danger }]}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.action, styles.cancel]} onPress={close}>
            <Text style={[styles.actionText, { color: colors.muted, textAlign: 'center', flex: 1 }]}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return {
    show: (title: string, actions: SheetAction[], message?: string) => setState({ title, actions, message }),
    element,
  };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,58,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, gap: 2 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, paddingHorizontal: 12, paddingTop: 6 },
  message: { fontSize: 13, color: colors.muted, paddingHorizontal: 12, paddingBottom: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
  actionText: { fontSize: 16, fontWeight: '600', color: colors.text },
  cancel: { marginTop: 6, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 0 },
});
