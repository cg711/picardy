// Pitch spelling primitives.
//
// A note is { letter: 0..6 (C=0), acc: number } where acc counts sharps (+) or
// flats (-). Keeping the letter separate from the pitch class is what lets the
// app say "Ab" in one key and "G#" in another, and spell Cb / E# / Fx correctly
// when a chord's theoretical spelling demands it.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11]

export const mod = (n, m) => ((n % m) + m) % m

/** Fold an accidental count into the -6..6 range (shortest spelling distance). */
export function normAcc(a) {
  while (a > 6) a -= 12
  while (a < -6) a += 12
  return a
}

export function accString(acc) {
  if (acc === 0) return ''
  if (acc > 0) return acc === 2 ? 'x' : '#'.repeat(acc)
  return 'b'.repeat(-acc)
}

export function noteName(note) {
  return LETTERS[note.letter] + accString(note.acc)
}

/** Unicode-flavoured name for display (♯ / ♭ read better at small sizes). */
export function prettyName(note) {
  return noteName(note).replace(/#/g, '♯').replace(/b/g, '♭').replace(/x/g, '𝄪')
}

export function pcOf(note) {
  return mod(LETTER_PC[note.letter] + note.acc, 12)
}

export function parseNote(str) {
  const m = /^([A-Ga-g])((?:#|b|♯|♭|x)*)$/.exec(String(str).trim())
  if (!m) return null
  const letter = LETTERS.indexOf(m[1].toUpperCase())
  let acc = 0
  for (const ch of m[2]) {
    if (ch === '#' || ch === '♯') acc += 1
    else if (ch === 'b' || ch === '♭') acc -= 1
    else if (ch === 'x') acc += 2
  }
  return { letter, acc }
}

export function notesEqual(a, b) {
  return a && b && a.letter === b.letter && a.acc === b.acc
}

/**
 * Spell the note a generic interval `degree` (1=unison, 3=third, 9=ninth…)
 * and `semitones` above `root`. The letter comes from the generic degree, the
 * accidental is whatever makes the pitch class come out right.
 */
export function spellFrom(root, degree, semitones) {
  const letter = mod(root.letter + (degree - 1), 7)
  const want = mod(LETTER_PC[root.letter] + root.acc + semitones, 12)
  const acc = normAcc(want - LETTER_PC[letter])
  return { letter, acc }
}

/** Generic interval (in letter steps) from a up to b, 0..6. */
export function letterDistance(a, b) {
  return mod(b.letter - a.letter, 7)
}

/** Semitones from a up to b, 0..11. */
export function pcDistance(a, b) {
  return mod(pcOf(b) - pcOf(a), 12)
}

// --- MIDI helpers -----------------------------------------------------------

/** Nearest MIDI number at or above `floor` with the given pitch class. */
export function midiAtOrAbove(pc, floor) {
  let m = floor + mod(pc - floor, 12)
  return m
}

export function midiToPc(m) {
  return mod(m, 12)
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Fallback naming for a bare pitch class when no spelling context exists. */
export function pcName(pc, preferFlats = false) {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(pc, 12)]
}

export function midiName(m, preferFlats = false) {
  return pcName(mod(m, 12), preferFlats) + (Math.floor(m / 12) - 1)
}

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12)
}
