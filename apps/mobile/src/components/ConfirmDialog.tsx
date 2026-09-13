import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius } from "../theme";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {body && <Text style={styles.body}>{body}</Text>}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.btnSecondaryText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                danger ? styles.btnDanger : styles.btnPrimary,
                busy && styles.btnDisabled,
              ]}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text style={styles.btnPrimaryText}>
                {busy ? "Working…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 8,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  btnPrimary: {
    backgroundColor: colors.teal,
  },
  btnDanger: {
    backgroundColor: colors.brick,
  },
  btnSecondary: {
    backgroundColor: colors.line,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    color: colors.paper,
    fontSize: 14,
    fontWeight: "600",
  },
  btnSecondaryText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "500",
  },
});
