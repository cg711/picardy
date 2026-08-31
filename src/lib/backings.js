// Ready-made backing tracks: the progressions people actually practise over.
//
// Stored as scale degrees rather than chord symbols, the same
// [semitonesAboveTonic, genericDegree, qualityId] triples the exercise
// generator uses. That is what lets every one of these be built in any key with
// the spelling coming out right — a ii–V–I in D♭ has to be E♭m7 A♭7 D♭maj7, not
// D♯m7 G♯7 C♯maj7 — and it means the roman numerals shown over the chart are
// derived from the same engine as everywhere else rather than typed in.

import { makeKey, spellDegree } from '../theory/keys.js'
import { makeChord, chordNotes } from '../theory/chords.js'

/** [semitones, generic, qualityId, beats?] — beats default to a full bar. */
const B = (...bars) => bars

export const BACKINGS = [
  {
    id: 'ii-v-i',
    name: 'ii–V–I',
    blurb: 'The cadence most of jazz is built from. Two bars of setup, two of arrival.',
    mode: 'major',
    tonic: 'C',
    style: 'swing',
    bpm: 120,
    chords: B([2, 2, 'm7'], [7, 5, 'dom7'], [0, 1, 'maj7'], [0, 1, 'maj7']),
  },
  {
    id: 'ii-v-i-minor',
    name: 'ii–V–i in minor',
    blurb: 'The same shape with a half-diminished ii and an altered-sounding V.',
    mode: 'minor',
    tonic: 'C',
    style: 'swing',
    bpm: 112,
    chords: B([2, 2, 'm7b5'], [7, 5, 'dom7'], [0, 1, 'm7'], [0, 1, 'm7']),
  },
  {
    id: 'blues',
    name: '12-bar blues',
    blurb: 'The form. Everything is dominant, and nothing resolves for long.',
    mode: 'major',
    tonic: 'Bb',
    style: 'swing',
    bpm: 108,
    chords: B(
      [0, 1, 'dom7'], [0, 1, 'dom7'], [0, 1, 'dom7'], [0, 1, 'dom7'],
      [5, 4, 'dom7'], [5, 4, 'dom7'], [0, 1, 'dom7'], [0, 1, 'dom7'],
      [7, 5, 'dom7'], [5, 4, 'dom7'], [0, 1, 'dom7'], [7, 5, 'dom7'],
    ),
  },
  {
    id: 'minor-blues',
    name: 'Minor blues',
    blurb: 'Twelve bars in minor, turning around on ♭VI and V.',
    mode: 'minor',
    tonic: 'C',
    style: 'swing',
    bpm: 104,
    chords: B(
      [0, 1, 'm7'], [0, 1, 'm7'], [0, 1, 'm7'], [0, 1, 'm7'],
      [5, 4, 'm7'], [5, 4, 'm7'], [0, 1, 'm7'], [0, 1, 'm7'],
      [8, 6, 'maj7'], [7, 5, 'dom7'], [0, 1, 'm7'], [7, 5, 'dom7'],
    ),
  },
  {
    id: 'rhythm-changes',
    name: 'Rhythm changes — A section',
    blurb: 'Eight bars, two chords a bar, at speed. The other standard everyone knows.',
    mode: 'major',
    tonic: 'Bb',
    style: 'swing',
    bpm: 160,
    chords: B(
      [0, 1, 'maj7', 2], [9, 6, 'm7', 2], [2, 2, 'm7', 2], [7, 5, 'dom7', 2],
      [0, 1, 'maj7', 2], [9, 6, 'm7', 2], [2, 2, 'm7', 2], [7, 5, 'dom7', 2],
      [0, 1, 'maj7', 2], [0, 1, 'dom7', 2], [5, 4, 'maj7', 2], [5, 4, 'min', 2],
      [0, 1, 'maj7', 2], [9, 6, 'm7', 2], [2, 2, 'm7', 2], [7, 5, 'dom7', 2],
    ),
  },
  {
    id: 'pop',
    name: 'I–V–vi–IV',
    blurb: 'The four chords behind a great many songs, in their usual order.',
    mode: 'major',
    tonic: 'C',
    style: 'pop',
    bpm: 104,
    chords: B([0, 1, 'maj'], [7, 5, 'maj'], [9, 6, 'min'], [5, 4, 'maj']),
  },
  {
    id: 'fifties',
    name: 'I–vi–IV–V',
    blurb: 'The fifties turnaround. Doo-wop, ballads, and half the pop of a decade.',
    mode: 'major',
    tonic: 'C',
    style: 'ballad',
    bpm: 84,
    chords: B([0, 1, 'maj'], [9, 6, 'min'], [5, 4, 'maj'], [7, 5, 'maj']),
  },
  {
    id: 'andalusian',
    name: 'Andalusian cadence',
    blurb: 'i–♭VII–♭VI–V, stepping down to a dominant that never quite lets go.',
    mode: 'minor',
    tonic: 'A',
    style: 'bossa',
    bpm: 100,
    chords: B([0, 1, 'min'], [10, 7, 'maj'], [8, 6, 'maj'], [7, 5, 'maj']),
  },
  {
    id: 'bossa',
    name: 'Bossa ii–V–I',
    blurb: 'The same cadence with sevenths and a Latin feel underneath.',
    mode: 'major',
    tonic: 'F',
    style: 'bossa',
    bpm: 132,
    chords: B([2, 2, 'm7'], [7, 5, 'dom7'], [0, 1, 'maj7'], [0, 1, 'maj7']),
  },
  {
    id: 'dorian',
    name: 'Dorian vamp',
    blurb: 'i7 to IV and back. No cadence, no hurry — a modal loop to blow over.',
    mode: 'minor',
    tonic: 'D',
    style: 'pop',
    bpm: 96,
    // A major IV in a minor key is the whole colour: it is the raised 6th that
    // makes this Dorian rather than Aeolian. A plain triad rather than a
    // dominant 7th, so the numeral reads IV — the engine has no Dorian, and it
    // would call a G7 in D minor V7/♭VII, which is true and not the point here.
    chords: B([0, 1, 'm7'], [0, 1, 'm7'], [5, 4, 'maj'], [5, 4, 'maj']),
  },
]

