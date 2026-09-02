// The narrow layer between Picardy's spelling and VexFlow's.
//
// Everything VexFlow needs to be told, that this app already knows: how a pitch
// is named, which key signature to draw, and which accidental to put in front of
// a note. Kept in one place so the staff view and the chord staff cannot answer
// those questions differently — and kept small, because it is a translation and
// not a decision. The decisions are all upstream in the engine.

import { spellPitchInKey } from '../theory/keys.js'
import { LETTERS } from '../theory/notes.js'

/** VexFlow names a pitch "c#/4": letter, accidental, octave. */
export function vexKey(spelled, octave) {
  const acc = spelled.acc > 0 ? '#'.repeat(spelled.acc) : spelled.acc < 0 ? 'b'.repeat(-spelled.acc) : ''
  return `${LETTERS[spelled.letter].toLowerCase()}${acc}/${octave}`
}

/** The key signature VexFlow wants, named rather than counted in fifths. */
export const SIGNATURES = {
  '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
}

export const accidentalGlyph = (acc) =>
  (acc > 0 ? '#'.repeat(acc) : acc < 0 ? 'b'.repeat(-acc) : null)

/**
 * A pitch, ready for VexFlow, spelled the way the key wants it.
 *
 * Returns the accidental separately because VexFlow draws the key signature but
 * will not work out which notes still need one in front of them. This app does
 * know — the spelling came from the engine — so it says so rather than leaving
 * the renderer to guess.
 */
export function vexPitch(midi, key) {
  const { note, octave } = spellPitchInKey(midi, key)
  return { key: vexKey(note, octave), accidental: accidentalGlyph(note.acc) }
}
