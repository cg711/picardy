// Keys, scales, and roman-numeral analysis.

import { mod, pcOf, spellFrom, noteName, prettyName, parseNote, normAcc } from './notes.js'
import { QUALITIES, chordNotes } from './chords.js'

export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
export const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]
export const HARMONIC_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 11]
export const MELODIC_MINOR_STEPS = [0, 2, 3, 5, 7, 9, 11]

export function makeKey(tonicName, mode = 'major') {
  const tonic = parseNote(tonicName)
  if (!tonic) return null
  return { tonic, mode }
}

export function keyName(key) {
  return `${prettyName(key.tonic)} ${key.mode}`
}

export function keySteps(key) {
  return key.mode === 'minor' ? NATURAL_MINOR_STEPS : MAJOR_STEPS
}

/** The seven spelled scale degrees of the key. */
export function scaleNotes(key) {
  const steps = keySteps(key)
  return steps.map((semi, i) => spellFrom(key.tonic, i + 1, semi))
}

export function scalePcs(key) {
  return scaleNotes(key).map(pcOf)
}

/** Does this key signature lean flat? Drives enharmonic spelling choices. */
export function prefersFlats(key) {
  const notes = scaleNotes(key)
  const flats = notes.filter((n) => n.acc < 0).length
  const sharps = notes.filter((n) => n.acc > 0).length
  return flats > sharps
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

const DIATONIC_TRIADS = {
  major: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
}

/**
 * Degree index and accidental prefix for a numeral. The accidental is always
 * measured against the *major* scale, which is why a minor key shows
 * ♭III / ♭VI / ♭VII the way textbooks write them.
 */
function numeralPrefix(rootNote, key) {
  const degIdx = mod(rootNote.letter - key.tonic.letter, 7)
  const actual = mod(pcOf(rootNote) - pcOf(key.tonic), 12)
  const diff = normAcc(actual - MAJOR_STEPS[degIdx])
  return {
    degIdx,
    prefix: diff === 0 ? '' : diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff),
  }
}

/** Roman numeral of the plain diatonic chord on a scale degree: "vi", "♭VII". */
function diatonicRomanAt(key, semitonesAboveTonic) {
  const steps = keySteps(key)
  const i = steps.indexOf(mod(semitonesAboveTonic, 12))
  if (i < 0) return null
  const note = spellFrom(key.tonic, i + 1, steps[i])
  const { prefix, degIdx } = numeralPrefix(note, key)
  const quality = DIATONIC_TRIADS[key.mode][i]
  const numeral = quality === 'maj' ? ROMAN[degIdx] : ROMAN[degIdx].toLowerCase()
  return prefix + numeral + (quality === 'dim' ? '°' : '')
}

/**
 * If the chord is an applied dominant or applied leading-tone chord, name it
 * that way ("V7/V") instead of by its raw scale degree ("II7").
 */
function appliedLabel(chord, key) {
  const q = QUALITIES[chord.qualityId]
  const deg = mod(pcOf(chord.root) - pcOf(key.tonic), 12)

  // A plain major triad in a minor key is far more likely to be borrowed colour
  // (IV dorian, II, ♭II) than an applied dominant, so only real dominant
  // sevenths get the "V7/x" reading there.
  const plainTriad = q.family === 'major' && ['maj', 'six', 'add9'].includes(chord.qualityId)
  const dominantish = q.family === 'dom' || (plainTriad && key.mode === 'major')
  if (dominantish) {
    const targetSemi = mod(deg + 5, 12)
    if (targetSemi === 0) return null // that is simply V of the key
    const target = diatonicRomanAt(key, targetSemi)
    if (!target || target.endsWith('°')) return null
    const suffix = {
      dom7: '7', dom9: '9', dom11: '11', dom13: '13', sevenAlt: '7alt', sevenSus4: '7sus4',
    }[chord.qualityId] ?? ''
    return `V${suffix}${chord.altLabels?.join('') ?? ''}/${target}`
  }

  // A half-diminished chord away from home is almost always the ii of a minor
  // ii–V rather than a leading-tone chord, so try that reading first: ii of X
  // sits a whole step above X.
  if (chord.qualityId === 'm7b5') {
    const asTwo = diatonicRomanAt(key, mod(deg - 2, 12))
    if (asTwo && !asTwo.endsWith('°')) return `iiø7/${asTwo}`
  }

  if (['dim7', 'm7b5', 'dim'].includes(chord.qualityId)) {
    const targetSemi = mod(deg + 1, 12)
    if (targetSemi === 0) return null // that is vii° of the key itself
    const target = diatonicRomanAt(key, targetSemi)
    if (!target || target.endsWith('°')) return null
    const sym = chord.qualityId === 'm7b5' ? 'viiø7' : chord.qualityId === 'dim7' ? 'vii°7' : 'vii°'
    return `${sym}/${target}`
  }
  return null
}

