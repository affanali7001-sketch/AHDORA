/**
 * TasbihDesign — "Design your tasbih" (Mihrab screenshot 2, rebuilt
 * from scratch in AHDORA's own code).
 *
 * - A large bead preview at the top (the current design, with الله on it).
 * - QUICK PRESETS: preset bead colours — tapping one sets the colour.
 * - SAVED DESIGNS: the user's real saved designs (AsyncStorage,
 *   per user). "+" saves the current design under the next auto name
 *   (Design 1, Design 2, …); tapping a saved design loads it; the
 *   × on a card deletes it. Empty when nothing was ever saved.
 * - BEAD SHAPE: flower / circle / square / triangle / diamond — the
 *   rendered bead really changes shape.
 * - BASE COLOR: a colour picker that really changes the bead colour.
 * - EFFECTS: Plain / Metallic / Chromatic / 3D — all real visual
 *   styles on the bead (flat, gradient shine, multi-hue gradient,
 *   shadow + highlight). No dead toggles.
 *
 * Every change saves the current design immediately, so the counter
 * screen shows it as soon as the user goes back.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { Chip } from '../components/ui';
import TasbihBead from '../components/TasbihBead';
import {
  BASE_COLORS,
  BEAD_EFFECTS,
  BEAD_SHAPES,
  PRESET_COLORS,
  deleteSavedDesign,
  loadDesign,
  loadSavedDesigns,
  saveDesign,
  saveDesignAs,
  type BeadEffect,
  type BeadShape,
  type SavedDesign,
  type TasbihDesign,
} from '../lib/tasbihDesign';

const SHAPE_KEYS: Record<BeadShape, 'tasShapeFlower' | 'tasShapeCircle' | 'tasShapeSquare' | 'tasShapeTriangle' | 'tasShapeDiamond'> = {
  flower: 'tasShapeFlower',
  circle: 'tasShapeCircle',
  square: 'tasShapeSquare',
  triangle: 'tasShapeTriangle',
  diamond: 'tasShapeDiamond',
};

const EFFECT_KEYS: Record<BeadEffect, 'tasEffectPlain' | 'tasEffectMetallic' | 'tasEffectChromatic' | 'tasEffect3d'> = {
  plain: 'tasEffectPlain',
  metallic: 'tasEffectMetallic',
  chromatic: 'tasEffectChromatic',
  '3d': 'tasEffect3d',
};

export default function TasbihDesignScreen({ lang, user }: ScreenProps) {
  const s = stringsFor(lang);
  const uid = user?.id ?? 'anon';
  const [design, setDesign] = useState<TasbihDesign>({ shape: 'flower', color: '#E9A93B', effect: 'metallic' });
  const [saved, setSaved] = useState<SavedDesign[]>([]);

  useEffect(() => {
    void (async () => {
      setDesign(await loadDesign(uid));
      setSaved(await loadSavedDesigns(uid));
    })();
  }, [uid]);

  function apply(next: TasbihDesign): void {
    setDesign(next);
    void saveDesign(uid, next);
  }

  async function handleSaveAs(): Promise<void> {
    setSaved(await saveDesignAs(uid, design));
  }

  async function handleLoad(item: SavedDesign): Promise<void> {
    apply(item.design);
  }

  async function handleDelete(id: string): Promise<void> {
    setSaved(await deleteSavedDesign(uid, id));
  }

  const shapeLabel = s[SHAPE_KEYS[design.shape]];
  const effectLabel = s[EFFECT_KEYS[design.effect]];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      <Text style={T.title}>{s.tasDesignTitle}</Text>
      <Text style={T.sub}>{s.tasDesignSub}</Text>

      {/* Bead preview — the current design, large, with الله on it. */}
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>{s.tasDesignBead}</Text>
        <View style={styles.previewArea}>
          <TasbihBead size={120} shape={design.shape} color={design.color} effect={design.effect} showAllah />
        </View>
        <Text style={styles.previewCaption}>
          {shapeLabel} · {effectLabel} · {design.color}
        </Text>
      </View>

      {/* Quick presets */}
      <Text style={[T.eyebrow, styles.section]}>{s.tasPresets}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRESET_COLORS.map((p) => {
          const selected = design.color.toUpperCase() === p.color.toUpperCase();
          return (
            <Pressable
              key={p.color}
              onPress={() => apply({ ...design, color: p.color })}
              style={[styles.swatch, selected && styles.swatchOn]}
              accessibilityRole="button"
              accessibilityLabel={p.name}
              accessibilityState={{ selected }}
            >
              <TasbihBead size={46} shape="flower" color={p.color} effect="metallic" />
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Saved designs — only what the user really saved. */}
      <Text style={[T.eyebrow, styles.section]}>{s.tasSaved}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          onPress={() => void handleSaveAs()}
          style={styles.saveAs}
          accessibilityRole="button"
          accessibilityLabel={s.tasSaveDesign}
        >
          <Text style={styles.saveAsPlus}>+</Text>
          <Text style={styles.saveAsText}>{s.tasSaveDesign}</Text>
        </Pressable>
        {saved.map((item) => (
          <View key={item.id} style={styles.savedCard}>
            <Pressable
              onPress={() => void handleLoad(item)}
              accessibilityRole="button"
              accessibilityLabel={`${s.tasLoad}: ${item.name}`}
            >
              <TasbihBead size={44} shape={item.design.shape} color={item.design.color} effect={item.design.effect} />
              <Text style={styles.savedName} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleDelete(item.id)}
              style={styles.deleteBadge}
              accessibilityRole="button"
              accessibilityLabel={`${s.tasDelete}: ${item.name}`}
            >
              <Text style={styles.deleteBadgeText}>×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {saved.length === 0 ? <Text style={styles.empty}>{s.tasSavedEmpty}</Text> : null}

      {/* Bead shape */}
      <Text style={[T.eyebrow, styles.section]}>{s.tasShape}</Text>
      <View style={styles.row}>
        {BEAD_SHAPES.map((shape) => {
          const selected = design.shape === shape;
          return (
            <Pressable
              key={shape}
              onPress={() => apply({ ...design, shape })}
              style={[styles.shapeCell, selected && styles.shapeCellOn]}
              accessibilityRole="button"
              accessibilityLabel={s[SHAPE_KEYS[shape]]}
              accessibilityState={{ selected }}
            >
              <TasbihBead size={42} shape={shape} color={design.color} effect={design.effect} />
              <Text style={[styles.shapeLabel, selected && styles.shapeLabelOn]}>
                {s[SHAPE_KEYS[shape]]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Base colour */}
      <Text style={[T.eyebrow, styles.section]}>{s.tasBaseColor}</Text>
      <View style={styles.rowWrap}>
        {BASE_COLORS.map((color) => {
          const selected = design.color.toUpperCase() === color.toUpperCase();
          return (
            <Pressable
              key={color}
              onPress={() => apply({ ...design, color })}
              style={[styles.swatch, selected && styles.swatchOn]}
              accessibilityRole="button"
              accessibilityLabel={color}
              accessibilityState={{ selected }}
            >
              <TasbihBead size={40} shape={design.shape} color={color} effect={design.effect} />
            </Pressable>
          );
        })}
      </View>

      {/* Effects — all four render a real visual style on the bead. */}
      <Text style={[T.eyebrow, styles.section]}>{s.tasEffects}</Text>
      <View style={styles.chipRow}>
        {BEAD_EFFECTS.map((effect) => (
          <Chip
            key={effect}
            label={s[EFFECT_KEYS[effect]]}
            selected={design.effect === effect}
            onPress={() => apply({ ...design, effect })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  section: { marginTop: 22, marginBottom: 10 },
  previewCard: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginTop: 16,
  },
  previewLabel: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  previewArea: {
    backgroundColor: '#EFEAF6',
    borderRadius: S.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    marginTop: 12,
  },
  previewCaption: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOn: { borderColor: C.teal700, backgroundColor: C.teal100 },
  saveAs: {
    width: 76,
    height: 76,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.teal700,
    borderRadius: S.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
  },
  saveAsPlus: { fontFamily: F.sans, fontSize: 24, fontWeight: '700', color: C.teal700, lineHeight: 26 },
  saveAsText: {
    fontFamily: F.sans,
    fontSize: 9.5,
    fontWeight: '700',
    color: C.teal700,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  savedCard: {
    width: 76,
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: S.radiusSm,
    paddingTop: 8,
    paddingBottom: 6,
  },
  savedName: { fontFamily: F.sans, fontSize: 11, fontWeight: '700', color: C.ink, marginTop: 4 },
  deleteBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadgeText: { color: C.white, fontSize: 14, fontWeight: '800', lineHeight: 16 },
  empty: { fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 8 },
  shapeCell: {
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: S.radiusSm,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    minWidth: 62,
  },
  shapeCellOn: { borderColor: C.teal700, backgroundColor: C.teal100 },
  shapeLabel: { fontFamily: F.sans, fontSize: 11, fontWeight: '700', color: C.muted, marginTop: 6 },
  shapeLabelOn: { color: C.teal900 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});
