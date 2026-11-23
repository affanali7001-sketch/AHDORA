/**
 * Tasbih bead design — the "Design your tasbih" customisation.
 *
 * A design is { shape, color, effect } and is stored per user in
 * AsyncStorage, so it survives restarts and applies to the counter
 * screen immediately. Saved designs are a real per-user list: each
 * entry is only there because the user tapped "+" — nothing is
 * pre-filled or faked.
 *
 * Effects are all real visual styles rendered by TasbihBead:
 * - plain: the flat base colour.
 * - metallic: a vertical light → base → dark gradient (shine).
 * - chromatic: a multi-hue gradient (the base hue rotated around
 *   the colour wheel).
 * - 3d: drop shadow + a top highlight, i.e. real depth.
 *
 * Colour helpers are small hand-rolled hex/HSL maths (no dependency).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BeadShape = 'flower' | 'circle' | 'square' | 'triangle' | 'diamond';
export type BeadEffect = 'plain' | 'metallic' | 'chromatic' | '3d';

export type TasbihDesign = {
  shape: BeadShape;
  /** Hex colour, e.g. '#E9A93B'. */
  color: string;
  effect: BeadEffect;
};

export type SavedDesign = {
  id: string;
  /** Auto name: 'Design 1', 'Design 2', … */
  name: string;
  design: TasbihDesign;
};

/** The golden flower bead from the Mihrab screenshot — the default. */
export const DEFAULT_DESIGN: TasbihDesign = {
  shape: 'flower',
  color: '#E9A93B',
  effect: 'metallic',
};

export const BEAD_SHAPES: readonly BeadShape[] = [
  'flower',
  'circle',
  'square',
  'triangle',
  'diamond',
];

export const BEAD_EFFECTS: readonly BeadEffect[] = ['plain', 'metallic', 'chromatic', '3d'];

/** Quick presets — bead colours, each shown as a flower bead. */
export const PRESET_COLORS: readonly { name: string; color: string }[] = [
  { name: 'Gold', color: '#E9A93B' },
  { name: 'Green', color: '#1E6B52' },
  { name: 'Black', color: '#262626' },
  { name: 'Brown', color: '#8B5E34' },
  { name: 'Blue', color: '#2F6F9F' },
  { name: 'Teal', color: '#0B4A41' },
  { name: 'Rose', color: '#B0506A' },
];

/** Base-colour picker swatches. */
export const BASE_COLORS: readonly string[] = [
  '#E9A93B',
  '#F08A1D',
  '#8B5E34',
  '#262626',
  '#1E6B52',
  '#0B4A41',
  '#2F6F9F',
  '#6A4FA3',
  '#B0506A',
  '#8A8F98',
];

// ---- colour maths -------------------------------------------------------

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const p = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Mix a colour towards white (amt 0..1). */
export function lighten(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

/** Mix a colour towards black (amt 0..1). */
export function darken(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    const tt = ((t % 1) + 1) % 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hn + 1 / 3) * 255),
    g: Math.round(channel(hn) * 255),
    b: Math.round(channel(hn - 1 / 3) * 255),
  };
}

/** Same colour with its hue rotated by `deg` degrees. */
export function rotateHue(hex: string, deg: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const out = hslToRgb(h + deg, s, l);
  return rgbToHex(out.r, out.g, out.b);
}

/** White text on this bead colour, or near-black — whichever reads. */
export function beadTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Relative luminance; light beads get dark text.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.62 ? '#2A2118' : '#FFFFFF';
}

// ---- validation ---------------------------------------------------------

function isShape(v: unknown): v is BeadShape {
  return typeof v === 'string' && (BEAD_SHAPES as readonly string[]).includes(v);
}

function isEffect(v: unknown): v is BeadEffect {
  return typeof v === 'string' && (BEAD_EFFECTS as readonly string[]).includes(v);
}

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Unknown stored value → a safe design (defaults for bad fields). */
export function sanitizeDesign(raw: unknown): TasbihDesign {
  const d = (raw ?? {}) as Partial<TasbihDesign>;
  return {
    shape: isShape(d.shape) ? d.shape : DEFAULT_DESIGN.shape,
    color: isHexColor(d.color) ? d.color.toUpperCase() : DEFAULT_DESIGN.color,
    effect: isEffect(d.effect) ? d.effect : DEFAULT_DESIGN.effect,
  };
}

function sanitizeSaved(raw: unknown): SavedDesign[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedDesign[] = [];
  for (const item of raw) {
    const it = (item ?? {}) as Partial<SavedDesign>;
    if (typeof it.id !== 'string' || typeof it.name !== 'string') continue;
    out.push({ id: it.id, name: it.name, design: sanitizeDesign(it.design) });
  }
  return out;
}

// ---- persistence --------------------------------------------------------

function designKey(uid: string): string {
  return `tasbih:design:${uid}`;
}

function savedKey(uid: string): string {
  return `tasbih:designs:${uid}`;
}

/** Design writes go through one promise chain so rapid changes (e.g. dragging through colours) can never land out of order. */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(work: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(work).catch(() => undefined);
  writeQueue = run;
  return run;
}

/** The user's current design (the default golden flower bead when none saved). */
export async function loadDesign(uid: string): Promise<TasbihDesign> {
  try {
    const raw = await AsyncStorage.getItem(designKey(uid));
    if (raw == null) return DEFAULT_DESIGN;
    return sanitizeDesign(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_DESIGN;
  }
}

/** Save the current design (applies to the counter screen on next open). */
export function saveDesign(uid: string, design: TasbihDesign): Promise<void> {
  const safe = sanitizeDesign(design);
  return enqueueWrite(() =>
    AsyncStorage.setItem(designKey(uid), JSON.stringify(safe)),
  );
}

/** The user's real saved designs — [] when none have been saved yet. */
export async function loadSavedDesigns(uid: string): Promise<SavedDesign[]> {
  try {
    const raw = await AsyncStorage.getItem(savedKey(uid));
    if (raw == null) return [];
    return sanitizeSaved(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/**
 * Save the current design under the next free auto name ('Design 1',
 * 'Design 2', …). Returns the updated list.
 */
export async function saveDesignAs(uid: string, design: TasbihDesign): Promise<SavedDesign[]> {
  const list = await loadSavedDesigns(uid);
  let n = 1;
  for (const item of list) {
    const m = /^Design (\d+)$/.exec(item.name);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  const entry: SavedDesign = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: `Design ${n}`,
    design: sanitizeDesign(design),
  };
  const next = [...list, entry];
  await enqueueWrite(() => AsyncStorage.setItem(savedKey(uid), JSON.stringify(next)));
  return next;
}

/** Delete one saved design. Returns the updated list. */
export async function deleteSavedDesign(uid: string, id: string): Promise<SavedDesign[]> {
  const list = await loadSavedDesigns(uid);
  const next = list.filter((d) => d.id !== id);
  await enqueueWrite(() => AsyncStorage.setItem(savedKey(uid), JSON.stringify(next)));
  return next;
}
