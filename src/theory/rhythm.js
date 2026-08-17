// Note durations and metre.
//
// Everything is measured in quarter-note beats, because that is the unit the
// synth already schedules in and the unit a time signature's denominator is
// expressed against.

export const DURATIONS = [
  { id: '16', label: '1/16', beats: 0.25 },
  { id: '8', label: '1/8', beats: 0.5 },
  { id: '8d', label: '1/8.', beats: 0.75, dotted: true },
  { id: '4', label: '1/4', beats: 1 },
  { id: '4d', label: '1/4.', beats: 1.5, dotted: true },
  { id: '2', label: '1/2', beats: 2 },
  { id: '2d', label: '1/2.', beats: 3, dotted: true },
  { id: '1', label: '1/1', beats: 4 },
]

export const DEFAULT_DURATION = 4
export const MIN_BEATS = 0.125

const BY_ID = new Map(DURATIONS.map((d) => [d.id, d]))

/**
 * Lengths are plain numbers of beats, because a chord dragged along a lyric can
 * land anywhere and no fixed set of note values can express that. The presets
 * above are a picker shortcut, and the old id strings are still accepted so
 * sections and links saved before this change keep working.
 */
export function toBeats(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  const preset = BY_ID.get(value)
  if (preset) return preset.beats
  return DEFAULT_DURATION
}

/** The preset matching a length exactly, if there is one — used by the picker. */
export function presetFor(beats) {
  const n = toBeats(beats)
  return DURATIONS.find((d) => Math.abs(d.beats - n) < 1e-9) ?? null
}

export function durationOf(value) {
  return presetFor(value) ?? { id: 'custom', label: fractionLabel(toBeats(value)), beats: toBeats(value) }
}

/** "1/4", "3/8", "1.25 beats" — a readable label for an arbitrary length. */
export function fractionLabel(beats) {
  const preset = DURATIONS.find((d) => Math.abs(d.beats - beats) < 1e-9)
  if (preset) return preset.label
  const sixteenths = Math.round(beats * 4)
  if (Math.abs(sixteenths / 4 - beats) < 1e-6) {
    const whole = Math.floor(sixteenths / 4)
    const rest = sixteenths % 4
    if (!rest) return `${whole} beat${whole === 1 ? '' : 's'}`
    const frac = ['', '¼', '½', '¾'][rest]
    return whole ? `${whole}${frac} beats` : `${frac} beat`
  }
  return `${(+beats.toFixed(2))} beats`
}

export const beatsOf = toBeats

/** Total length of a chord list, in quarter-note beats. */
export function totalBeats(durations) {
  return durations.reduce((sum, d) => sum + toBeats(d), 0)
}

export const TIME_SIGNATURES = [
  { id: '4/4', beatsPerBar: 4, top: 4, bottom: 4 },
  { id: '3/4', beatsPerBar: 3, top: 3, bottom: 4 },
  { id: '2/4', beatsPerBar: 2, top: 2, bottom: 4 },
  { id: '6/8', beatsPerBar: 3, top: 6, bottom: 8 },
  { id: '5/4', beatsPerBar: 5, top: 5, bottom: 4 },
  { id: '7/8', beatsPerBar: 3.5, top: 7, bottom: 8 },
  { id: '12/8', beatsPerBar: 6, top: 12, bottom: 8 },
]

export const DEFAULT_TIME_SIGNATURE = '4/4'

const TS_BY_ID = new Map(TIME_SIGNATURES.map((t) => [t.id, t]))

export function timeSignatureOf(id) {
  return TS_BY_ID.get(id) ?? TS_BY_ID.get(DEFAULT_TIME_SIGNATURE)
}

/**
 * Group a chord list into bars for notation. A chord longer than the space left
 * in the bar is split across the bar line and the continuation is marked as
 * tied, which is how a chart would actually be written.
 *
 * @returns array of bars, each an array of { index, chord, durationId, beats, tiedFromPrevious }
 */
export function groupIntoBars(items, timeSignatureId) {
  const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
  const bars = []
  let bar = []
  let filled = 0

  const flush = () => {
    if (bar.length) bars.push(bar)
    bar = []
    filled = 0
  }

  items.forEach((item, index) => {
    let remaining = toBeats(item.durationId ?? item.beats)
    let tied = false
    // Guard against a zero/negative duration turning this into an infinite loop.
    if (!(remaining > 0)) remaining = DEFAULT_DURATION

    while (remaining > 0) {
      const space = perBar - filled
      const take = Math.min(space, remaining)
      bar.push({ ...item, index, beats: take, tiedFromPrevious: tied })
      filled += take
      remaining -= take
      tied = true
      if (filled >= perBar - 1e-9) flush()
    }
  })

  flush()
  return bars
}

/** Does the chord list fill its bars exactly? */
export function barsAreComplete(durations, timeSignatureId) {
  const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
  const total = totalBeats(durations)
  const remainder = total % perBar
  return remainder < 1e-9 || Math.abs(remainder - perBar) < 1e-9
}

/** "3 bars + 2 beats" — used to tell the user where a segment ends. */
export function describeLength(durations, timeSignatureId) {
  const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
  const total = totalBeats(durations)
  const whole = Math.floor(total / perBar + 1e-9)
  const rest = total - whole * perBar
  const barPart = `${whole} bar${whole === 1 ? '' : 's'}`
  if (rest < 1e-9) return barPart
  const beatPart = `${+rest.toFixed(2)} beat${rest === 1 ? '' : 's'}`
  return whole ? `${barPart} + ${beatPart}` : beatPart
}

/**
 * Snap a beat position to the metre when it is close, and leave it alone
 * otherwise — so a chord lands cleanly on a bar line or beat if you nudge it
 * near one, but can still sit mid-word where a lyric needs it.
 *
 * @param tolerance how near, in beats, counts as "close"
 */
export function snapBeat(beats, timeSignatureId, tolerance = 0.18) {
  const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
  // Strongest pull to bar lines, then beats, then eighths.
  const grids = [
    { size: perBar, pull: 1.6 },
    { size: 1, pull: 1 },
    { size: 0.5, pull: 0.6 },
  ]
  let best = null
  for (const { size, pull } of grids) {
    const nearest = Math.round(beats / size) * size
    const distance = Math.abs(beats - nearest)
    if (distance > tolerance * pull) continue
    if (!best || distance < best.distance) best = { value: nearest, distance }
  }
  return best ? Math.max(0, best.value) : Math.max(0, beats)
}
