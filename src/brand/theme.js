// The Picardy palette.
//
// Vendored from picardy-shorts/shared/theme.js rather than imported: this app is
// deployed on its own, so it cannot reach into a sibling directory at build time.
// The recipe is the thing worth copying — every colour is derived from one hue,
// with saturation and lightness fixed so that any hue in the set stays legible.
//
// Keep in step with the source if that palette changes; the check suite asserts
// the contrast ratios the recipe is supposed to guarantee.

export const HUES = [
  { id: 'amber', name: 'Amber', hue: 36 },
  { id: 'coral', name: 'Coral', hue: 12 },
  { id: 'rose', name: 'Rose', hue: 344 },
  { id: 'orchid', name: 'Orchid', hue: 300 },
  { id: 'violet', name: 'Violet', hue: 268 },
  { id: 'indigo', name: 'Indigo', hue: 228 },
  { id: 'azure', name: 'Azure', hue: 202 },
  { id: 'teal', name: 'Teal', hue: 172 },
  { id: 'jade', name: 'Jade', hue: 148 },
  { id: 'lime', name: 'Lime', hue: 94 },
]

/** Amber: the brand's own hue. */
export const BRAND_HUE = 36

const cache = new Map()

export function makeTheme(hue = BRAND_HUE) {
  const h = ((Math.round(hue) % 360) + 360) % 360
  if (cache.has(h)) return cache.get(h)

  const theme = {
    hue: h,
    // Light and saturated enough that near-black text on it clears WCAG AA.
    accent: hsl(h, 86, 64),
    accentInk: hsl(h, 55, 9),
    // The dark surfaces carry a trace of the hue rather than being neutral grey.
    bg: hsl(h, 26, 5),
    panel: hsl(h, 21, 9),
    panelEdge: hsl(h, 17, 19),
    ink: hsl(h, 16, 96),
    dim: hsl(h, 13, 63),
    string: hsl(h, 10, 46),
    // A second colour far enough round the wheel to read as a different idea
    // without clashing — used here for anything that must not be mistaken for
    // the accent, such as the guide-tone ring.
    cool: hsl((h + 158) % 360, 58, 62),
  }
  cache.set(h, theme)
  return theme
}

const hsl = (h, s, l) => hslToHex(h, s / 100, l / 100)

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0]
      : h < 120 ? [x, c, 0]
        : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c]
            : h < 300 ? [x, 0, c]
              : [c, 0, x]
  const byte = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Perceptual distance between two colours (CIE76 ΔE in Lab).
 *
 * Contrast ratio answers "can you read text on this?" — it is blind to hue, so
 * it scores a blue and an orange of equal lightness as identical. The chord-tone
 * palette needs the other question: "can you tell these two dots apart?" Roughly,
 * ΔE under 2 is invisible, 10 is a nudge, 30+ is unmistakably a different colour.
 */
export function deltaE(a, b) {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

function toLab(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  // sRGB to XYZ, normalised against the D65 white point.
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116))
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])]
}
