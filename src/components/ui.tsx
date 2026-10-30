import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../context/LanguageContext";

/**
 * Theme: MetaMask-like light theme (2026-10-30 pivot) — plain white
 * background, very light gray-blue surfaces, near-black text, simple
 * solid blue primary. The DON'T PANIC wordmark stays as a small blue
 * brand line. Don't panic.
 */
export const colors = {
  bg: "#FFFFFF",
  bgDeep: "#FFFFFF",
  card: "#FFFFFF",
  panel: "#F2F4F8",
  panelBorder: "#E4E9F2",
  border: "#E4E9F2",
  text: "#1B1E28",
  muted: "#6A737D",
  accent: "#168BFF",
  accentWarm: "#B45309",
  dangerBg: "#FDECEF",
  dangerText: "#C81E3A",
  // Product-spec palette
  primary: "#168BFF",
  purple: "#9B35FF",
  cyan: "#0E7FA8",
  positive: "#0E9F6E",
  negative: "#E5486C",
  // Legacy gradient stops — primary actions are solid blue now; these
  // remain only as token values for chip-active backgrounds (gradStart).
  gradStart: "#168BFF",
  gradEnd: "#9B35FF",
  gradDeepStart: "#F7F9FC",
  gradDeepEnd: "#F7F9FC",
};

/** Legacy gradient stops (kept for API compatibility; UI uses solid blue). */
export const GRADIENT: [string, string] = [colors.gradStart, colors.gradEnd];
/** Legacy hero gradient stops (hero is a plain light surface now). */
export const GRADIENT_DEEP: [string, string] = [
  colors.gradDeepStart,
  colors.gradDeepEnd,
];

/**
 * Deterministic per-token colors for icon chips (hashed from the
 * symbol — no external images, stable across renders).
 */
const TOKEN_COLORS = [
  "#168BFF",
  "#9B35FF",
  "#0891B2",
  "#0E9F6E",
  "#D97706",
  "#E5486C",
  "#7C5CFF",
  "#3D9BFF",
  "#0D9488",
  "#EA580C",
];

export function tokenColor(symbol: string): string {
  const s = symbol.toUpperCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TOKEN_COLORS[h % TOKEN_COLORS.length];
}

/** Circular token icon chip: colored disc + the symbol's letter(s). */
export function TokenIcon({
  symbol,
  size = 40,
}: {
  symbol: string;
  size?: number;
}) {
  const label =
    symbol.length <= 2 ? symbol : symbol.slice(0, 2).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokenColor(symbol),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: Math.max(10, size * 0.34),
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Screen({
  children,
  embedded,
}: {
  children: React.ReactNode;
  /** Rendered inside another Screen (e.g. a DeFi sub-view): no nested
   *  ScrollView / starfield, just the stacked content. */
  embedded?: boolean;
}) {
  if (embedded) {
    return <View style={styles.embeddedContent}>{children}</View>;
  }
  return (
    <View style={styles.screenWrap}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/**
 * The most important words in the galaxy, in large friendly letters.
 * Used on the Dashboard header and on empty states.
 */
export function DontPanic({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={styles.dontPanicWrap}>
      <Text style={[styles.dontPanic, compact && styles.dontPanicCompact]}>
        DON'T PANIC
      </Text>
      <Text style={styles.dontPanicSub}>{t("common.dontPanicSub")}</Text>
    </View>
  );
}

export function TodoMt({ items }: { items: string[] }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>MTさんからの受領待ち（TODO_MT）</Text>
      {items.map((item) => (
        <Text key={item} style={styles.todoItem}>
          • {item}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: 16, gap: 12 },
  embeddedContent: { gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: "#1B1E28",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  todoItem: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  dontPanicWrap: { alignItems: "center", paddingVertical: 8, gap: 4 },
  dontPanic: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },
  dontPanicCompact: { fontSize: 24, letterSpacing: 2 },
  dontPanicSub: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
