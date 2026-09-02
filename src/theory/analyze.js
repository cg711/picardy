// Reading a progression back: what the chords are doing, and where.

import { mod, pcOf, prettyName } from './notes.js'
import { QUALITIES, chordSymbol, chordNotes, inversionCount } from './chords.js'
import { romanNumeral, harmonicFunction, isDiatonic, detectKey, keyName, scalePcs } from './keys.js'

/**
 * Named cadence patterns, tested against the last chords of a phrase.
 *
 * First match wins, so the order is load-bearing: every pattern must sit above
 * the looser one it refines, or it can never fire. iv–I also satisfies the plain
 * IV–I test, ♭VII7–i also satisfies the Aeolian test, and *any* arrival on V
 * satisfies the half-cadence test — so minor plagal, backdoor and Phrygian half
 * each have to come first.
 */
const CADENCES = [
  {
    id: 'perfect', label: 'perfect authentic cadence',
    test: (a, b, key) => degreeOf(a, key) === 7 && isDominant(a) && degreeOf(b, key) === 0,
    why: 'V7 falling to the tonic, with the leading tone resolving upward — the strongest ending there is.',
  },
  {
    id: 'authentic', label: 'authentic cadence',
    test: (a, b, key) => degreeOf(a, key) === 7 && degreeOf(b, key) === 0,
    why: 'V to I. Conclusive, though a plain triad lands softer than a dominant seventh.',
  },
  {
    id: 'minorPlagal', label: 'minor plagal cadence',
    test: (a, b, key) => degreeOf(a, key) === 5 && isMinorish(a) && degreeOf(b, key) === 0,
    why: 'iv to I, borrowed from the parallel minor. The ♭6 falls a half step into the tonic chord.',
  },
  {
    id: 'plagal', label: 'plagal cadence',
    test: (a, b, key) => degreeOf(a, key) === 5 && degreeOf(b, key) === 0,
    why: 'IV to I — the "amen" ending. No leading tone, so it settles rather than resolves.',
  },
  {
    id: 'deceptive', label: 'deceptive cadence',
    test: (a, b, key) => degreeOf(a, key) === 7 && isDominant(a) && [9, 8].includes(degreeOf(b, key)),
    why: 'The dominant sets up the tonic and then sidesteps it, which keeps the phrase open.',
  },
  {
    id: 'backdoor', label: 'backdoor cadence',
    test: (a, b, key) => degreeOf(a, key) === 10 && isDominant(a) && degreeOf(b, key) === 0,
    why: '♭VII7 approaching the tonic from the flat side, its ♭7 falling into the tonic\'s third.',
  },
  {
    id: 'aeolian', label: 'Aeolian cadence',
    test: (a, b, key) => degreeOf(a, key) === 10 && degreeOf(b, key) === 0 && key.mode === 'minor',
    why: '♭VII stepping down to the tonic. Modal rather than functional — no leading tone anywhere.',
  },
  {
    id: 'phrygianHalf', label: 'Phrygian half cadence',
    test: (a, b, key) => degreeOf(a, key) === 5 && isMinorish(a) && degreeOf(b, key) === 7 && key.mode === 'minor',
    why: 'iv to V in minor, with ♭6 falling a half step to the dominant.',
  },
  {
    id: 'half', label: 'half cadence',
    test: (a, b, key) => degreeOf(b, key) === 7,
    why: 'The phrase rests on the dominant instead of resolving — it expects an answer.',
  },
]

/** Every cadence this engine can name — the pool the exercises draw wrong answers from. */
export const CADENCE_LABELS = CADENCES.map((c) => c.label)

/**
 * Is this numeral an applied chord?
 *
 * Both notations use a slash and they mean opposite things: an applied chord's
 * slash is followed by a roman numeral (V7/ii — a dominant borrowed to point at
 * the supertonic), a figured bass's by a digit (V 6/5 — a dominant seventh in
 * first inversion). Testing for the slash alone was safe only while these
 * numerals carried no figures; it is not any more.
 */
const isApplied = (roman) => /\/[ivIV]/.test(roman)

const degreeOf = (chord, key) => mod(pcOf(chord.root) - pcOf(key.tonic), 12)
const isDominant = (chord) => QUALITIES[chord.qualityId]?.family === 'dom'
const isMinorish = (chord) => ['minor', 'dim'].includes(QUALITIES[chord.qualityId]?.family)