export const backingById = (id) => BACKINGS.find((b) => b.id === id) ?? null

/** The other name for the same pitch, for when one of them spells badly. */
const ENHARMONIC = {
  'C#': 'Db', Db: 'C#',
  'D#': 'Eb', Eb: 'D#',
  'F#': 'Gb', Gb: 'F#',
  'G#': 'Ab', Ab: 'G#',
  'A#': 'Bb', Bb: 'A#',
  B: 'Cb', Cb: 'B',
  E: 'Fb', Fb: 'E',
}

const needsDoubles = (progression) =>
  progression.some((chord) => chordNotes(chord).some((e) => Math.abs(e.note.acc) > 1))

function attempt(preset, tonicName) {
  const key = makeKey(tonicName, preset.mode)
  if (!key) return null
  const progression = []
  const durations = []
  for (const [semis, generic, qualityId, beats] of preset.chords) {
    progression.push(makeChord(spellDegree(key, semis, generic), qualityId))
    durations.push(beats ?? 4)
  }
  return { key, progression, durations }
}

/**
 * Build a preset in a key.
 *
 * Some keys are theoretical for some shapes: a ii–V–i in D♭ minor wants a
 * B♭♭, and a blues in G♭ major needs a C♭7, which contains one too. Rather than
 * curate a key list per preset — which would go stale the moment a preset is
 * added — the same pitch is retried under its other name, and C♯ minor is
 * offered instead. Nothing is refused; it is just spelled the way a musician
 * would write it.
 *
 * Returns the shape encodeState wants, so a preset and a progression written in
 * the studio are the same kind of thing by the time they reach the player.
 */
export function buildBacking(preset, tonicName = null) {
  if (!preset) return null
  const wanted = tonicName ?? preset.tonic
  let built = attempt(preset, wanted)
  if (!built) return null

  if (needsDoubles(built.progression) && ENHARMONIC[wanted]) {
    const other = attempt(preset, ENHARMONIC[wanted])
    if (other && !needsDoubles(other.progression)) built = other
  }

  return {
    key: built.key,
    progression: built.progression,
    inversions: built.progression.map(() => 0),
    durations: built.durations,
    timeSignature: preset.timeSignature ?? '4/4',
    bpm: preset.bpm,
    style: preset.style,
  }
}

/** The twelve pitches a preset is offered in, named the common way. */
export const BACKING_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
