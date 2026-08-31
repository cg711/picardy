// What a melody note is doing against the chord underneath it.
//
// A piano roll that only draws pitches is a sequencer. The whole reason to put
// one in Picardy is that the app already knows what chord is sounding at every
// beat, so it can say whether the note you just placed is a chord tone, a colour
// the chord invites, or the one note that will fight it — and why.

import { mod, pcOf } from './notes.js'
import { chordNotes, degreeLabel, QUALITIES } from './chords.js'
import { scalePcs } from './keys.js'

/**
 * Named tensions by their distance above the chord root.
 *
 * Written as the 9/11/13 a player would call them rather than 2/4/6, because
 * that is how they are talked about over a chord.
 */
const TENSION = {
  1: { label: '♭9', why: 'a flat ninth — sharp and unstable, at home over a dominant and harsh elsewhere' },
  2: { label: '9', why: 'the ninth, the most consonant colour you can add' },
  3: { label: '♯9', why: 'a sharp ninth — the blues third sitting over a major third' },
  5: { label: '11', why: 'the eleventh' },
  6: { label: '♯11', why: 'a sharp eleventh — the Lydian colour, bright and open' },
  8: { label: '♭13', why: 'a flat thirteenth — dark, and a dominant chord takes it well' },
  9: { label: '13', why: 'the thirteenth, warm and open' },
  10: { label: '♭7', why: 'a flat seventh over a chord that has none — it turns it dominant' },
  11: { label: '7', why: 'a major seventh over a chord that has none' },
}

/**
 * The note that fights the chord.
 *
 * A natural 11th sits a half step above the major third, and those two together
 * are the one combination that reliably sounds like a mistake rather than a
 * colour. It is only a problem when the chord actually has that third, which is
 * why this asks rather than assuming.
 */
function isAvoid(interval, chord) {
  if (interval !== 5) return false
  return chordNotes(chord).some((e) => e.degree === 3 && mod(e.semi, 12) === 4)
}

/**
 * Classify one pitch against one chord.
 *
 * @returns { role, label, why } where role is one of:
 *   chord   — a note of the chord itself
 *   tension — in the key, and a colour the chord invites
 *   avoid   — in the key, but a half step above the chord's major third
 *   outside — not in the key at all
 */
export function classifyNote(midi, chord, key) {
  const pc = mod(midi, 12)
  if (!chord) {
    return { role: 'outside', label: '', why: 'No chord is sounding here.' }
  }

  const tones = chordNotes(chord)
  const hit = tones.find((e) => pcOf(e.note) === pc)
  if (hit) {
    const label = degreeLabel(hit, chord)
    return { role: 'chord', label, why: chordToneWhy(label, chord) }
  }

  const interval = mod(pc - pcOf(chord.root), 12)
  const inKey = key ? new Set(scalePcs(key)).has(pc) : true
  const named = TENSION[interval]

  if (isAvoid(interval, chord)) {
    return {
      role: 'avoid',
      label: '11',
      why: 'a natural eleventh, a half step above the chord’s third — the one tension that fights rather than colours. Fine passing through, rough held.',
    }
  }

  if (!inKey) {
    return {
      role: 'outside',
      label: named?.label ?? '',
      why: 'outside the key — it works as a passing note or an approach into the next chord tone, and stands out if you sit on it.',
    }
  }

  return {
    role: 'tension',
    label: named?.label ?? '',
    why: named ? `${named.why}.` : 'in the key, but not a note of this chord.',
  }
}

const chordToneWhy = (label, chord) => {
  const family = QUALITIES[chord.qualityId]?.family
  if (label === 'R') return 'the root — the most stable note you can land on, and the least surprising.'
  if (label === '3') return 'the third — the note that makes this chord major.'
  if (label === '♭3') return 'the third — the note that makes this chord minor.'
  if (label === '5') return 'the fifth — stable, but it says less about the chord than the third does.'
  if (label === '♭7') return family === 'dom'
    ? 'the seventh — half of the tritone that gives a dominant its pull.'
    : 'the seventh.'
  if (label === '7') return 'the major seventh — the brightest note in the chord.'
  return `the ${label} of the chord.`
}

/** Which chord is sounding at a beat, given per-chord durations. */
export function chordAtBeat(progression, durations, beat) {
  let at = 0
  for (let i = 0; i < progression.length; i++) {
    const len = durations[i]
    if (beat >= at - 1e-6 && beat < at + len - 1e-6) return { chord: progression[i], index: i }
    at += len
  }
  return { chord: null, index: -1 }
}

/**
 * The pitch range a roll should draw.
 *
 * Two octaves centred on the key's tonic, which is where a sung or played line
 * actually sits — a full 88 keys of empty roll is unusable on a laptop.
 */
export function rollRange(key) {
  const tonic = key ? mod(pcOf(key.tonic), 12) : 0
  const bottom = 60 + tonic - 12
  return { low: bottom, high: bottom + 24 }
}

/** Notes sorted and de-duplicated, so two clicks on one cell cannot stack. */
export function normaliseMelody(notes) {
  const seen = new Set()
  return [...notes]
    .filter((n) => Number.isFinite(n.at) && Number.isFinite(n.midi) && n.beats > 0)
    .sort((a, b) => a.at - b.at || a.midi - b.midi)
    .filter((n) => {
      const k = `${+n.at.toFixed(3)}:${n.midi}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}
