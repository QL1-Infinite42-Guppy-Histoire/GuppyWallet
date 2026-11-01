import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useI18n } from "../context/LanguageContext";

/**
 * Theme: galaxy glass (2026-10-30, user: 「ガッツリ宇宙が見える」).
 * A bold full-bleed deep-space backdrop — saturated nebulae, a dense
 * starfield and a milky-way band — is the app's visual identity.
 * Everything floats on it as TRANSLUCENT WHITE GLASS: cards at 0.62
 * white (tuned up in transparency 2026-10-30 — the user asked for
 * the universe to show through much more) so the space pours through
 * while dark text stays crisp, hero/tab bar a touch stronger, modal
 * sheets near-opaque.
 * Text rendered directly on the space uses the onSpace tokens (white);
 * text inside glass keeps the dark tokens. Simple solid blue primary,
 * plain-language UI — unchanged.
 */
export const colors = {
  // Deep-space backdrop base (behind / around the GalaxyBackground)
  bg: "#050914",
  bgDeep: "#070D24",
  space: "#050914",
  spaceDeep: "#0A1230",
  // Glass materials (translucent white over the galaxy)
  card: "rgba(255,255,255,0.62)",
  cardBorder: "rgba(255,255,255,0.5)",
  panel: "rgba(255,255,255,0.38)",
  glassStrong: "rgba(255,255,255,0.72)", // hero + tab bar
  glassSheet: "rgba(255,255,255,0.94)", // modal sheets
  glassField: "rgba(255,255,255,0.55)", // text inputs
  glassChip: "rgba(255,255,255,0.66)", // chips / segmented on the space
  panelBorder: "rgba(27,30,40,0.10)",
  border: "rgba(27,30,40,0.12)",
  text: "#1B1E28",
  muted: "#5A646E",
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
  // On-space text / accents (rendered directly over the galaxy)
  onSpace: "#FFFFFF",
  onSpaceMuted: "rgba(255,255,255,0.75)",
  onSpaceFaint: "rgba(255,255,255,0.55)",
  onSpaceDanger: "#FF9DB4",
  brandGold: "#F5C542",
  cyanBright: "#30DFFF",
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

/* ------------------------------------------------------------------ */
/* Galaxy backdrop                                                     */
/* ------------------------------------------------------------------ */

/** Deterministic PRNG (mulberry32) — the sky is identical every render. */
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StarSpec {
  left: number;
  top: number;
  size: number;
  opacity: number;
  color: string;
  round: boolean;
}

const STAR_TINTS = [
  "#FFFFFF",
  "#FFFFFF",
  "#FFFFFF",
  "#BCD7FF",
  "#E3D0FF",
  "#FFD9EC",
  "#FFE9B8",
  "#B8FFF1",
];

/**
 * Nebula glows: large saturated color clouds built from concentric
 * discs (each step inward is smaller and stronger) so the color falls
 * off softly like a space photo. Positions are fractions of the
 * viewport; several bleed off the edges so colors blend together.
 */
const NEBULAE: {
  fx: number;
  fy: number;
  size: number;
  rgb: string;
  peak: number;
}[] = [
  // Palette retuned 2026-11-01 toward the guppy artwork's hues
  // (sampled: deep indigo #1C2248/#2A366E, indigo-violet #49428C,
  // lavender #896EC2/#A490D8, with magenta-pink tail light and cyan
  // crystal glints) so backdrop and artwork read as one world.
  { fx: 0.88, fy: 0.1, size: 560, rgb: "139,92,246", peak: 0.5 }, // violet, top right
  { fx: 0.05, fy: 0.34, size: 620, rgb: "76,84,214", peak: 0.46 }, // indigo, left middle
  { fx: 0.95, fy: 0.72, size: 540, rgb: "217,70,190", peak: 0.4 }, // magenta, bottom right
  { fx: 0.18, fy: 0.92, size: 500, rgb: "56,200,248", peak: 0.34 }, // cyan glint, bottom left
  { fx: 0.55, fy: 0.5, size: 680, rgb: "104,58,205", peak: 0.36 }, // violet heart
];

function buildStars(width: number, height: number): StarSpec[] {
  const rnd = mulberry32(42);
  const stars: StarSpec[] = [];
  const push = (
    left: number,
    top: number,
    size: number,
    opacity: number,
    color: string,
  ) => stars.push({ left, top, size, opacity, color, round: size <= 3.4 });

  // Main field — dense and bright, a few hero stars.
  for (let i = 0; i < 230; i++) {
    const hero = i < 7;
    push(
      rnd() * width,
      rnd() * height,
      hero ? 3.4 + rnd() * 1.2 : 1 + rnd() * (rnd() > 0.88 ? 2.2 : 1.4),
      hero ? 0.95 : 0.3 + rnd() * 0.65,
      STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)],
    );
  }
  // Milky-way band: a diagonal river of tiny clustered stars running
  // from the top-right down to the bottom-left.
  const bx0 = width * 1.08;
  const by0 = -height * 0.06;
  const bx1 = -width * 0.08;
  const by1 = height * 0.78;
  for (let i = 0; i < 190; i++) {
    const t = rnd();
    const scatter =
      ((rnd() + rnd() + rnd()) / 3 - 0.5) * width * 0.52 * (0.35 + rnd() * 0.65);
    const dx = bx1 - bx0;
    const dy = by1 - by0;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    push(
      bx0 + dx * t + px * scatter,
      by0 + dy * t + py * scatter,
      0.7 + rnd() * 1.1,
      0.2 + rnd() * 0.6,
      rnd() > 0.25 ? "#DCE9FF" : "#FFFFFF",
    );
  }
  // One bright cluster (upper right, inside the purple nebula).
  const cx = width * 0.76;
  const cy = height * 0.15;
  for (let i = 0; i < 30; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 1.6) * 74;
    push(
      cx + Math.cos(ang) * rad,
      cy + Math.sin(ang) * rad,
      1.2 + rnd() * 2.4,
      0.55 + rnd() * 0.45,
      rnd() > 0.3 ? "#FFFFFF" : "#E3D0FF",
    );
  }
  return stars;
}

