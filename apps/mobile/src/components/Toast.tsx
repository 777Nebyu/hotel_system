import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, font, radius } from "../theme";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-2), { id, type, title, message }]);

      fadeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      });
    },
    [fadeAnim],
  );

  const toastColors: Record<ToastType, { bg: string; fg: string; border: string }> = {
    success: { bg: "#E8F5E9", fg: "#1B5E20", border: "#4CAF50" },
    error: { bg: "#FFEBEE", fg: "#B71C1C", border: colors.brick },
    info: { bg: "#E3F2FD", fg: "#0D47A1", border: colors.teal },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Animated.View style={[styles.container, { opacity: fadeAnim }]} pointerEvents="none">
        {toasts.map((t) => (
          <View
            key={t.id}
            style={[
              styles.toast,
              {
                backgroundColor: toastColors[t.type].bg,
                borderLeftColor: toastColors[t.type].border,
              },
            ]}
          >
            <Text style={[styles.title, { color: toastColors[t.type].fg }]}>{t.title}</Text>
            {t.message && <Text style={styles.message}>{t.message}</Text>}
          </View>
        ))}
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.card,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontFamily: font.mono,
    fontSize: 14,
    fontWeight: "600",
  },
  message: {
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: 2,
  },
});
