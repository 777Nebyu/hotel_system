import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";

function ShimmerBlock({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    animLoop.start();
    return () => animLoop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: 6,
          backgroundColor: colors.line,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <ShimmerBlock width="100%" height={160} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <ShimmerBlock width="70%" height={18} />
        <ShimmerBlock width="40%" height={14} style={{ marginTop: 8 }} />
        <ShimmerBlock width="55%" height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <ShimmerBlock width={64} height={64} style={styles.listThumb} />
          <View style={styles.listContent}>
            <ShimmerBlock width="80%" height={16} />
            <ShimmerBlock width="50%" height={13} style={{ marginTop: 6 }} />
            <ShimmerBlock width="35%" height={13} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonDetail() {
  return (
    <View style={styles.detail}>
      <ShimmerBlock width="100%" height={220} />
      <View style={styles.detailBody}>
        <ShimmerBlock width="60%" height={22} />
        <ShimmerBlock width="40%" height={14} style={{ marginTop: 10 }} />
        <ShimmerBlock width="100%" height={14} style={{ marginTop: 16 }} />
        <ShimmerBlock width="90%" height={14} style={{ marginTop: 6 }} />
        <ShimmerBlock width="70%" height={14} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function SkeletonKPI() {
  return (
    <View style={styles.kpiRow}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.kpiCard}>
          <ShimmerBlock width="50%" height={14} />
          <ShimmerBlock width="70%" height={28} style={{ marginTop: 8 }} />
          <ShimmerBlock width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

// ─── Generic SkeletonLoader — composable building blocks ────────────────────
export function SkeletonLine({ width = '100%', height = 14, style }: { width?: number | string; height?: number; style?: object }) {
  return <ShimmerBlock width={width} height={height} style={style} />;
}

export function SkeletonCircle({ size = 40, style }: { size?: number; style?: object }) {
  return <ShimmerBlock width={size} height={size} style={[{ borderRadius: size / 2 }, style]} />;
}

export function SkeletonLoader({
  lines = 3,
  avatar,
  footer,
  style,
}: {
  lines?: number;
  avatar?: boolean;
  footer?: boolean;
  style?: object;
}) {
  return (
    <View style={[{ gap: 10 }, style]}>
      {avatar && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <SkeletonCircle size={44} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonLine width="60%" height={14} />
            <SkeletonLine width="40%" height={12} />
          </View>
        </View>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={14}
        />
      ))}
      {footer && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <SkeletonLine width={80} height={32} style={{ borderRadius: 8 }} />
          <SkeletonLine width={60} height={32} style={{ borderRadius: 8 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    marginBottom: 12,
  },
  cardImage: { borderRadius: 0 },
  cardBody: { padding: 14 },
  list: { gap: 10 },
  listRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    alignItems: "center",
  },
  listThumb: { borderRadius: 10 },
  listContent: { flex: 1, marginLeft: 12 },
  detail: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  detailBody: { padding: 16 },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
});
