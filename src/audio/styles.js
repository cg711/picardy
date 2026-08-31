// Playback styles: what the band plays for one bar.
//
// Kept free of Web Audio so the patterns can be asserted without a sound card —
// a groove that puts a snare past the bar line, or a bass note on a beat that
// does not exist in 3/4, is a bug you cannot hear reliably but can check
// exactly.
//
// Positions are quarter-note beats from the start of the bar, matching
// rhythm.js: in 6/8 a bar is three of them, and the pulse is a dotted quarter.

/** 6/8 and 12/8 are compound — the beat divides into three, not two. */
export const isCompound = (ts) => ts.bottom === 8 && ts.top % 3 === 0

/** The felt pulse: a dotted quarter in compound metre, a quarter otherwise. */
export const pulseOf = (ts) => (isCompound(ts) ? 1.5 : 1)

/** Beat positions of the main pulses in a bar. */
function pulses(ts) {
  const step = pulseOf(ts)
  const out = []
  for (let b = 0; b < ts.beatsPerBar - 1e-9; b += step) out.push(+b.toFixed(4))
  return out
}

/**
 * Every eighth note in a bar.
 *
 * Half a quarter-beat in both simple and compound metre — 6/8 is three
 * quarter-beats holding six eighths, so the spacing is the same and only the
 * grouping differs, which is what pulses() handles.
 */
function subdivisions(ts) {
  const out = []
  for (let b = 0; b < ts.beatsPerBar - 1e-9; b += 0.5) out.push(+b.toFixed(4))
  return out
}

/**
 * Backbeats: the pulses a snare lands on.
 *
 * Every other pulse starting from the second, which gives 2 and 4 in 4/4, 2 in
 * 3/4, and the second dotted pulse in 6/8 — all of which are what those metres
 * actually want.
 */
const backbeats = (ts) => pulses(ts).filter((_, i) => i % 2 === 1)

/**
 * A fill for the last bar before a boundary: the groove holds for the first
 * half, then toms walk down to hand over to the next bar.
 *
 * Generic rather than per-style — a fill is a departure from the groove, so the
 * one thing it should not do is sound like the groove.
 */
function defaultFill(ts) {
  const bar = ts.beatsPerBar
  const half = bar / 2
  const hits = []
  for (const p of pulses(ts)) {
    if (p < half) hits.push({ voice: 'kick', at: p, gain: p === 0 ? 1 : 0.7 })
  }
  // Four even hits across the back half, descending through the kit.
  const voices = ['snare', 'tomHi', 'tomMid', 'tomLo']
  const step = half / voices.length
  voices.forEach((voice, i) => {
    hits.push({ voice, at: +(half + i * step).toFixed(4), gain: 0.75 + i * 0.07 })
  })
  return hits
}

// --- the styles ---------------------------------------------------------------

const pop = (ts) => {
  const drums = []
  for (const s of subdivisions(ts)) drums.push({ voice: 'hat', at: s, gain: s % 1 === 0 ? 0.85 : 0.6 })
  drums.push({ voice: 'kick', at: 0, gain: 1 })
  // The "and" of the middle pulse, which is what stops it sounding like a march.
  const mid = ts.beatsPerBar / 2
  if (ts.beatsPerBar >= 4) drums.push({ voice: 'kick', at: +(mid + 0.5).toFixed(4), gain: 0.8 })
  for (const b of backbeats(ts)) drums.push({ voice: 'snare', at: b, gain: 0.95 })

  return {
    drums,
    comp: pulses(ts).map((p) => ({ at: p, dur: pulseOf(ts) * 0.9, gain: p === 0 ? 0.85 : 0.6 })),
    bass: [
      { at: 0, dur: ts.beatsPerBar / 2, degree: 0, gain: 1 },
      ...(ts.beatsPerBar >= 4 ? [{ at: ts.beatsPerBar / 2, dur: ts.beatsPerBar / 2, degree: 7, gain: 0.85 }] : []),
    ],
  }
}

const swing = (ts) => {
  const drums = []
  // The ride pattern is the style. Quarters, with a swung eighth after every
  // backbeat: ding, ding-da, ding, ding-da.
  for (const p of pulses(ts)) {
    drums.push({ voice: 'ride', at: p, gain: p === 0 ? 0.95 : 0.8 })
    if (backbeats(ts).includes(p)) drums.push({ voice: 'ride', at: +(p + 0.5).toFixed(4), gain: 0.6 })
  }
  // Hi-hat pedal on the backbeats, and a kick felt rather than heard.
  for (const b of backbeats(ts)) drums.push({ voice: 'hat', at: b, gain: 0.5 })
  drums.push({ voice: 'kick', at: 0, gain: 0.28 })

  // Four-to-the-bar walking, alternating root and fifth with an octave on top.
  // Not real voice leading, but it moves, which is what a two-feel does not.
  const degrees = [0, 7, 12, 7]
  return {
    drums,
    comp: [
      { at: 1, dur: 0.5, gain: 0.6 },
      { at: +(ts.beatsPerBar - 1.5).toFixed(4), dur: 0.5, gain: 0.7 },
    ].filter((e) => e.at >= 0 && e.at < ts.beatsPerBar),
    bass: pulses(ts).map((p, i) => ({ at: p, dur: 0.9, degree: degrees[i % degrees.length], gain: 0.95 })),
  }
}

