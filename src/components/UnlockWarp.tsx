import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useWallet } from "../context/WalletContext";

/**
 * A short cosmic flourish for the unlock moment ONLY (user request,
 * 2026-11-01): when the wallet flips from locked to unlocked — the
 * biometric (or password) gate has just succeeded — stars streak
 * outward from the centre in a gentle warp, with a soft violet flash,
 * for about a second before fading into Home. It does NOT play on
 * ordinary navigation, on wallet creation, or on signing-time auth
 * (the session is already unlocked then, so nothing flips). Purely
 * visual: pointerEvents are off, it never delays the unlock — the app
 * is already unlocked underneath — and everything runs on one
 * native-driver Animated value, so it stays light on the device.
 */

const DURATION_MS = 1000;
const STAR_COUNT = 34;
const STAR_TINTS = ["#FFFFFF", "#C4B5FD", "#A5F3FC", "#F5C542", "#DDD6FE"];

interface Star {
  angle: number;
  reach: number; // fraction of the max travel distance
  size: number;
  tint: string;
}

/** Deterministic star field (seeded LCG) — stable across renders. */
function makeStars(): Star[] {
  let seed = 421018;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    angle: (i / STAR_COUNT) * Math.PI * 2 + rnd() * 0.35,
    reach: 0.3 + rnd() * 0.75,
    size: 2 + rnd() * 3.5,
    tint: STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)],
  }));
}

export default function UnlockWarpOverlay() {
  const { unlocked, info } = useWallet();
  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const stars = useMemo(makeStars, []);
  // Play only when a wallet that was seen LOCKED in this session flips
  // to unlocked. (Wallet creation sets info + key together, so it
  // never passes through a "locked with wallet" state → no flourish.)
  const sawLockedWallet = useRef(false);

  useEffect(() => {
    if (!info) {
      sawLockedWallet.current = false;
      return;
    }
    if (!unlocked) {
      sawLockedWallet.current = true;
      return;
    }
    if (unlocked && sawLockedWallet.current) {
      sawLockedWallet.current = false;
      progress.setValue(0);
      setActive(true);
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration: DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      anim.start(() => setActive(false));
      return () => anim.stop();
    }
  }, [unlocked, info, progress]);

  if (!active) return null;

  const maxDist = Math.hypot(width, height) / 2;
  const containerOpacity = progress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [1, 1, 0],
  });
  const flashOpacity = progress.interpolate({
    inputRange: [0, 0.22, 1],
    outputRange: [0, 0.3, 0],
  });
  const flashScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.4],
  });

  return (
    <Animated.View
      style={[styles.root, { opacity: containerOpacity }]}
      pointerEvents="none"
    >
      {/* soft violet flash blooming from the centre */}
      <Animated.View
        style={[
          styles.flash,
          { opacity: flashOpacity, transform: [{ scale: flashScale }] },
        ]}
      />
      {/* stars streaking outward */}
      {stars.map((s, i) => {
        const dist = maxDist * s.reach;
        const tx = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(s.angle) * dist],
        });
        const ty = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(s.angle) * dist],
        });
        const scale = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1.7],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.star,
              {
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                backgroundColor: s.tint,
                transform: [
                  { translateX: tx },
                  { translateY: ty },
                  { scale },
                ],
              },
            ]}
          />
        );
      })}
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
    alignItems: "center",
    justifyContent: "center",
    // Below the cold-start splash (9999), above everything else.
    zIndex: 9998,
    elevation: 9998,
  },
  flash: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#8B5CF6",
  },
  star: { position: "absolute" },
});
