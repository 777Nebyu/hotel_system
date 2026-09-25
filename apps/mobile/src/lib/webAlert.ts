import { Alert, Platform } from 'react-native';

/**
 * react-native-web ships Alert.alert as an empty stub (`static alert() {}`),
 * so every confirmation dialog in the app silently does nothing on web —
 * e.g. the manager "Sign Out" button never shows its confirmation and the
 * button appears broken.
 *
 * This module replaces it with window.alert / window.confirm on web only.
 * Native keeps the real Alert. Import this file for its side effect once,
 * as early as possible (App.tsx).
 */
type AlertButton = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };

if (Platform.OS === 'web') {
  const webAlert = (title?: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];

    if (list.length === 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }

    // window.confirm is binary: affirmative → primary action, dismiss → cancel.
    const confirmed = window.confirm(text);
    if (confirmed) {
      const action = [...list].reverse().find((b) => b.style !== 'cancel') ?? list[list.length - 1];
      action?.onPress?.();
    } else {
      const cancel = list.find((b) => b.style === 'cancel') ?? list[0];
      cancel?.onPress?.();
    }
  };

  (Alert as unknown as { alert: typeof webAlert }).alert = webAlert;
}

export {};
