// Naming the distance between two notes.
//
// An interval has two independent halves: how many letter names it spans, and
// how many semitones. C–E♭ and C–D♯ are the same distance on a keyboard and
// different intervals — a minor third and an augmented second — because the
// first spans C-D-E and the second spans C-D. Everything here keeps those two
// numbers apart, the same way a chord keeps its generic degree separate from its
// semitone offset.

import { mod, pcOf, spellFrom, letterDistance, prettyName } from './notes.js'

/** Semitones in the major or perfect form of each generic interval, 1..8. */
const REFERENCE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 }

/** 1, 4, 5 and 8 are perfect rather than major — they have no minor form. */
const PERFECT = new Set([1, 4, 5, 8])

const ORDINAL = { 1: 'unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'octave' }

/**
 * Quality name from how far the interval sits from its reference form.
 *
 * Returns null past a double alteration: a triple-diminished 4th is a real thing
 * on paper and never the answer to a question worth asking.
 */
function quality(generic, offset) {
  if (PERFECT.has(generic)) {
    return { '-2': 'doubly diminished', '-1': 'diminished', 0: 'perfect', 1: 'augmented', 2: 'doubly augmented' }[offset] ?? null
  }
  return { '-3': 'doubly diminished', '-2': 'diminished', '-1': 'minor', 0: 'major', 1: 'augmented', 2: 'doubly augmented' }[offset] ?? null
}

/**
 * The interval from `a` up to `b`, taking `b` as the nearer one above.
 *
 * Note objects carry no octave, so this measures within one — except that a
 * unison and an octave share a pitch class, and `octave` says which was meant.
 */
export function intervalBetween(a, b, { octave = false } = {}) {
  const letters = letterDistance(a, b)
  const generic = octave && letters === 0 ? 8 : letters + 1
  const semis = octave && letters === 0 ? 12 : mod(pcOf(b) - pcOf(a), 12)
  const name = quality(generic, semis - REFERENCE[generic])
  if (!name) return null
  return {
    generic,
    semitones: semis,
    quality: name,
    name: `${name} ${ORDINAL[generic]}`,
    // "perfect unison" and "perfect octave" read as fussy; nobody says them.
    label: generic === 1 || generic === 8 ? ORDINAL[generic] : `${name} ${ORDINAL[generic]}`,
  }
}

/** The note a named interval above `root`. */
export function noteAtInterval(root, generic, semitones) {
  return spellFrom(root, generic === 8 ? 8 : generic, semitones)
}

/**
 * The catalogue questions draw on — every interval inside an octave that a
 * musician would name without hesitating, in the order the ear learns them.
 */
export const INTERVALS = [
  { generic: 1, semitones: 0, name: 'unison', rank: 0 },
  { generic: 2, semitones: 1, name: 'minor 2nd', rank: 1 },
  { generic: 2, semitones: 2, name: 'major 2nd', rank: 0 },
  { generic: 3, semitones: 3, name: 'minor 3rd', rank: 0 },
  { generic: 3, semitones: 4, name: 'major 3rd', rank: 0 },
  { generic: 4, semitones: 5, name: 'perfect 4th', rank: 0 },
  { generic: 4, semitones: 6, name: 'augmented 4th', rank: 2 },
  { generic: 5, semitones: 6, name: 'diminished 5th', rank: 2 },
  { generic: 5, semitones: 7, name: 'perfect 5th', rank: 0 },
  { generic: 6, semitones: 8, name: 'minor 6th', rank: 1 },
  { generic: 6, semitones: 9, name: 'major 6th', rank: 1 },
  { generic: 7, semitones: 10, name: 'minor 7th', rank: 1 },
  { generic: 7, semitones: 11, name: 'major 7th', rank: 1 },
  { generic: 8, semitones: 12, name: 'octave', rank: 0 },
]

/**
 * How an interval sounds, in one line.
 *
 * Song hooks are how people actually learn to hear these, and the tune is worth
 * more than another sentence about semitone counts.
 */
export const INTERVAL_EAR = {
  'minor 2nd': 'A half step — the tightest, most unsettled sound there is.',
  'major 2nd': 'A whole step. Adjacent scale degrees, as in the opening of a scale.',
  'minor 3rd': 'The interval that makes a chord minor. Dark, closed.',
  'major 3rd': 'The interval that makes a chord major. Bright, open.',
  'perfect 4th': 'Hollow and strong — the sound of a fanfare opening.',
  'augmented 4th': 'The tritone: restless, unresolved, splitting the octave exactly in half.',
  'diminished 5th': 'The tritone again by pitch, but spelled downward-pulling rather than upward.',
  'perfect 5th': 'Wide open and stable — the interval a power chord is built from.',
  'minor 6th': 'Warm and slightly aching. A major 3rd turned upside down.',
  'major 6th': 'Bright and lifting. A minor 3rd turned upside down.',
  'minor 7th': 'The interval that gives a dominant chord its pull.',
  'major 7th': 'A half step short of the octave — luminous, and a little sharp-edged.',
  unison: 'The same note twice.',
  octave: 'The same note, higher. The one interval everyone hears immediately.',
}

/** Describe a concrete pair for an explanation: "C up to E♭ spans C-D-E". */
export function spanText(a, b, generic) {
  return `${prettyName(a)} up to ${prettyName(b)} spans ${generic} letter name${generic === 1 ? '' : 's'}`
}
