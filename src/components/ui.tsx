import { LinearGradient } from "expo-linear-gradient";
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
 * Deterministic galaxy background (seeded pattern — stable across
 * renders, no Math.random, no image assets, fully static). ~200 stars
 * with varied size/brightness and a few colored ones, soft nebula
 * glows (concentric circles faking a radial falloff) and a subtle
 * top/bottom vignette over the #050B1B void.
 */
const STAR_COLORS = [
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#7FB2FF", // blue
  "#C99BFF", // purple
  "#FF9BD5", // pink
  "#8FE8FF", // cyan
  "#F5C542", // gold
];
const STARS = Array.from({ length: 200 }, (_, i) => {
  const x = (i * 37.31 + (i % 5) * 11.7) % 100;
  const y = (i * 53.77 + (i % 7) * 17.3) % 100;
  const size =
    i % 23 === 0 ? 3 : i % 11 === 0 ? 2.4 : i % 4 === 0 ? 1.7 : 1.1;
  const opacity = 0.15 + ((i * 29) % 75) / 100;
  const color = STAR_COLORS[i % 17 === 0 ? 7 : i % 5];
  return { x, y, size, opacity, color, key: i };
});

/** One soft nebula: three concentric discs with rising opacity. */
function NebulaGlow({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style: object;
}) {
  return (
    <View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.05,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.64,
          height: size * 0.64,
          borderRadius: size * 0.32,
          backgroundColor: color,
          opacity: 0.06,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size * 0.17,
          backgroundColor: color,
          opacity: 0.08,
        }}
      />
    </View>
  );
}

export function Starfield() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* nebula glows — purple / blue / pink / cyan clouds */}
      <NebulaGlow size={380} color="#9B35FF" style={{ top: -140, right: -120 }} />
      <NebulaGlow size={320} color="#168BFF" style={{ top: "30%", left: -150 }} />
      <NebulaGlow size={260} color="#FF4D79" style={{ top: "58%", right: -130 }} />
      <NebulaGlow size={300} color="#30DFFF" style={{ bottom: -130, left: -90 }} />
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
            backgroundColor: s.color,
            opacity: s.opacity,
          }}
        />
      ))}
      {/* vignette: darken the very top and bottom edges */}
      <LinearGradient
        colors={["rgba(3,6,18,0.55)", "rgba(3,6,18,0)"]}
        style={styles.vignetteTop}
      />
      <LinearGradient
        colors={["rgba(3,6,18,0)", "rgba(3,6,18,0.55)"]}
        style={styles.vignetteBottom}
      />
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

/** Shown on every screen while the app is a test build. Plain words. */
export function PrototypeWarning() {
  return (
    <View style={styles.warning}>
      <Text style={styles.warningText}>
        ⚠️
        このアプリは開発中のテスト版です。大事な資産は入れず、少額でお試しください。
        リカバリーフレーズ（復旧用の言葉）は紙に書いて保管し、誰にも教えないでください。
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
  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  vignetteBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
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
