// Chord-scales: what to play over a chord.
//
// Rather than a lookup table of chord symbol -> scale name, candidates are
// derived: any scale that contains every chord tone is playable, and the
// ranking then prefers scales that also stay inside the key, breaking ties with
// the conventional choice for that chord quality. That way a ii7 gets Dorian
// and a tritone sub gets Lydian dominant without either being special-cased.

import { mod, pcOf, spellFrom } from './notes.js'
import { QUALITIES, chordNotes } from './chords.js'
import { scalePcs } from './keys.js'

export const SCALES = {
  ionian: { name: 'Ionian (major)', steps: [0, 2, 4, 5, 7, 9, 11], generics: [1, 2, 3, 4, 5, 6, 7] },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  phrygian: { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  lydian: { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], generics: [1, 2, 3, 4, 5, 6, 7] },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  aeolian: { name: 'Aeolian (natural minor)', steps: [0, 2, 3, 5, 7, 8, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  locrian: { name: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  harmonicMinor: { name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11], generics: [1, 2, 3, 4, 5, 6, 7] },
  melodicMinor: { name: 'Melodic minor', steps: [0, 2, 3, 5, 7, 9, 11], generics: [1, 2, 3, 4, 5, 6, 7] },
  lydianDominant: { name: 'Lydian dominant', steps: [0, 2, 4, 6, 7, 9, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  altered: { name: 'Altered (super-Locrian)', steps: [0, 1, 3, 4, 6, 8, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  locrian2: { name: 'Locrian ♮2', steps: [0, 2, 3, 5, 6, 8, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  phrygianDominant: { name: 'Phrygian dominant', steps: [0, 1, 4, 5, 7, 8, 10], generics: [1, 2, 3, 4, 5, 6, 7] },
  lydianAugmented: { name: 'Lydian augmented', steps: [0, 2, 4, 6, 8, 9, 11], generics: [1, 2, 3, 4, 5, 6, 7] },
  halfWhole: { name: 'Half-whole diminished', steps: [0, 1, 3, 4, 6, 7, 9, 10], generics: [1, 2, 3, 3, 4, 5, 6, 7] },
  wholeHalf: { name: 'Whole-half diminished', steps: [0, 2, 3, 5, 6, 8, 9, 11], generics: [1, 2, 3, 4, 5, 6, 6, 7] },
  wholeTone: { name: 'Whole tone', steps: [0, 2, 4, 6, 8, 10], generics: [1, 2, 3, 4, 5, 6] },
  majorPentatonic: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9], generics: [1, 2, 3, 5, 6] },
  minorPentatonic: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], generics: [1, 3, 4, 5, 7] },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10], generics: [1, 3, 4, 5, 5, 7] },
}

// How idiomatic each scale is over each chord family, before key context.
const PREFERENCE = {
  major: { ionian: 10, lydian: 8, majorPentatonic: 6, lydianAugmented: 2, wholeTone: 1 },
  dom: { mixolydian: 10, lydianDominant: 7, altered: 6, halfWhole: 4, phrygianDominant: 5, blues: 5, wholeTone: 3, majorPentatonic: 3, minorPentatonic: 2 },
  minor: { dorian: 9, aeolian: 8, minorPentatonic: 7, phrygian: 5, melodicMinor: 4, harmonicMinor: 3, blues: 4 },
  dim: { locrian: 9, locrian2: 7, wholeHalf: 8, halfWhole: 2 },
  aug: { wholeTone: 9, lydianAugmented: 7 },
  sus: { mixolydian: 9, dorian: 6, majorPentatonic: 4 },
  aug6: { wholeTone: 5, lydianDominant: 6, altered: 4 },
  other: { majorPentatonic: 5, minorPentatonic: 5, mixolydian: 4 },
}

/** Plain-English reason a scale fits, given what it does to the chord. */
function reasonFor(scaleId, chord, insideKey, total) {
  const q = QUALITIES[chord.qualityId]
  const fit = insideKey === total
    ? 'Every note is in the key, so it will not pull against anything else.'
    : `${total - insideKey} of its notes sit outside the key — that is the colour it adds.`

  const specific = {
    ionian: 'The plain major scale on the chord root.',
    dorian: 'Minor with a natural 6th, which is the brighter of the two common minor sounds and avoids the ♭6 clashing against the chord.',
    phrygian: 'Minor with a ♭2 — a darker, Spanish-leaning colour.',
    lydian: 'Major with a ♯4. It removes the natural 4th, which is the one note that fights a major chord.',
    mixolydian: 'Major with a ♭7 — the default dominant sound, all seven notes consonant with the chord.',
    aeolian: 'Natural minor. The ♭6 is what separates it from Dorian.',
    locrian: 'The half-diminished home scale: ♭2, ♭3, ♭5, ♭6, ♭7.',
    locrian2: 'Locrian with a natural 2nd, from melodic minor — less muddy under a ø7 than plain Locrian.',
    harmonicMinor: 'Minor with a raised 7th, which is where a minor key gets its leading tone.',
    melodicMinor: 'Minor 3rd with a natural 6th and 7th — the scale of a m(maj7).',
    lydianDominant: 'Dominant with a ♯11. Standard over a tritone substitute, because the ♯11 is the root of the dominant it replaced.',
    altered: 'Every tension altered — ♭9, ♯9, ♯11, ♭13. Maximum tension into the resolution.',
    phrygianDominant: 'Major 3rd over a ♭2 and ♭6: the dominant sound of a minor key, from harmonic minor.',
    lydianAugmented: 'Major with a ♯4 and ♯5 — the augmented chord as a scale.',
    halfWhole: 'Symmetrical: gives ♭9, ♯9, ♯11 and 13 all at once over a dominant.',
    wholeHalf: 'The symmetrical scale that a fully diminished 7th chord comes from.',
    wholeTone: 'Six equal whole steps — no leading tone at all, which is why it floats.',
    majorPentatonic: 'Five notes, no half steps, nothing to avoid. Safe under any major-quality chord.',
    minorPentatonic: 'Five notes with no half steps. The safest option and the one most fingers already know.',
    blues: 'Minor pentatonic plus the ♭5 passing note.',
  }[scaleId]

  return `${specific} ${fit}`
}

/** Spell a scale from a root, using generic degrees so accidentals come out right. */
export function spellScale(root, scaleId) {
  const scale = SCALES[scaleId]
  if (!scale) return []
  return scale.steps.map((semi, i) => spellFrom(root, scale.generics[i], semi))
}

export function scalePitchClasses(rootPc, scaleId) {
  const scale = SCALES[scaleId]
  if (!scale) return []
  return scale.steps.map((s) => mod(rootPc + s, 12))
}

/**
 * Rank the scales that fit a chord.
 *
 * @returns array of { id, name, notes, pcs, score, insideKey, why, outside }
 */
export function scalesForChord(chord, key, { limit = 5 } = {}) {
  if (!chord) return []
  const chordPcs = [...new Set(chordNotes(chord).map((e) => pcOf(e.note)))]
  const rootPc = pcOf(chord.root)
  const keyPcs = new Set(key ? scalePcs(key) : [])
  const family = QUALITIES[chord.qualityId]?.family ?? 'other'
  const preference = PREFERENCE[family] ?? PREFERENCE.other
  const rootInKey = keyPcs.has(rootPc)

  const results = []
  for (const id of Object.keys(SCALES)) {
    const pcs = scalePitchClasses(rootPc, id)
    const set = new Set(pcs)
    // A scale is only playable if it contains the whole chord.
    if (!chordPcs.every((pc) => set.has(pc))) continue

    const insideKey = pcs.filter((pc) => keyPcs.has(pc)).length
    let base = preference[id] ?? 0.5

    // A dominant whose root is chromatic is a substitute or a borrowed chord —
    // a tritone sub or a backdoor ♭VII7 — and both take Lydian dominant, whose
    // ♯11 is the root of the dominant being replaced.
    if (family === 'dom' && !rootInKey && id === 'lydianDominant') base += 5

    // Staying inside the key matters more than the textbook default: it is why
    // IV takes Lydian rather than Ionian, and iii takes Phrygian.
    const score = base + insideKey * 3.5

    results.push({
      id,
      name: SCALES[id].name,
      notes: spellScale(chord.root, id),
      pcs,
      score,
      insideKey,
      total: pcs.length,
      why: reasonFor(id, chord, insideKey, pcs.length),
      outside: pcs.filter((pc) => !keyPcs.has(pc)),
    })
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * The 3rd and 7th (or 6th) — the notes that carry a chord's identity and the
 * ones a soloist lands on to spell the changes.
 */
export function guideTones(chord) {
  if (!chord) return []
  return chordNotes(chord)
    .filter((e) => [3, 7, 6, 2, 4].includes(e.degree))
    .filter((e, i, all) => {
      // Prefer the 3rd/7th; only fall back to sus 2nds/4ths and 6ths.
      const hasThird = all.some((x) => x.degree === 3)
      if (hasThird && (e.degree === 2 || e.degree === 4)) return false
      const hasSeventh = all.some((x) => x.degree === 7)
      if (hasSeventh && e.degree === 6) return false
      return true
    })
}

/** Pitch classes shared by two chords — the notes you can hold through a change. */
export function commonTones(a, b) {
  if (!a || !b) return []
  const setB = new Set(chordNotes(b).map((e) => pcOf(e.note)))
  return chordNotes(a)
    .filter((e) => setB.has(pcOf(e.note)))
    .filter((e, i, arr) => arr.findIndex((x) => pcOf(x.note) === pcOf(e.note)) === i)
}