/**
 * Roman numeral for a chord in a key: scale degree from the letter, accidental
 * from the pitch, case and suffix from the chord quality.
 */
export function romanNumeral(chord, key, inversion = 0) {
  if (!chord) return ''
  if (chord.poly) {
    // Two stacked numerals separated by a slash would read as a figured bass or
    // an applied chord; the bar keeps the two layers visually distinct.
    const lower = romanNumeral(chord.poly.lower, key)
    const upper = romanNumeral(chord.poly.upper, key)
    return `${upper} | ${lower}`
  }

  const q = QUALITIES[chord.qualityId]
  const { degIdx, prefix } = numeralPrefix(chord.root, key)

  // Work out which chord tone is in the bass, whether it got there through an
  // inversion setting or through an explicit slash bass, and render the
  // figured-bass shorthand for it. A bass note that is not a chord tone (a real
  // pedal or polychord bass) keeps the slash-name form instead.
  const notes = chordNotes(chord)
  const n = notes.length
  let inv = n ? mod(inversion, n) : 0
  let fig = ''
  if (chord.bass) {
    const idx = notes.findIndex((e) => pcOf(e.note) === pcOf(chord.bass))
    if (idx >= 0) inv = idx
    else fig = '/' + prettyName(chord.bass)
  }
  if (!fig && inv > 0) {
    fig = n <= 3 ? ['', '6', '6/4'][inv] ?? '' : ['', '6/5', '4/3', '4/2'][inv] ?? ''
  }
  const figured = fig ? (fig.startsWith('/') ? fig : ` ${fig}`) : ''

  // Augmented sixths are named by their type, not by a scale-degree numeral.
  if (q.family === 'aug6') return q.roman + figured

  if (!isDiatonic(chord, key)) {
    const applied = appliedLabel(chord, key)
    if (applied) return applied + figured
  }

  const minorish = q.family === 'minor' || q.family === 'dim'
  const numeral = minorish ? ROMAN[degIdx].toLowerCase() : ROMAN[degIdx]
  return prefix + numeral + romanSuffix(chord) + figured
}

function romanSuffix(chord) {
  const map = {
    maj: '',
    min: '',
    dim: '°',
    aug: '+',
    sus2: 'sus2',
    sus4: 'sus4',
    five: '5',
    six: '6',
    m6: '6',
    sixNine: '6/9',
    m69: '6/9',
    maj7: 'maj7',
    dom7: '7',
    m7: '7',
    mMaj7: 'maj7',
    m7b5: 'ø7',
    dim7: '°7',
    sevenSus4: '7sus4',
    add9: 'add9',
    madd9: 'add9',
    add11: 'add11',
    maj9: 'maj9',
    dom9: '9',
    m9: '9',
    maj11: 'maj9♯11',
    dom11: '11',
    m11: '11',
    dom13: '13',
    maj13: 'maj13',
    m13: '13',
    sevenAlt: '7alt',
  }
  return (map[chord.qualityId] ?? '') + (chord.altLabels?.join('') ?? '')
}

/** Tonic / predominant / dominant bucket, used by the transition scorer. */
export function harmonicFunction(chord, key) {
  const deg = mod(pcOf(chord.root) - pcOf(key.tonic), 12)
  const q = QUALITIES[chord.qualityId]
  const major = key.mode === 'major'

  // Any dominant seventh is dominant-functioning, whether it is the key's own V
  // or an applied dominant borrowed for one chord. Same for a fully diminished
  // seventh, which is a rootless dominant ♭9.
  if (q.family === 'dom' || chord.qualityId === 'dim7') return 'D'
  if (q.family === 'aug6') return 'PD'
  if (deg === 0) return 'T'
  if (deg === (major ? 4 : 3)) return 'T' // iii / bIII
  if (deg === 9 && major) return 'T' // vi
  if (deg === 8 && !major) return 'T' // bVI in minor
  if (deg === 2 || deg === 5) return 'PD' // ii / IV
  if (deg === 7 || deg === 11 || deg === 10) return 'D'
  return 'PD'
}