/**
 * The cadential 6/4: a tonic triad over the dominant in the bass, moving to V.
 *
 * This one needs its own detector because it is the case where the vertical
 * reading and the functional reading disagree. Spelled out, the chord is a
 * tonic triad. Heard, it is an ornamented dominant — the 6th and 4th above a
 * stationary bass are dissonances that fall to the 5th and 3rd, and the bass
 * never moves. Aldwell & Schachter give it a whole unit and notate it under V;
 * Picardy's own suggestion engine already describes it that way, while
 * harmonicFunction — which sees one chord and no context — called it a tonic.
 *
 * Deliberately narrow. A 6/4 can also be passing or a pedal, and those are
 * different chords doing different jobs, so this matches only the cadential
 * figure: tonic triad, second inversion, resolving to a root-position V on the
 * same bass note. Anything looser would start relabelling chords that are
 * genuinely tonic.
 *
 * Needs inversions, so it returns null when the caller has none — an import
 * with no voicing information gets the old reading rather than a guess.
 */
export function cadentialSixFour(progression, index, key, inversions) {
  if (!key || !inversions) return null
  const chord = progression[index]
  const next = progression[index + 1]
  if (!chord || !next) return null

  // A triad built on the tonic. Sevenths and sus chords are not this figure.
  const family = QUALITIES[chord.qualityId]?.family
  if (family !== 'major' && family !== 'minor') return null
  if (inversionCount(chord) !== 3) return null
  if (degreeOf(chord, key) !== 0) return null

  // Second inversion is what puts 5̂ in the bass.
  if (mod(inversions[index] ?? 0, 3) !== 2) return null

  // Resolving to a dominant that holds that same bass note.
  if (degreeOf(next, key) !== 7) return null
  if ((inversions[index + 1] ?? 0) !== 0) return null

  return {
    id: 'cadential64',
    label: 'cadential 6/4',
    readAs: 'V 6/4',
    why: 'The tonic triad over the dominant in the bass — heard as an ornamented V, not a real tonic. The 6th and 4th above the held bass fall to the 5th and 3rd.',
  }
}

/** The cadence formed by the last two chords, if any. */
export function cadenceAt(progression, index, key) {
  const a = progression[index - 1]
  const b = progression[index]
  if (!a || !b) return null
  for (const cadence of CADENCES) {
    if (cadence.test(a, b, key)) return cadence
  }
  return null
}

/**
 * Per-chord annotations plus prose observations about the whole progression.
 *
 * @returns { key, chords: [...], observations: [...] }
 */
