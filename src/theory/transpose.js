// Transposition, and the capo arithmetic guitarists actually want.

import { mod, pcOf, spellFrom, normAcc, LETTER_PC } from './notes.js'
import { makeChord, chordNotes } from './chords.js'
import { makeKey, KEY_CHOICES, scaleNotes, keySteps } from './keys.js'
import { parseNote, noteName } from './notes.js'

/**
 * Transposition that preserves function, not just pitch.
 *
 * A chord's spelling encodes what it *is*: B♭ in C major is a lowered 7th, so
 * in D major it must be C — the lowered 7th there — and not B♯. Deriving a
 * fresh spelling from the pitch class alone cannot know that, which is how
 * B♭ ends up as A♯ and how repeated transposition drifts into double
 * accidentals. Carrying the generic degree and the interval across from the
 * source key keeps both the function and the accidental character intact.
 */
function moveNote(note, sourceKey, targetKey) {
  const generic = mod(note.letter - sourceKey.tonic.letter, 7) + 1
  const above = mod(pcOf(note) - pcOf(sourceKey.tonic), 12)
  return spellFrom(targetKey.tonic, generic, above)
}

export function transposeNote(note, sourceKey, targetKey) {
  return moveNote(note, sourceKey, targetKey)
}

/** Every spelling of a pitch class within a double accidental. */
function enharmonics(pitchClass) {
  const out = []
  for (let letter = 0; letter < 7; letter++) {
    const acc = normAcc(pitchClass - LETTER_PC[letter])
    if (Math.abs(acc) <= 2) out.push({ letter, acc })
  }
  return out
}

/**
 * How awkward a chord looks on the page. Double accidentals dominate, because
 * one B𝄫 makes the whole chord unreadable however tidy the rest of it is.
 */
function spellingCost(chord) {
  if (!chord) return Infinity
  const tones = chordNotes(chord)
  const doubles = tones.filter((t) => Math.abs(t.note.acc) > 1).length
  const total = tones.reduce((sum, t) => sum + Math.abs(t.note.acc), 0)
  return doubles * 100 + total
}

export function transposeChord(chord, sourceKey, targetKey) {
  if (!chord || !sourceKey || !targetKey) return chord
  if (chord.poly) {
    const upper = transposeChord(chord.poly.upper, sourceKey, targetKey)
    const lower = transposeChord(chord.poly.lower, sourceKey, targetKey)
    return makeChord(lower.root, lower.qualityId, lower.alterations, lower.bass, {
      poly: { upper, lower },
    })
  }

  const root = moveNote(chord.root, sourceKey, targetKey)
  const bass = chord.bass ? moveNote(chord.bass, sourceKey, targetKey) : null
  const functional = makeChord(root, chord.qualityId, chord.alterations, bass)

  // The functional spelling is the right answer when it is legible. It is not
  // always: ♭6 of D♭ is B𝄫, and a German sixth built on it needs a double sharp
  // inside. When that happens, take the enharmonic root that spells the whole
  // chord most cleanly — readability beats derivation on a chart people read.
  if (spellingCost(functional) < 100) return functional

  let best = { chord: functional, cost: spellingCost(functional) }
  for (const candidate of enharmonics(pcOf(root))) {
    const alt = makeChord(
      candidate,
      chord.qualityId,
      chord.alterations,
      bass ? enharmonics(pcOf(bass)).find((b) => Math.abs(b.acc) <= 1) ?? bass : null,
    )
    const cost = spellingCost(alt)
    if (cost < best.cost) best = { chord: alt, cost }
  }
  return best.chord
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
