/**
 * TasbihBead — one bead of the tasbih, drawn from scratch with
 * react-native-svg (no Mihrab code — this is AHDORA's own rendering).
 *
 * Shapes: flower (8 petals around a centre, like the Mihrab
 * screenshot's green flower beads), circle, square, triangle,
 * diamond. The flower is 8 small circles around a centre circle —
 * no image asset, so it recolours cleanly with any base colour.
 *
 * Effects (all real):
 * - plain: flat base colour.
 * - metallic: vertical light → base → dark SVG gradient (shine).
 * - chromatic: a multi-hue gradient (base hue rotated +140° / +260°).
 * - 3d: drop shadow on the wrapper + a white top highlight.
 *
 * `lit` is the progress state on the counter string: lit beads are
 * full colour, unlit beads are the same shape at low opacity.
 * `showAllah` overlays a small الله on the bead (the design preview
 * and the counter string, as in the second screenshot).
 */
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import type { BeadEffect, BeadShape } from '../lib/tasbihDesign';
import { beadTextColor, darken, lighten, rotateHue } from '../lib/tasbihDesign';
import { F } from '../lib/theme';

type Props = {
  size: number;
  shape: BeadShape;
  color: string;
  effect: BeadEffect;
  /** False = dimmed (not counted yet). Defaults to true. */
  lit?: boolean;
  /** Overlay a small الله on the bead. Defaults to false. */
  showAllah?: boolean;
};

/** 8 petal centres for the flower shape (fractions of the bead size). */
function flowerPetals(size: number): { cx: number; cy: number; r: number }[] {
  const c = size / 2;
  const orbit = size * 0.21;
  const pr = size * 0.2;
  const out: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    out.push({ cx: c + orbit * Math.cos(a), cy: c + orbit * Math.sin(a), r: pr });
  }
  return out;
}

export default function TasbihBead({ size, shape, color, effect, lit = true, showAllah = false }: Props) {
  // useId can contain ':' — strip non-alphanumerics for a valid SVG id.
  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const c = size / 2;
  const fill = effect === 'metallic' || effect === 'chromatic' ? `url(#${gid})` : color;
  const textColor = beadTextColor(color);

  let shapeEl: React.ReactNode;
  if (shape === 'flower') {
    shapeEl = (
      <>
        {flowerPetals(size).map((p, i) => (
          <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={fill} />
        ))}
        <Circle cx={c} cy={c} r={size * 0.24} fill={fill} />
      </>
    );
  } else if (shape === 'circle') {
    shapeEl = <Circle cx={c} cy={c} r={size * 0.46} fill={fill} />;
  } else if (shape === 'square') {
    const s = size * 0.86;
    shapeEl = <Rect x={(size - s) / 2} y={(size - s) / 2} width={s} height={s} rx={size * 0.16} fill={fill} />;
  } else if (shape === 'triangle') {
    shapeEl = (
      <Polygon
        points={`${c},${size * 0.06} ${size * 0.94},${size * 0.9} ${size * 0.06},${size * 0.9}`}
        fill={fill}
        strokeLinejoin="round"
      />
    );
  } else {
    // diamond
    shapeEl = (
      <Polygon
        points={`${c},${size * 0.05} ${size * 0.95},${c} ${c},${size * 0.95} ${size * 0.05},${c}`}
        fill={fill}
        strokeLinejoin="round"
      />
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size },
        effect === '3d' && lit && styles.shadow3d,
        !lit && styles.dim,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          {effect === 'metallic' ? (
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lighten(color, 0.45)} />
              <Stop offset="0.55" stopColor={color} />
              <Stop offset="1" stopColor={darken(color, 0.35)} />
            </LinearGradient>
          ) : effect === 'chromatic' ? (
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="0.5" stopColor={rotateHue(color, 140)} />
              <Stop offset="1" stopColor={rotateHue(color, 260)} />
            </LinearGradient>
          ) : null}
        </Defs>
        {shapeEl}
        {effect === '3d' ? (
          <Ellipse
            cx={size * 0.36}
            cy={size * 0.28}
            rx={size * 0.2}
            ry={size * 0.11}
            fill="#FFFFFF"
            opacity={0.38}
            rotation={-25}
          />
        ) : null}
      </Svg>
      {showAllah && lit ? (
        <View style={styles.labelWrap} pointerEvents="none">
          <Text style={[styles.label, { fontSize: Math.max(8, size * 0.26), color: textColor }]}>
            الله
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  shadow3d: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dim: { opacity: 0.2 },
  labelWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: F.arabic, fontWeight: '700' },
});
