import { useFonts } from "expo-font";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GUPPY_ART } from "./guppyArt";
import { colors, GalaxyBackground } from "./ui";

/**
 * Opening splash, shown once per cold start for ~3 seconds, then
 * fading away to the normal UI (user request, 2026-11-01): the cosmic
 * guppy artwork big and centred — fully visible, never cropped into a
 * strip — with the "GuppyWallet" wordmark in Orbitron (Google Fonts,
 * OFL), given a violet nebula glow. If the font ever fails to load the
 * title simply falls back to the system font with the same styling;
 * the splash never waits on it (1.2 s cap) and never blocks the app:
 * it is a purely visual overlay on top of the root, and the biometric
 * unlock prompt is a system dialog that renders above it.
 */
const HOLD_UNTIL_MS = 2600; // fade starts ~2.6 s after mount
const FADE_MS = 500; // gone at ~3.1 s
const FONT_WAIT_CAP_MS = 1200;

export default function SplashOverlay() {
  const { width } = useWindowDimensions();
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
  const artScale = useRef(new Animated.Value(0.94)).current;

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

  // Gentle settle-in for the artwork while the splash is up.
  useEffect(() => {
    const intro = Animated.timing(artScale, {
      toValue: 1,
      duration: 900,
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

  const artSize = Math.min(width * 0.84, 400);

  return (
    <Animated.View style={[styles.root, { opacity }]}>
      <GalaxyBackground />
      <View style={styles.center}>
        <Animated.View
          style={[styles.artFrame, { transform: [{ scale: artScale }] }]}
        >
          <Image
            source={GUPPY_ART}
            style={{ width: artSize, height: artSize, borderRadius: 26 }}
            resizeMode="cover"
            accessibilityLabel="GuppyWallet cosmic guppy artwork"
          />
        </Animated.View>
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
    zIndex: 9999,
    elevation: 9999,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 30,
  },
  artFrame: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.45)",
    shadowColor: "#8B5CF6",
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
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