const ballad = (ts) => {
  const drums = []
  for (const s of subdivisions(ts)) drums.push({ voice: 'hat', at: s, gain: s % 1 === 0 ? 0.55 : 0.38 })
  drums.push({ voice: 'kick', at: 0, gain: 0.9 })
  // Cross-stick rather than a backbeat — a full snare is too much at this tempo.
  for (const b of backbeats(ts)) drums.push({ voice: 'rim', at: b, gain: 0.8 })

  return {
    drums,
    // One sustained chord a bar: the point of a ballad is that nothing chops.
    comp: [{ at: 0, dur: ts.beatsPerBar * 0.95, gain: 0.75 }],
    bass: [{ at: 0, dur: ts.beatsPerBar * 0.9, degree: 0, gain: 1 }],
  }
}

const bossa = (ts) => {
  const drums = []
  for (const s of subdivisions(ts)) drums.push({ voice: 'hat', at: s, gain: 0.5 })
  // Son clave, 3-2. Written for 4/4; in other metres it is truncated to the bar
  // rather than stretched, because a clave that has been stretched is not one.
  for (const at of [0, 0.75, 1.5, 2.5, 3]) {
    if (at < ts.beatsPerBar) drums.push({ voice: 'rim', at, gain: at === 0 ? 0.9 : 0.72 })
  }
  drums.push({ voice: 'kick', at: 0, gain: 0.85 })
  if (ts.beatsPerBar > 2) drums.push({ voice: 'kick', at: 2, gain: 0.75 })

  return {
    drums,
    comp: [
      { at: 0, dur: 0.9, gain: 0.7 },
      { at: 1.5, dur: 0.9, gain: 0.6 },
      { at: 2.5, dur: 1, gain: 0.65 },
    ].filter((e) => e.at < ts.beatsPerBar),
    // The surdo figure: root on one, fifth on three, each held.
    bass: [
      { at: 0, dur: 1.9, degree: 0, gain: 1 },
      ...(ts.beatsPerBar > 2 ? [{ at: 2, dur: 1.9, degree: 7, gain: 0.9 }] : []),
    ],
  }
}

/**
 * Every style the transport offers.
 *
 * The four original patterns stay, as styles with no band — they are still the
 * right answer when you want to hear the chords and nothing else. `band: true`
 * is what routes a style through the groove engine instead.
 */
export const STYLES = {
  block: { label: 'Block chords', band: false },
  strum: { label: 'Strum', band: false },
  arpeggio: { label: 'Arpeggio', band: false },
  bassComp: { label: 'Bass + comp', band: false },

  pop: { label: 'Band — pop / rock', band: true, swing: 0, build: pop },
  swing: { label: 'Band — jazz swing', band: true, swing: 1, build: swing },
  ballad: { label: 'Band — ballad', band: true, swing: 0, build: ballad },
  bossa: { label: 'Band — bossa nova', band: true, swing: 0, build: bossa },
}

export const styleOf = (id) => STYLES[id] ?? STYLES.block
export const isBand = (id) => !!styleOf(id).band

/**
 * One bar of the style: swung, trimmed to the bar, ready to schedule.
 *
 * Swing is applied here rather than by the caller because it moves events, and
 * an event moved past the bar line is a note in the wrong bar. Doing it in one
 * place means the returned bar is in-bounds by construction — which is how the
 * ride cymbal that swung off the end of a 7/8 bar was found.
 */
export function barFor(styleId, ts) {
  const style = styleOf(styleId)
  if (!style.band) return null
  const swing = style.swing ?? 0
  const settle = (list) =>
    list
      .map((e) => ({ ...e, at: +swingBeat(e.at, swing).toFixed(4) }))
      .filter((e) => e.at >= 0 && e.at < ts.beatsPerBar - 1e-6)
      .sort((a, b) => a.at - b.at)

  const bar = style.build(ts)
  return {
    drums: settle(bar.drums),
    comp: settle(bar.comp),
    bass: settle(bar.bass),
    fill: settle(style.fill ? style.fill(ts) : defaultFill(ts)),
    swing,
  }
}

/**
 * Where a swung subdivision actually falls.
 *
 * Straight eighths sit halfway through the beat; fully swung ones sit two
 * thirds of the way, which is the triplet feel. Anything already on the beat is
 * untouched, so this is safe to run over every event rather than only the
 * offbeats.
 */
export function swingBeat(at, amount = 0) {
  if (!amount) return at
  const whole = Math.floor(at)
  const frac = at - whole
  if (frac < 0.4 || frac > 0.6) return at
  return whole + 0.5 + amount * (2 / 3 - 0.5)
}
