import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Theme: deep-space "Guide" look — Hitchhiker's Guide to the Galaxy.
 * Near-black navy void, a quiet starfield, towel-gold accents.
 * Don't panic.
 */
export const colors = {
  bg: "#070B16",
  bgDeep: "#04060D",
  card: "#111A2E",
  panel: "#182238",
  panelBorder: "#2C3A5E",
  border: "#26314D",
  text: "#E8ECF4",
  muted: "#93A0B8",
  accent: "#F5C542",
  accentWarm: "#FFB84D",
  star: "#FFFFFF",
  dangerBg: "#3A1620",
  dangerText: "#FFB3C0",
};

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

export function Screen({ children }: { children: React.ReactNode }) {
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
  return (
    <View style={styles.dontPanicWrap}>
      <Text style={[styles.dontPanic, compact && styles.dontPanicCompact]}>
        DON'T PANIC
      </Text>
      <Text style={styles.dontPanicSub}>
        慌てないで。タオルと、このガイドがあれば大丈夫。
      </Text>
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
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
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
    backgroundColor: "#27407A",
    opacity: 0.16,
  },
  nebulaB: {
    width: 280,
    height: 280,
    bottom: -90,
    left: -120,
    backgroundColor: "#5A3A8A",
    opacity: 0.12,
  },
  nebulaC: {
    width: 190,
    height: 190,
    top: "42%",
    right: -80,
    backgroundColor: "#8A5A1E",
    opacity: 0.08,
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
