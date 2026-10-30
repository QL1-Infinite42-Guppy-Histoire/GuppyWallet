import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../context/LanguageContext";

/**
 * Theme: deep-space "Guide" look — Hitchhiker's Guide to the Galaxy,
 * on the product-spec palette (2026-10-30 restructure): near-black navy
 * void #050B1B, glassy cards #101D35, neon blue → purple gradients,
 * cyan accents, towel-gold reserved for the DON'T PANIC wordmark.
 * Don't panic.
 */
export const colors = {
  bg: "#050B1B",
  bgDeep: "#030612",
  card: "#101D35",
  panel: "#152741",
  panelBorder: "#2B4A73",
  border: "#223A5C",
  text: "#FFFFFF",
  muted: "#94A7C7",
  accent: "#F5C542",
  accentWarm: "#FFB84D",
  star: "#FFFFFF",
  dangerBg: "#3A1620",
  dangerText: "#FFB3C0",
  // Product-spec palette
  primary: "#168BFF",
  purple: "#9B35FF",
  cyan: "#30DFFF",
  positive: "#00D98B",
  negative: "#FF4D79",
  // Gradient stops (blue → purple per spec)
  gradStart: "#168BFF",
  gradEnd: "#9B35FF",
  gradDeepStart: "#0A2450",
  gradDeepEnd: "#2A1052",
};

/** The app-wide primary gradient stops (purple → blue). */
export const GRADIENT: [string, string] = [colors.gradStart, colors.gradEnd];
/** Darker hero-surface gradient stops. */
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
  "#30DFFF",
  "#00D98B",
  "#F5C542",
  "#FF4D79",
  "#7C5CFF",
  "#3D9BFF",
  "#2ED3A6",
  "#FF8A5C",
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
          color: "#0B0F19",
          fontSize: Math.max(10, size * 0.34),
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Deterministic starfield (seeded pattern — stable across renders, no
 * Math.random, no image assets). A few soft nebula glows + ~120 stars.
 */
const STARS = Array.from({ length: 120 }, (_, i) => {
  const x = (i * 37.31 + (i % 5) * 11.7) % 100;
  const y = (i * 53.77 + (i % 7) * 17.3) % 100;
  const size = i % 11 === 0 ? 2.4 : i % 4 === 0 ? 1.7 : 1.1;
  const opacity = 0.18 + ((i * 29) % 62) / 100;
  const gold = i % 13 === 0;
  return { x, y, size, opacity, gold, key: i };
});

export function Starfield() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* nebula glows */}
      <View style={[styles.nebula, styles.nebulaA]} />
      <View style={[styles.nebula, styles.nebulaB]} />
      <View style={[styles.nebula, styles.nebulaC]} />
      {STARS.map((s) => (
        <View
          key={s.key}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: s.gold ? colors.accent : colors.star,
            opacity: s.opacity,
          }}
        />
      ))}
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
      <Starfield />
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

/** Shown on every screen until the app has passed a security audit. */
export function PrototypeWarning() {
  return (
    <View style={styles.warning}>
      <Text style={styles.warningText}>
        ⚠️ 試作版（未監査）です。署名・送信機能は有効化されていますが、必ず少額でテストしてください。
        リカバリーフレーズは紙に書いて保管し、誰にも教えないでください。
      </Text>
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
    // glassy: slightly translucent so the starfield shimmers through
    backgroundColor: "rgba(16,29,53,0.94)",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  todoItem: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  warning: {
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 12,
  },
  warningText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  nebula: { position: "absolute", borderRadius: 999 },
  nebulaA: {
    width: 340,
    height: 340,
    top: -120,
    right: -110,
    backgroundColor: "#168BFF",
    opacity: 0.13,
  },
  nebulaB: {
    width: 280,
    height: 280,
    bottom: -90,
    left: -120,
    backgroundColor: "#9B35FF",
    opacity: 0.11,
  },
  nebulaC: {
    width: 190,
    height: 190,
    top: "42%",
    right: -80,
    backgroundColor: "#30DFFF",
    opacity: 0.05,
  },
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
