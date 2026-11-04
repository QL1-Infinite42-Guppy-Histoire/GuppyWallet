import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { useI18n } from "../context/LanguageContext";
import type { GuideArt, GuideItemState } from "../lib/zaphod";
import { prettyAmount } from "../lib/onchain";
import { GuppyMascot } from "./GuppyMascot";
import { colors } from "./ui";

/**
 * Oripa-style pack-opening moment for a freshly minted Guide
 * (the oripa/gacha reveal the user asked for, 2026-11-04).
 *
 * Three phases: a sealed, glowing pack waits for a tap → a flash
 * burst with particles and a shake → the real Guide card appears.
 * The glow tier is driven ONLY by the Guide's real on-chain tier
 * (tier >= 3 cycles rainbow, 2 = gold, 1 = silver-blue, 0 = soft
 * white) and every number shown (score, emblem, forms) comes from
 * the chain via fetchGuideItem — the presentation is theatre, the
 * contents are not. Artwork comes from tokenURI when parseable;
 * otherwise a mascot fallback card is shown.
 */

type Phase = "sealed" | "burst" | "revealed";

const RAINBOW = ["#FFD700", "#FF5CA8", "#30DFFF", "#9B35FF", "#FFD700"];

interface ParticleSpec {
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
}

export default function OripaReveal({
  item,
  art,
  onClose,
}: {
  item: GuideItemState;
  art: GuideArt | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("sealed");

  const pulse = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;
  const rainbow = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  const tier = item.tier ?? 0;
  const glowColor =
    tier >= 3 ? "#FFD700" : tier === 2 ? "#F5C542" : tier === 1 ? "#9FD8FF" : "#FFFFFF";

  const particles = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        angle: (i / 26) * Math.PI * 2 + (i % 3) * 0.21,
        distance: 110 + ((i * 47) % 130),
        size: 5 + ((i * 29) % 8),
        color:
          tier >= 3
            ? RAINBOW[i % RAINBOW.length]
            : i % 3 === 0
              ? glowColor
              : "#FFFFFF",
        delay: (i % 5) * 24,
      })),
    [tier, glowColor],
  );

  // Sealed-pack breathing glow.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Rainbow glow cycling for top-tier reveals.
  useEffect(() => {
    if (phase !== "revealed" || tier < 3) return;
    const loop = Animated.loop(
      Animated.timing(rainbow, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, tier, rainbow]);

  const open = () => {
    if (phase !== "sealed") return;
    setPhase("burst");
    Vibration.vibrate([0, 70, 40, 120]);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 130, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
      Animated.timing(burst, {
        toValue: 1,
        duration: 780,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPhase("revealed");
      Animated.spring(cardIn, {
        toValue: 1,
        friction: 6,
        tension: 58,
        useNativeDriver: true,
      }).start();
    });
  };

  const shakeX = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-9, 0, 9],
  });
  const packScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  const packGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] });
  const cardScale = cardIn.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const rainbowBorder = rainbow.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: RAINBOW,
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.flash, { opacity: flash }]}
          pointerEvents="none"
        />
        {phase === "sealed" ? (
          <TouchableOpacity activeOpacity={0.9} onPress={open} style={styles.center}>
            <Animated.View
              style={[
                styles.packGlow,
                {
                  opacity: packGlowOpacity,
                  backgroundColor: glowColor,
                  transform: [{ scale: packScale }],
                },
              ]}
            />
            <Animated.View
              style={[styles.pack, { transform: [{ scale: packScale }] }]}
            >
              <Text style={styles.packSeal}>✦</Text>
              <GuppyMascot size={110} />
              <Text style={styles.packTitle}>GUIDE PACK</Text>
              <Text style={styles.packSub}>{t("oripa.sealedSub")}</Text>
            </Animated.View>
            <Text style={styles.tapHint}>{t("oripa.tap")}</Text>
          </TouchableOpacity>
        ) : null}

        {phase !== "sealed" ? (
          <Animated.View
            style={[styles.center, { transform: [{ translateX: shakeX }] }]}
          >
            <View style={styles.particleLayer} pointerEvents="none">
              {particles.map((p, i) => {
                const progress = burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                });
                const translateX = Animated.multiply(
                  progress,
                  Math.cos(p.angle) * p.distance,
                );
                const translateY = Animated.multiply(
                  progress,
                  Math.sin(p.angle) * p.distance,
                );
                const opacity = burst.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [1, 1, 0],
                });
                const scale = burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1.15],
                });
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.particle,
                      {
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        opacity,
                        transform: [{ translateX }, { translateY }, { scale }],
                      },
                    ]}
                  />
                );
              })}
            </View>
            {phase === "revealed" ? (
              <Animated.View
                style={[
                  styles.cardWrap,
                  { opacity: cardIn, transform: [{ scale: cardScale }] },
                ]}
              >
                <Animated.View
                  style={[
                    styles.card,
                    tier >= 3
                      ? { borderColor: rainbowBorder as unknown as string }
                      : { borderColor: glowColor },
                    {
                      shadowColor: glowColor,
                      shadowOpacity: tier >= 2 ? 0.95 : 0.55,
                    },
                  ]}
                >
                  <Text style={styles.gotLabel}>{t("oripa.newGuide")}</Text>
                  <View style={styles.artBox}>
                    {art?.svg ? (
                      <SvgXml xml={art.svg} width="100%" height="100%" />
                    ) : art?.imageUrl ? (
                      <Image
                        source={{ uri: art.imageUrl }}
                        style={styles.artImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.artFallback}>
                        <GuppyMascot size={120} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.guideName}>
                    {art?.name ?? `Guide #${item.id}`}
                  </Text>
                  <View style={styles.statRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>{t("guide.tier")}</Text>
                      <Text style={styles.statValue}>
                        {item.tier !== null ? String(item.tier) : "—"}
                      </Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>{t("guide.score")}</Text>
                      <Text style={styles.statValue}>
                        {item.scoreFormatted
                          ? prettyAmount(item.scoreFormatted)
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>{t("fluke.emblem")}</Text>
                      <Text style={styles.statValue}>
                        {item.currentEmblem ?? "—"}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,6,18,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  flash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFF7D6",
  },
  center: { alignItems: "center", justifyContent: "center" },
  packGlow: {
    position: "absolute",
    width: 250,
    height: 330,
    borderRadius: 28,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 44,
    elevation: 18,
  },
  pack: {
    width: 218,
    height: 300,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.brandGold,
    backgroundColor: "#0B1233",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  packSeal: { color: colors.brandGold, fontSize: 26, marginBottom: 10 },
  packTitle: {
    color: colors.onSpace,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 14,
  },
  packSub: {
    color: colors.onSpaceMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 19,
  },
  tapHint: {
    color: colors.brandGold,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 30,
  },
  particleLayer: {
    position: "absolute",
    width: 4,
    height: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: { position: "absolute", borderRadius: 99 },
  cardWrap: { alignItems: "center" },
  card: {
    width: 292,
    borderRadius: 24,
    borderWidth: 3,
    backgroundColor: colors.glassSheet,
    padding: 20,
    alignItems: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 34,
    elevation: 20,
  },
  gotLabel: {
    color: colors.accentWarm,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  artBox: {
    width: 208,
    height: 208,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0B1233",
    alignItems: "center",
    justifyContent: "center",
  },
  artImage: { width: "100%", height: "100%" },
  artFallback: { alignItems: "center", justifyContent: "center", flex: 1 },
  guideName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 14,
    textAlign: "center",
  },
  statRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  closeBtn: {
    marginTop: 22,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 42,
  },
  closeText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
