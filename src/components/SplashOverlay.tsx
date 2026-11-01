import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GUPPY_ART } from "./guppyArt";
import { colors } from "./ui";

/**
 * Opening splash, shown once per cold start for ~3 seconds, then
 * fading away to the normal UI (user request, 2026-11-01). The cosmic
 * guppy artwork fills the screen with no panel, frame or visible edge
 * anywhere — but NOT by cropping it: on a tall phone screen a plain
 * full-bleed cover of the square artwork zoomed in so hard the fish's
 * head was cut off (user feedback, 2026-11-01: 「これズームし過ぎ」).
 * So the composition is two layers of the same artwork: a full-bleed
 * cover copy, heavily blurred and darkened with a deep-violet tint,
 * forms the backdrop; the sharp artwork sits on top in "contain", so
 * the whole fish and scene are visible, centred, with the blurred
 * backdrop melting into the letterbox areas around it. Deep
 * indigo-violet veils at the top and bottom melt everything into the
 * app's space colours, and the "GuppyWallet" wordmark in Orbitron
 * (Google Fonts, OFL) sits over the bottom veil, which keeps it
 * readable. If the font ever fails to load the title simply falls
 * back to the system font with the same styling; the splash never
 * waits on it (1.2 s cap) and never blocks the app: it is a purely
 * visual overlay on top of the root, and the biometric unlock prompt
 * is a system dialog that renders above it.
 */
const HOLD_UNTIL_MS = 2600; // fade starts ~2.6 s after mount
const FADE_MS = 500; // gone at ~3.1 s
const FONT_WAIT_CAP_MS = 1200;

export default function SplashOverlay() {
  const [fontsLoaded] = useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    "Orbitron-Black": require("../../assets/fonts/Orbitron-Black.ttf"),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    "Orbitron-Bold": require("../../assets/fonts/Orbitron-Bold.ttf"),
  });
  const [fontReady, setFontReady] = useState(false);
  const [gone, setGone] = useState(false);
  const startedAt = useRef(Date.now());
  const opacity = useRef(new Animated.Value(1)).current;
  // The backdrop starts slightly zoomed-in and settles to 1 — never
  // below 1, so the full-bleed blurred copy never pulls back far
  // enough to show an edge. The sharp foreground artwork is NOT
  // scaled: scaling it would crop the contain layout and bring back
  // the over-zoom the user rejected.
  const artScale = useRef(new Animated.Value(1.06)).current;

  // The title should show in Orbitron, but the splash must not hang
  // on the font: proceed on load OR after a short cap, whichever first.
  useEffect(() => {
    if (fontsLoaded) {
      setFontReady(true);
      return;
    }
    const cap = setTimeout(() => setFontReady(true), FONT_WAIT_CAP_MS);
    return () => clearTimeout(cap);
  }, [fontsLoaded]);

  // Gentle settle-in for the blurred backdrop while the splash is up.
  useEffect(() => {
    const intro = Animated.timing(artScale, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    intro.start();
    return () => intro.stop();
  }, [artScale]);

  // Hold until ~2.6 s from mount (counted from mount, not from the
  // font, so the total stays ~3 s), then fade out and unmount.
  useEffect(() => {
    if (!fontReady || gone) return;
    const elapsed = Date.now() - startedAt.current;
    const timer = setTimeout(
      () => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => setGone(true));
      },
      Math.max(0, HOLD_UNTIL_MS - elapsed),
    );
    return () => clearTimeout(timer);
  }, [fontReady, gone, opacity]);

  if (gone) return null;

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      {/* Backdrop: the same artwork full-bleed (cover) but heavily
          blurred, so the areas around the sharp artwork read as the
          same world dissolving into deep space — no frame, no border,
          no edge anywhere. */}
      <Animated.View
        style={[styles.artWrap, { transform: [{ scale: artScale }] }]}
      >
        <Image
          source={GUPPY_ART}
          style={styles.art}
          resizeMode="cover"
          blurRadius={22}
        />
      </Animated.View>
      {/* Deep-violet dark tint over the backdrop only, so the
          letterbox areas sit in deep space and the sharp artwork on
          top carries the picture. */}
      <View style={styles.backdropTint} pointerEvents="none" />
      {/* Foreground: the artwork sharp, in "contain", centred — the
          WHOLE fish and scene are visible, uncropped, on any screen
          shape. */}
      <Image
        source={GUPPY_ART}
        style={styles.artContain}
        resizeMode="contain"
        accessibilityLabel="GuppyWallet cosmic guppy artwork"
      />
      {/* A whisper of violet over the whole composition, so its
          colours sit in the same family as the app's deep-space
          background. */}
      <View style={styles.tint} pointerEvents="none" />
      {/* Deep indigo-violet veils: the image melts into the space
          colours at the top and bottom instead of ending at an edge,
          and the bottom veil keeps the wordmark readable. */}
      <LinearGradient
        colors={["rgba(7,13,36,0.9)", "rgba(7,13,36,0)"]}
        style={styles.veilTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(7,13,36,0)", "rgba(7,13,36,0.55)", "rgba(7,13,36,0.94)"]}
        locations={[0, 0.55, 1]}
        style={styles.veilBottom}
        pointerEvents="none"
      />
      <View style={styles.titleWrap} pointerEvents="none">
        <View style={styles.titleBlock}>
          <Text
            style={[
              styles.title,
              fontsLoaded ? styles.titleFont : null,
            ]}
          >
            GuppyWallet
          </Text>
          <Text
            style={[
              styles.tagline,
              fontsLoaded ? styles.taglineFont : null,
            ]}
          >
            One Wallet. Infinite Possibilities.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgDeep,
    overflow: "hidden",
    zIndex: 9999,
    elevation: 9999,
  },
  artWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  art: { width: "100%", height: "100%" },
  backdropTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(24,12,58,0.5)",
  },
  artContain: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  tint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(38,22,84,0.1)",
  },
  veilTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
  },
  veilBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: "26%",
  },
  titleBlock: { alignItems: "center", gap: 10 },
  title: {
    color: "#F5F2FF",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 2.5,
    textAlign: "center",
    textShadowColor: "rgba(155,53,255,0.85)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  titleFont: { fontFamily: "Orbitron-Black", fontWeight: "normal" },
  tagline: {
    color: colors.onSpaceMuted,
    fontSize: 13,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  taglineFont: { fontFamily: "Orbitron-Bold", fontSize: 12 },
});