/**
 * The full-bleed galaxy: deep-space gradient, bold nebula glows, a
 * dense starfield with a milky-way band and a bright cluster, and a
 * vignette to seat the edges. Fully static, memoized, touch-transparent
 * — rendered by Screen behind all content on every screen.
 */
export const GalaxyBackground = React.memo(function GalaxyBackground() {
  const { width, height } = Dimensions.get("window");
  const stars = useMemo(() => buildStars(width, height), [width, height]);
  return (
    <View style={styles.galaxy} pointerEvents="none">
      <LinearGradient
        colors={["#02030A", "#0B1124", "#1C2248", "#241B54"]}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* milky-way glow strip underneath the band stars */}
      <View
        style={[
          styles.milkyGlow,
          {
            width: width * 1.7,
            left: -width * 0.35,
            top: height * 0.26,
          },
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(164,144,216,0)",
            "rgba(148,150,255,0.13)",
            "rgba(190,160,255,0.10)",
            "rgba(164,144,216,0)",
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {NEBULAE.map((n, i) => {
        const cx = n.fx * width;
        const cy = n.fy * height;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: cx - n.size / 2,
              top: cy - n.size / 2,
              width: n.size,
              height: n.size,
            }}
          >
            {[1, 0.68, 0.42, 0.2].map((scale, j) => (
              <View
                key={j}
                style={{
                  position: "absolute",
                  left: (n.size - n.size * scale) / 2,
                  top: (n.size - n.size * scale) / 2,
                  width: n.size * scale,
                  height: n.size * scale,
                  borderRadius: (n.size * scale) / 2,
                  backgroundColor: `rgba(${n.rgb},${(n.peak * (0.16 + j * 0.14)).toFixed(3)})`,
                }}
              />
            ))}
          </View>
        );
      })}
      {stars.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.round ? s.size / 2 : 0,
            backgroundColor: s.color,
            opacity: s.opacity,
          }}
        />
      ))}
      {/* vignette */}
      <LinearGradient
        colors={["rgba(2,3,10,0.38)", "rgba(2,3,10,0)"]}
        style={[styles.vignette, { height: 150, top: 0 }]}
      />
      <LinearGradient
        colors={["rgba(2,3,10,0)", "rgba(2,3,10,0.5)"]}
        style={[styles.vignette, { height: 190, bottom: 0 }]}
      />
    </View>
  );
});

export function Screen({
  children,
  embedded,
}: {
  children: React.ReactNode;
  /** Rendered inside another Screen (e.g. a DeFi sub-view): no nested
   *  ScrollView / galaxy, just the stacked content. */
  embedded?: boolean;
}) {
  if (embedded) {
    return <View style={styles.embeddedContent}>{children}</View>;
  }
  return (
    <View style={styles.screenWrap}>
      <GalaxyBackground />
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
 * Used on the Dashboard header and on empty states. `tone` picks the
 * surface it sits on: "space" (default) is gold on the galaxy; "card"
 * is the blue brand inside a glass card, where gold would wash out.
 */
export function DontPanic({
  compact,
  tone = "space",
}: {
  compact?: boolean;
  tone?: "space" | "card";
}) {
  const onCard = tone === "card";
  // Orbitron is the app's space-age display face (same as the splash
  // wordmark). Loaded here as well so the header renders in it wherever
  // it appears; until the font arrives the bold system face stands in.
  // One stylish line only — no tagline under it (2026-11-01, user:
  // 「カッコいいテキストにして。スペースもあんまり取らないように」).
  const [fontsLoaded] = useFonts({
    "Orbitron-Black": require("../../assets/fonts/Orbitron-Black.ttf"),
  });
  return (
    <View style={styles.dontPanicWrap}>
      <Text
        style={[
          styles.dontPanic,
          compact && styles.dontPanicCompact,
          onCard && styles.dontPanicOnCard,
          fontsLoaded && styles.dontPanicFont,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        DON'T PANIC
      </Text>
    </View>
  );
}

export function TodoMt({ items }: { items: string[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <Text style={styles.cardTitle}>{t("ui.todoMt")}</Text>
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
  galaxy: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: colors.space,
  },
  milkyGlow: {
    position: "absolute",
    height: 210,
    transform: [{ rotate: "-24deg" }],
  },
  vignette: { position: "absolute", left: 0, right: 0 },
  title: {
    color: colors.onSpace,
    fontSize: 24,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  todoItem: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  dontPanicWrap: { alignItems: "center", paddingVertical: 2 },
  dontPanic: {
    color: colors.brandGold,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    // soft gold halo instead of a drop shadow — a glowing guide-book
    // cover line floating on the galaxy
    textShadowColor: "rgba(245,197,66,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  dontPanicFont: { fontFamily: "Orbitron-Black", fontWeight: "normal" },
  dontPanicCompact: { fontSize: 20, letterSpacing: 4 },
  dontPanicOnCard: {
    color: colors.accent,
    textShadowColor: "transparent",
    textShadowRadius: 0,
  },
});
