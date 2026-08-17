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

export const DEFAULT_DURATION = '1'

const BY_ID = new Map(DURATIONS.map((d) => [d.id, d]))

export function durationOf(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_DURATION)
}

export function beatsOf(id) {
  return durationOf(id).beats
}

/** Total length of a chord list, in quarter-note beats. */
export function totalBeats(durationIds) {
  return durationIds.reduce((sum, id) => sum + beatsOf(id), 0)
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
    let remaining = beatsOf(item.durationId)
    let tied = false
    // Guard against a zero/negative duration turning this into an infinite loop.
    if (!(remaining > 0)) remaining = beatsOf(DEFAULT_DURATION)

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
export function barsAreComplete(durationIds, timeSignatureId) {
  const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
  const total = totalBeats(durationIds)
  return Math.abs(total % perBar) < 1e-9
}

/** "3 bars + 2 beats" — used to tell the user where a segment ends. */
export function describeLength(durationIds, timeSignatureId) {
  const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
  const total = totalBeats(durationIds)
  const whole = Math.floor(total / perBar + 1e-9)
  const rest = total - whole * perBar
  const barPart = `${whole} bar${whole === 1 ? '' : 's'}`
  if (rest < 1e-9) return barPart
  const beatPart = `${+rest.toFixed(2)} beat${rest === 1 ? '' : 's'}`
  return whole ? `${barPart} + ${beatPart}` : beatPart
}