/** Degree index 0..11 above the tonic. */
export function degreeFromTonic(note, key) {
  return mod(pcOf(note) - pcOf(key.tonic), 12)
}

/** Spell a note a given number of semitones above the tonic, in-key where possible. */
export function spellDegree(key, semitonesAboveTonic, preferredGeneric) {
  const steps = keySteps(key)
  if (preferredGeneric) {
    return spellFrom(key.tonic, preferredGeneric, semitonesAboveTonic)
  }
  const idx = steps.indexOf(mod(semitonesAboveTonic, 12))
  if (idx >= 0) return spellFrom(key.tonic, idx + 1, semitonesAboveTonic)
  // Chromatic: prefer a flat spelling below a scale tone, sharp above.
  const flatGeneric = steps.findIndex((s) => mod(s - semitonesAboveTonic, 12) === 1)
  if (flatGeneric >= 0) return spellFrom(key.tonic, flatGeneric + 1, semitonesAboveTonic)
  const sharpGeneric = steps.findIndex((s) => mod(semitonesAboveTonic - s, 12) === 1)
  if (sharpGeneric >= 0) return spellFrom(key.tonic, sharpGeneric + 1, semitonesAboveTonic)
  return spellFrom(key.tonic, 1, semitonesAboveTonic)
}

export const KEY_CHOICES = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
]

/** Are all of the chord's pitch classes inside the key? */
export function isDiatonic(chord, key) {
  const scale = new Set(scalePcs(key))
  return chordNotes(chord).every((e) => scale.has(pcOf(e.note)))
}

/**
 * Guess the key of a progression: reward chords that fit the scale, the first
 * and last chords landing on the tonic, and the presence of a real dominant.
 */
export function detectKey(progression) {
  if (!progression.length) return null
  let best = null
  for (const tonicName of KEY_CHOICES) {
    for (const mode of ['major', 'minor']) {
      const key = makeKey(tonicName, mode)
      if (!key) continue
      const scale = new Set(scalePcs(key))
      const tonicPc = pcOf(key.tonic)
      let score = 0
      progression.forEach((chord, i) => {
        const notes = chordNotes(chord)
        const fit = notes.filter((e) => scale.has(pcOf(e.note))).length / notes.length
        const weight = i === progression.length - 1 ? 1.6 : i === 0 ? 1.3 : 1
        score += fit * 3 * weight
        const deg = mod(pcOf(chord.root) - tonicPc, 12)
        const family = QUALITIES[chord.qualityId].family
        if (deg === 0) {
          // A tonic chord should agree with the mode: major I in major, minor i in minor.
          const agrees = mode === 'minor' ? family === 'minor' : family === 'major' || family === 'dom'
          score += weight * (agrees ? 2.4 : 0.4)
        }
        if (deg === 7 && family === 'dom') score += 2.4
        // Ending on the dominant is a half cadence, and it points at the key
        // far more clearly than the same chord would mid-phrase.
        if (i === progression.length - 1 && deg === 7) score += 1.8
        // The raised 7th of harmonic minor is strong evidence for a minor key.
        if (deg === 7 && mode === 'minor' && (family === 'major' || family === 'dom')) score += 2.0
        if (deg === 11 && mode === 'minor' && family === 'dim') score += 1.5
      })
      // Prefer simpler key signatures when two keys are otherwise tied.
      score -= scaleNotes(key).filter((n) => Math.abs(n.acc) > 1).length * 2
      score -= scaleNotes(key).filter((n) => n.acc !== 0).length * 0.08
      if (!best || score > best.score) best = { key, score }
    }
  }
  return best?.key ?? null
}

export function keySignatureAccidentals(key) {
  return scaleNotes(key).filter((n) => n.acc !== 0).map(noteName)
}
