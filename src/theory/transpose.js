// Transposition, and the capo arithmetic guitarists actually want.

import { mod, pcOf, spellFrom, normAcc, LETTER_PC } from './notes.js'
import { makeChord } from './chords.js'
import { makeKey, KEY_CHOICES, scaleNotes } from './keys.js'
import { parseNote, noteName } from './notes.js'

/**
 * Move a note by a generic-interval step and a semitone step together, so the
 * spelling stays sane: C up 2 letters and 4 semitones is E, not Fb.
 */
function shiftNote(note, letterStep, semitoneStep) {
  const letter = mod(note.letter + letterStep, 7)
  const want = mod(LETTER_PC[note.letter] + note.acc + semitoneStep, 12)
  return { letter, acc: normAcc(want - LETTER_PC[letter]) }
}

/**
 * How many letter names to move for a given semitone shift, choosing the
 * spelling that keeps accidentals smallest — the difference between writing
 * a transposed chord as D♭ or as C♯.
 */
function letterStepFor(semitones, preferFlats) {
  const s = mod(semitones, 12)
  const sharpSteps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
  const flatSteps = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]
  return (preferFlats ? flatSteps : sharpSteps)[s]
}

export function transposeNote(note, semitones, preferFlats = false) {
  return shiftNote(note, letterStepFor(semitones, preferFlats), semitones)
}

export function transposeChord(chord, semitones, preferFlats = false) {
  if (!chord) return null
  const root = transposeNote(chord.root, semitones, preferFlats)
  const bass = chord.bass ? transposeNote(chord.bass, semitones, preferFlats) : null
  if (chord.poly) {
    const upper = transposeChord(chord.poly.upper, semitones, preferFlats)
    const lower = transposeChord(chord.poly.lower, semitones, preferFlats)
    return makeChord(lower.root, lower.qualityId, lower.alterations, lower.bass, {
      poly: { upper, lower },
    })
  }
  return makeChord(root, chord.qualityId, chord.alterations, bass)
}

export function transposeKey(key, semitones) {
  const target = mod(pcOf(key.tonic) + semitones, 12)
  return bestKeyFor(target, key.mode)
}

/**
 * Pick the spelling of a key that a musician would actually write: the one with
 * the fewest accidentals, and never a double-sharp or double-flat.
 */
export function bestKeyFor(pitchClass, mode) {
  let best = null
  for (const name of KEY_CHOICES) {
    const key = makeKey(name, mode)
    if (!key || pcOf(key.tonic) !== mod(pitchClass, 12)) continue
    const notes = scaleNotes(key)
    if (notes.some((n) => Math.abs(n.acc) > 1)) continue
    const cost = notes.reduce((sum, n) => sum + Math.abs(n.acc), 0)
    if (!best || cost < best.cost) best = { key, cost }
  }
  return best?.key ?? makeKey('C', mode)
}

/** Does the target key lean flat? Drives chord spelling after a transpose. */
export function keyPrefersFlats(key) {
  const notes = scaleNotes(key)
  return notes.filter((n) => n.acc < 0).length > notes.filter((n) => n.acc > 0).length
}

/** Semitone distance from one key to another, as the shortest signed move. */
export function intervalBetween(fromKey, toKey) {
  const raw = mod(pcOf(toKey.tonic) - pcOf(fromKey.tonic), 12)
  return raw > 6 ? raw - 12 : raw
}

// --- capo --------------------------------------------------------------------

// Keys a guitarist can play with open-position shapes, roughly in order of how
// comfortable they are. These are the shapes a capo lets you reuse.
const FRIENDLY_SHAPES = [
  { name: 'G', pc: 7, score: 10 },
  { name: 'C', pc: 0, score: 10 },
  { name: 'D', pc: 2, score: 9 },
  { name: 'A', pc: 9, score: 9 },
  { name: 'E', pc: 4, score: 8 },
  { name: 'Am', pc: 9, minor: true, score: 10 },
  { name: 'Em', pc: 4, minor: true, score: 10 },
  { name: 'Dm', pc: 2, minor: true, score: 8 },
]

/**
 * Capo positions that let you play the sounding key using open shapes.
 *
 * @returns array of { fret, shapeKey, shapeName, comfort } sorted best first
 */
export function capoSuggestions(soundingKey, { maxFret = 7 } = {}) {
  const minor = soundingKey.mode === 'minor'
  const soundingPc = pcOf(soundingKey.tonic)
  const out = []

  for (const shape of FRIENDLY_SHAPES) {
    if (!!shape.minor !== minor) continue
    // Capo raises pitch: shape + fret = sounding.
    const fret = mod(soundingPc - shape.pc, 12)
    if (fret === 0 || fret > maxFret) continue
    out.push({
      fret,
      shapeName: shape.name,
      shapeKey: bestKeyFor(shape.pc, soundingKey.mode),
      // Lower frets and friendlier shapes first.
      comfort: shape.score - fret * 0.6,
    })
  }

  return out.sort((a, b) => b.comfort - a.comfort)
}

/** Is this key already playable in open position without a capo? */
export function isOpenFriendly(key) {
  const pc = pcOf(key.tonic)
  return FRIENDLY_SHAPES.some((s) => s.pc === pc && !!s.minor === (key.mode === 'minor'))
}

export { parseNote, noteName, spellFrom }
