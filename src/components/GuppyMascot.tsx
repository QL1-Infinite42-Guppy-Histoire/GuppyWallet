import React, { useId } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

/**
 * GuppyWallet's mascot: a little guppy swimming through the galaxy.
 * Hand-drawn flat SVG (no image assets): a teal→blue body, the
 * signature BIG flowing fan tail in the nebula palette
 * (orange → pink → purple), a cute eye, rising bubbles and a few
 * star sparkles. Static and decorative — safe to render anywhere.
 * Gradient ids are suffixed with a per-instance id so several
 * mascots can coexist on one screen without id collisions.
 */

/** Four-point star sparkle path centred on (cx, cy) with radius r. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.16;
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + k} ${cy - k}, ${cx + k} ${cy - k}, ${cx + r} ${cy}`,
    `C ${cx + k} ${cy + k}, ${cx + k} ${cy + k}, ${cx} ${cy + r}`,
    `C ${cx - k} ${cy + k}, ${cx - k} ${cy + k}, ${cx - r} ${cy}`,
    `C ${cx - k} ${cy - k}, ${cx - k} ${cy - k}, ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

export function GuppyMascot({ size = 96 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bodyId = `guppyBody${uid}`;
  const tailId = `guppyTail${uid}`;
  return (
    <Svg
      width={size}
      height={size * (100 / 120)}
      viewBox="0 0 120 100"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={bodyId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#2DD4BF" />
          <Stop offset="0.55" stopColor="#30DFFF" />
          <Stop offset="1" stopColor="#168BFF" />
        </LinearGradient>
        <LinearGradient id={tailId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFB03A" />
          <Stop offset="0.52" stopColor="#FF4D79" />
          <Stop offset="1" stopColor="#9B35FF" />
        </LinearGradient>
      </Defs>

      {/* star sparkles around the swimmer */}
      <Path d={sparkle(105, 11, 5)} fill="#F5C542" />
      <Path d={sparkle(30, 89, 4)} fill="#30DFFF" opacity={0.9} />
      <Path d={sparkle(111, 89, 3.4)} fill="#FFFFFF" opacity={0.85} />

      {/* the big fan tail (guppy signature), flowing to the right */}
      <Path
        d="M 74 43 C 88 29, 102 21, 110 23 C 117 25, 116 37, 113 48 C 116 59, 117 71, 110 75 C 101 79, 87 67, 74 58 Z"
        fill={`url(#${tailId})`}
      />
      {/* fan rays */}
      <Path
        d="M 79 50 L 107 29 M 80 51 L 112 49 M 79 52 L 106 71"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.28}
        fill="none"
      />

      {/* dorsal fin, swept back (drawn before the body so its base
          tucks underneath) */}
      <Path
        d="M 44 34 C 50 24, 61 20, 69 27 C 60 28, 52 32, 48 37 Z"
        fill={`url(#${tailId})`}
        opacity={0.95}
      />
      {/* anal fin under the rear body */}
      <Path
        d="M 55 63 C 60 73, 69 78, 76 74 C 72 66, 64 60, 57 59 Z"
        fill={`url(#${tailId})`}
        opacity={0.85}
      />

      {/* body: plump teardrop, head to the left */}
      <Path
        d="M 12 50 C 12 41, 20 35, 32 32.5 C 48 29, 66 34, 78 43 L 78 57 C 66 66, 48 71, 32 68 C 20 65.5, 12 59, 12 50 Z"
        fill={`url(#${bodyId})`}
      />
      {/* soft sheen + belly light */}
      <Ellipse cx={42} cy={38} rx={22} ry={5} fill="#FFFFFF" opacity={0.18} />
      <Ellipse cx={38} cy={60} rx={20} ry={6} fill="#FFFFFF" opacity={0.14} />
      {/* gill arc */}
      <Path
        d="M 34 36 C 30 44, 30 54, 34 62"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.25}
        fill="none"
      />

      {/* pectoral fin on the body's side */}
      <Path
        d="M 36 54 C 30 61, 30 68, 35 72 C 40 66, 41 59, 39 54 Z"
        fill={`url(#${tailId})`}
        opacity={0.92}
      />

      {/* face: blush, eye with highlight, tiny mouth */}
      <Circle cx={21.5} cy={56.5} r={2.6} fill="#FF4D79" opacity={0.3} />
      <Circle cx={26} cy={45} r={5.2} fill="#FFFFFF" />
      <Circle cx={24.8} cy={45} r={2.9} fill="#0B1E3A" />
      <Circle cx={23.8} cy={43.8} r={1.1} fill="#FFFFFF" />
      <Path
        d="M 12.5 53.5 C 14 55, 15.5 55.3, 17 54.5"
        stroke="rgba(6,40,80,0.55)"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />

      {/* rising bubbles from the front */}
      <Circle
        cx={14}
        cy={22}
        r={3.4}
        fill="rgba(255,255,255,0.22)"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={1}
      />
      <Circle
        cx={7}
        cy={13}
        r={2.4}
        fill="rgba(255,255,255,0.22)"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={1}
      />
      <Circle
        cx={21}
        cy={11}
        r={1.8}
        fill="rgba(255,255,255,0.22)"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={1}
      />
    </Svg>
  );
}
