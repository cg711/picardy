// Laying a progression and a melody out into measures.
//
// Extracted from the MusicXML writer once the staff view needed the same thing.
// Two renderers each deciding for themselves where a bar line falls, and which
// notes get tied across it, would eventually disagree — and the disagreement
// would be invisible until someone compared a printed part with the screen.
//
// The melody is split at chord changes as well as at bar lines. That costs a tie
// and buys a guarantee: no harmony ever has to be attached partway through a
// note, which is what keeps both renderers simple.

import { toBeats, timeSignatureOf } from '../theory/rhythm.js'

/**
 * @param parts   [{ chord, inversion, beats, sectionName? }] in playing order
 * @param melody  [{ at, beats, midi }] in beats from the start
 * @returns [{ index, start, end, sectionName, slots }] where a slot is
 *          { from, to, beats, chord?, inversion?, midi?, tieStart, tieStop }
 *          and a slot with no `midi` is a rest.
 */
export function layOutMeasures(parts, { timeSignature = '4/4', melody = [] } = {}) {
  if (!parts?.length) return []
  const ts = timeSignatureOf(timeSignature)
  const perBar = ts.beatsPerBar

  const spans = []
  let at = 0
  for (const part of parts) {
    const beats = Math.max(0.0625, toBeats(part.beats))
    spans.push({ ...part, start: at, end: at + beats })
    at += beats
  }
  const total = at
  const barCount = Math.max(1, Math.ceil(total / perBar - 1e-9))

  const line = [...(melody ?? [])]
    .filter((n) => Number.isFinite(n?.at) && Number.isFinite(n?.midi) && n.beats > 0)
    .sort((a, b) => a.at - b.at)

  const measures = []
  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * perBar
    const barEnd = barStart + perBar

    const cuts = new Set([barStart, barEnd])
    for (const s of spans) {
      if (s.start > barStart && s.start < barEnd) cuts.add(s.start)
      if (s.end > barStart && s.end < barEnd) cuts.add(s.end)
    }
    for (const n of line) {
      const end = n.at + n.beats
      if (n.at > barStart && n.at < barEnd) cuts.add(n.at)
      if (end > barStart && end < barEnd) cuts.add(end)
    }
    const points = [...cuts].filter((p) => p >= barStart && p <= barEnd).sort((a, b) => a - b)

    const slots = []
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]
      const to = points[i + 1]
      const beats = to - from
      if (beats <= 1e-9) continue

      const starting = spans.find((s) => Math.abs(s.start - from) < 1e-9)
      const note = line.find((n) => n.at <= from + 1e-9 && n.at + n.beats >= to - 1e-9)
      slots.push({
        from,
        to,
        beats,
        chord: starting?.chord ?? null,
        inversion: starting?.inversion ?? 0,
        midi: note ? note.midi : null,
        tieStart: !!note && note.at + note.beats > to + 1e-9,
        tieStop: !!note && note.at < from - 1e-9,
      })
    }

    // A section name belongs to the bar its first chord lands in.
    const opening = spans.find((s) => s.start >= barStart - 1e-9 && s.start < barEnd - 1e-9 && s.sectionName)
    measures.push({ index: bar, start: barStart, end: barEnd, sectionName: opening?.sectionName ?? null, slots })
  }
  return measures
}

/** Note values, longest first, so the closest match is found by scanning. */
const FIGURES = [
  [4, 'whole', 'w', 0], [3, 'half', 'h', 1], [2, 'half', 'h', 0], [1.5, 'quarter', 'q', 1],
  [1, 'quarter', 'q', 0], [0.75, 'eighth', '8', 1], [0.5, 'eighth', '8', 0],
  [0.375, '16th', '16', 1], [0.25, '16th', '16', 0], [0.125, '32nd', '32', 0],
]

/**
 * The closest written note value to a length in beats.
 *
 * Lengths here are arbitrary — a chord dragged along a lyric lands anywhere —
 * so there is not always an exact figure and the nearest one is used. `name` is
 * the MusicXML spelling, `code` the VexFlow one, from the same table so the two
 * renderers cannot pick different values for the same slot.
 */
export function figureFor(beats) {
  let best = FIGURES[FIGURES.length - 1]
  let gap = Infinity
  for (const f of FIGURES) {
    const d = Math.abs(f[0] - beats)
    if (d < gap) { gap = d; best = f }
  }
  return { type: best[1], code: best[2], dots: best[3] }
}
