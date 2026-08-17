// Parsing a written chord chart.
//
// Accepts what people actually type: "| Cmaj7 | Am7 | Dm7 G7 |", or bare
// "C Am F G", across several lines. Bar lines set the metre; chords sharing a
// bar split it between them.

import { parseChord } from '../theory/chords.js'
import { DURATIONS, timeSignatureOf, DEFAULT_TIME_SIGNATURE } from '../theory/rhythm.js'

/** The duration id closest to a number of beats, so split bars land on real values. */
function closestDuration(beats) {
  let best = DURATIONS[DURATIONS.length - 1]
  let bestGap = Infinity
  for (const d of DURATIONS) {
    const gap = Math.abs(d.beats - beats)
    if (gap < bestGap - 1e-9) {
      bestGap = gap
      best = d
    }
  }
  return best.id
}

/**
 * Parse a chart into chords and durations.
 *
 * @returns { chords, durations, bars, unknown, usedBarLines }
 *          `unknown` lists tokens that did not parse, so the UI can point at them.
 */
export function parseChart(text, timeSignature = DEFAULT_TIME_SIGNATURE) {
  const beatsPerBar = timeSignatureOf(timeSignature).beatsPerBar
  const raw = String(text ?? '')
  const usedBarLines = raw.includes('|')

  // Split into bars. Without bar lines, treat each line as a bar so that
  // "C Am\nF G" still reads as two bars of two chords.
  const barTexts = usedBarLines
    ? raw.split('|')
    : raw.split(/\n+/)

  const chords = []
  const durations = []
  const unknown = []
  const bars = []

  for (const barText of barTexts) {
    const tokens = barText.trim().split(/[\s,]+/).filter(Boolean)
    if (!tokens.length) continue

    const parsed = []
    for (const token of tokens) {
      // Common chart shorthand that is not a chord.
      if (/^(N\.?C\.?|%|\/|:|\||-)$/i.test(token)) continue
      const chord = parseChord(token.replace(/[()]/g, ''))
      if (chord) parsed.push(chord)
      else unknown.push(token)
    }
    if (!parsed.length) continue

    // Chords in a bar share it evenly, which is how a chart is read.
    const each = beatsPerBar / parsed.length
    const durationId = closestDuration(each)
    bars.push(parsed.length)
    for (const chord of parsed) {
      chords.push(chord)
      durations.push(durationId)
    }
  }

  return { chords, durations, bars, unknown, usedBarLines }
}

/** Render a progression back out as a chart, for copying or round-tripping. */
export function formatChart(progression, durations, timeSignature = DEFAULT_TIME_SIGNATURE, symbolOf) {
  const beatsPerBar = timeSignatureOf(timeSignature).beatsPerBar
  const durationBeats = (id) => DURATIONS.find((d) => d.id === id)?.beats ?? 4

  const bars = []
  let current = []
  let filled = 0
  progression.forEach((chord, i) => {
    current.push(symbolOf(chord))
    filled += durationBeats(durations[i] ?? '1')
    if (filled >= beatsPerBar - 1e-9) {
      bars.push(current)
      current = []
      filled = 0
    }
  })
  if (current.length) bars.push(current)

  // Four bars to a line, the way a lead sheet is laid out.
  const lines = []
  for (let i = 0; i < bars.length; i += 4) {
    lines.push('| ' + bars.slice(i, i + 4).map((b) => b.join(' ')).join(' | ') + ' |')
  }
  return lines.join('\n')
}