export function analyseProgression(progression, keyOverride = null, inversions = null) {
  if (!progression.length) return { key: null, chords: [], observations: [] }
  const key = keyOverride ?? detectKey(progression)
  const scale = new Set(scalePcs(key))
  // A minor key's raised 7th is part of its normal vocabulary, not borrowed
  // colour — without this every V7 in minor gets reported as chromatic.
  if (key.mode === 'minor') scale.add(mod(pcOf(key.tonic) + 11, 12))

  const chords = progression.map((chord, i) => {
    const diatonic = isDiatonic(chord, key)
    const outside = chordNotes(chord)
      .filter((e) => !scale.has(pcOf(e.note)))
      .map((e) => prettyName(e.note))
    // With inversions in hand the numeral carries its figured bass, which is
    // what the progression chips have always shown. Without them this panel
    // said "I" while the chip beside it said "I 6/4".
    const roman = romanNumeral(chord, key, inversions?.[i] ?? 0)
    const sixFour = cadentialSixFour(progression, i, key, inversions)
    return {
      index: i,
      symbol: chordSymbol(chord),
      roman,
      // The one place a chord's function depends on what follows it. Everywhere
      // else harmonicFunction is right; here it is looking at a tonic triad and
      // cannot see the dominant holding underneath it.
      fn: sixFour ? 'D' : harmonicFunction(chord, key),
      sixFour: sixFour ? sixFour.label : null,
      readAs: sixFour ? sixFour.readAs : null,
      diatonic,
      outside: [...new Set(outside)],
      applied: isApplied(roman) && !roman.includes('♭') && /^(V|vii)/.test(roman),
    }
  })

  const observations = []
  const note = (kind, text) => observations.push({ kind, text })

  // --- cadence at the end -----------------------------------------------------
  const ending = cadenceAt(progression, progression.length - 1, key)
  if (ending) {
    // "a authentic cadence" — two of the nine labels start with a vowel.
    const article = /^[aeiou]/i.test(ending.label) ? 'an' : 'a'
    note('cadence', `Ends on ${article} ${ending.label}: ${chords[chords.length - 2].roman} to ${chords[chords.length - 1].roman}. ${ending.why}`)
  } else if (progression.length > 1) {
    note('cadence', `The last move, ${chords[chords.length - 2].roman} to ${chords[chords.length - 1].roman}, is not one of the standard cadences — the phrase stops rather than closes.`)
  }

  // --- cadential 6/4 -----------------------------------------------------------
  // Reported wherever it appears, not only at the end: it is the standard way
  // of arriving at a dominant and it turns up mid-phrase as often as at a close.
  for (const c of chords.filter((c) => c.sixFour)) {
    const next = chords[c.index + 1]
    note('six-four', `${c.symbol} at ${c.roman} is a ${c.sixFour} — read it as ${c.readAs}, an ornamented ${next.roman}, rather than as a tonic. The bass is already on the dominant and stays there; the 6th and 4th above it are dissonances that fall to the 5th and 3rd.`)
  }

  // --- ii-V pairs --------------------------------------------------------------
  for (let i = 1; i < progression.length; i++) {
    const a = progression[i - 1]
    const b = progression[i]
    const gap = mod(pcOf(b.root) - pcOf(a.root), 12)
    if (gap !== 5) continue
    if (!isMinorish(a) || !isDominant(b)) continue
    const target = progression[i + 1]
    const resolves = target && mod(pcOf(target.root) - pcOf(b.root), 12) === 5
    note('ii-V', resolves
      ? `${chords[i - 1].roman}–${chords[i].roman}–${chords[i + 1].roman} is a complete ii–V–I aimed at ${chordSymbol(target)}.`
      : `${chords[i - 1].roman}–${chords[i].roman} is a ii–V, though it does not resolve where it points.`)
  }

  // --- tonicisation ------------------------------------------------------------
  const applied = chords.filter((c) => /^(V|vii)/.test(c.roman) && isApplied(c.roman))
  if (applied.length) {
    note('tonicisation', applied.length === 1
      ? `${applied[0].symbol} is an applied chord (${applied[0].roman}) — it borrows a dominant to point at a chord that is not the tonic.`
      : `${applied.length} applied chords (${applied.map((c) => c.roman).join(', ')}) briefly tonicise other degrees without leaving the key.`)
  }

  // --- borrowed colour ---------------------------------------------------------
  // `outside` is measured against the key's full vocabulary, so a minor-key V7
  // has nothing outside it even though it is not strictly diatonic.
  const borrowed = chords.filter((c) => c.outside.length && !/\//.test(c.roman))
  if (borrowed.length) {
    note('mixture', `${borrowed.map((c) => c.roman).join(', ')} ${borrowed.length === 1 ? 'is' : 'are'} outside the key — ${borrowed.length === 1 ? 'it brings' : 'they bring'} in ${[...new Set(borrowed.flatMap((c) => c.outside))].join(', ')}.`)
  }

  // --- root motion -------------------------------------------------------------
  const motions = []
  for (let i = 1; i < progression.length; i++) {
    motions.push(mod(pcOf(progression[i].root) - pcOf(progression[i - 1].root), 12))
  }
  const fifths = motions.filter((m) => m === 5).length
  if (motions.length && fifths / motions.length >= 0.6) {
    note('motion', `${fifths} of ${motions.length} changes fall by a fifth, so the progression is driven by the circle of fifths.`)
  }
  const steps = motions.filter((m) => m === 2 || m === 10).length
  if (motions.length && steps / motions.length >= 0.6) {
    note('motion', 'The roots mostly move by step, which gives a scalar, marching feel rather than a functional pull.')
  }

  // --- shape -------------------------------------------------------------------
  // Compare the numeral itself, not the quality suffix: "Imaj7" still opens on
  // the tonic.
  const numeralOf = (roman) => (roman.match(/^[♭♯]*[IiVv]+/) ?? [''])[0]
  // A cadential 6/4 spells the tonic but is not one, so a progression opening on
  // it does not establish the key — it opens on the dominant, like everything
  // else in this file now reads it.
  if (!chords[0].sixFour && ['I', 'i'].includes(numeralOf(chords[0].roman))) {
    note('shape', 'It opens on the tonic, so the key is established immediately.')
  } else {
    note('shape', chords[0].sixFour
      ? `It opens on ${chords[0].roman}, which is a ${chords[0].sixFour} rather than a tonic — the phrase starts on the dominant.`
      : `It opens on ${chords[0].roman} rather than the tonic, which delays settling into the key.`)
  }

  const allDiatonic = chords.every((c) => c.diatonic)
  if (allDiatonic) note('palette', 'Every chord is diatonic — nothing borrowed, nothing applied.')

  return { key, keyName: keyName(key), chords, observations }
}
