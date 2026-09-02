// Keys, scales, and roman-numeral analysis.

import { mod, pcOf, spellFrom, noteName, prettyName, parseNote, normAcc, pcName, LETTERS } from './notes.js'
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

/**
 * The Nashville number system: the same reading, written the way session
 * players read it.
 *
 * Arabic numerals rather than roman, and quality written as a suffix rather
 * than carried by the case — a minor chord is `6m`, not `vi`, because a chart
 * scribbled on the back of an envelope cannot rely on anyone noticing case.
 * Derived from romanNumeral rather than computed again, so the two readings
 * cannot disagree about what a chord is; only about how to write it down.
 */
const ROMAN_TO_NUMBER = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 }

/** The numeral in whichever notation the reader has asked for. */
export function numeralFor(chord, key, inversion = 0, style = 'roman') {
  return style === 'nashville'
    ? nashvilleNumber(chord, key, inversion)
    : romanNumeral(chord, key, inversion)
}

export function nashvilleNumber(chord, key, inversion = 0) {
  const roman = romanNumeral(chord, key, inversion)
  if (!roman) return ''
  // Applied chords keep their slash, and each side is converted on its own.
  if (/\/[ivIV]/.test(roman)) {
    const [before, after] = roman.split(/\/(?=[ivIV])/)
    return `${toNashville(before)}/${toNashville(after)}`
  }
  return toNashville(roman)
}

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
const raise = (s) => s.replace(/\d/g, (d) => SUPERSCRIPT[d])

function toNashville(roman) {
  const m = roman.match(/^([♭♯]*)([IiVv]+)(.*)$/)
  if (!m) return roman
  const [, accidental, numeral, rest] = m
  const degree = ROMAN_TO_NUMBER[numeral.toUpperCase()]
  if (!degree) return roman
  const minor = numeral === numeral.toLowerCase()
  // The case has to become a letter, or it is lost. A diminished or
  // half-diminished chord already carries its own mark and does not also need
  // an "m" — ° and ø say minor third louder than the case did.
  const quality = minor && !/^[°ø]/.test(rest) ? 'm' : ''

  // The extension is raised, which is not decoration: written flat, a dominant
  // seventh on the fifth degree comes out "57" and reads as fifty-seven. Full
  // size means degree, raised means extension. Figured bass — which arrives
  // after a space — is left alone, because those digits are intervals above the
  // bass and belong at full size.
  const space = rest.indexOf(' ')
  const suffix = space >= 0 ? rest.slice(0, space) : rest
  const figured = space >= 0 ? rest.slice(space) : ''
  return `${accidental}${degree}${quality}${raise(suffix)}${figured}`
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
 * Every key worth considering, precomputed.
 *
 * Order is load-bearing: ties are broken by whichever key is reached first, so
 * this must stay tonic-outer / major-before-minor the way detectKey originally
 * looped, or two equally good keys swap places.
 */
let CANDIDATES = null
function candidateKeys() {
  if (CANDIDATES) return CANDIDATES
  CANDIDATES = []
  for (const tonicName of KEY_CHOICES) {
    for (const mode of ['major', 'minor']) {
      const key = makeKey(tonicName, mode)
      if (!key) continue
      const notes = scaleNotes(key)
      CANDIDATES.push({
        key,
        scale: new Set(scalePcs(key)),
        tonicPc: pcOf(key.tonic),
        mode,
        doubles: notes.filter((n) => Math.abs(n.acc) > 1).length,
        accidentals: notes.filter((n) => n.acc !== 0).length,
      })
    }
  }
  return CANDIDATES
}

/**
 * How strongly one chord points at one key.
 *
 * Factored out of detectKey so that the whole-progression guess and the
 * segmenter below score chords the same way by construction. Two functions each
 * with their own idea of what fits a key would disagree eventually, and the
 * disagreement would show up as an area boundary the detected key contradicts.
 */
function chordKeyScore(chord, ctx, weight = 1, isLast = false, domWeight = 1) {
  const notes = chordNotes(chord)
  const fit = notes.filter((e) => ctx.scale.has(pcOf(e.note))).length / notes.length
  let score = fit * 3 * weight
  const deg = mod(pcOf(chord.root) - ctx.tonicPc, 12)
  const family = QUALITIES[chord.qualityId].family
  if (deg === 0) {
    // A tonic chord should agree with the mode: major I in major, minor i in minor.
    const agrees = ctx.mode === 'minor' ? family === 'minor' : family === 'major' || family === 'dom'
    score += weight * (agrees ? 2.4 : 0.4)
  }
  if (deg === 7 && family === 'dom') score += 2.4 * domWeight
  // Ending on the dominant is a half cadence, and it points at the key
  // far more clearly than the same chord would mid-phrase.
  if (isLast && deg === 7) score += 1.8
  // The raised 7th of harmonic minor is strong evidence for a minor key.
  if (deg === 7 && ctx.mode === 'minor' && (family === 'major' || family === 'dom')) {
    score += 2.0 * (family === 'dom' ? domWeight : 1)
  }
  if (deg === 11 && ctx.mode === 'minor' && family === 'dim') score += 1.5
  return score
}

/**
 * How much "this chord is a dominant seventh" is worth as evidence of a key.
 *
 * Normally a great deal: a dominant seventh resolves down a fifth, so it names
 * its key. In a blues it names nothing, because every chord is one — the ♭7 is
 * the style's default colour rather than a tension, which is the whole argument
 * of the twelve-bar lesson. Left undamped, each of a blues's tonic sevenths
 * reads as the dominant of the key a fourth above, and a plain twelve-bar came
 * back split between two keys neither of which it is in.
 *
 * The measurement separates cleanly on real material: every backing preset and
 * every test progression sits at or below 0.4 except the blues, which is 1.0.
 */
function dominantEvidenceWeight(progression) {
  if (!progression.length) return 1
  const dom = progression.filter((c) => QUALITIES[c.qualityId]?.family === 'dom').length
  const ratio = dom / progression.length
  if (ratio <= 0.5) return 1
  if (ratio >= 0.9) return 0
  return (0.9 - ratio) / 0.4
}

/**
 * Guess the key of a progression: reward chords that fit the scale, the first
 * and last chords landing on the tonic, and the presence of a real dominant.
 */
export function detectKey(progression) {
  if (!progression.length) return null
  const domWeight = dominantEvidenceWeight(progression)
  let best = null
  for (const ctx of candidateKeys()) {
    let score = 0
    progression.forEach((chord, i) => {
      const isLast = i === progression.length - 1
      const weight = isLast ? 1.6 : i === 0 ? 1.3 : 1
      score += chordKeyScore(chord, ctx, weight, isLast, domWeight)
    })
    // Prefer simpler key signatures when two keys are otherwise tied.
    score -= ctx.doubles * 2
    score -= ctx.accidentals * 0.08
    if (!best || score > best.score) best = { key: ctx.key, score }
  }
  return best?.key ?? null
}

/**
 * What it costs to change key, in the same units chordKeyScore returns.
 *
 * This single number is the whole tonicisation/modulation distinction, which is
 * the thing the book spends two units on. A secondary dominant fits its target
 * key far better than the home key — A7 in C major has a C♯ in it, and in D
 * minor it is the dominant — so on per-chord fit alone the cheapest reading of
 * C–A7–Dm–G7–C flips to D minor for one chord and back. Leaving and returning
 * pays this penalty twice, which one chord's better fit cannot cover; four bars
 * of a new key cover it easily. That is exactly the distinction Aldwell &
 * Schachter draw, and it falls out of the arithmetic rather than needing a
 * special case.
 */
const KEY_SWITCH_COST = 3.5

/**
 * The shortest run of chords that counts as a key area.
 *
 * This is the load-bearing half of the tonicisation/modulation distinction, and
 * the switch cost alone could not carry it: no value of that cost separates
 * C–A7–Dm–G7–C (an applied dominant, one key) from a real modulation, because
 * A7–Dm genuinely is a V7–i in D minor. What tells them apart is that the music
 * does not *stay*. Requiring a key area to last makes "briefly" mean something,
 * and it is the same criterion the book uses when it separates tonicisation
 * from modulation.
 *
 * Three is deliberately conservative. Missing a short modulation leaves the old
 * single-key reading, which is merely incomplete; splitting a tonicisation into
 * two keys actively misreports ordinary harmony, which is worse.
 */
const MIN_KEY_AREA = 3

/**
 * A nudge toward the key the user actually set, per chord.
 *
 * Small on purpose. Respecting the setting is handled properly in
 * analyseProgression, which uses it outright whenever nothing modulates; all
 * this has left to do is break ties among the areas when something does. At
 * 0.7 it was doing more than that — enough to hide a modulation from A minor
 * to its relative major, where the two keys share all seven notes and a
 * per-chord thumb on the scale decides the whole question.
 */
const HOME_KEY_BONUS = 0.3

/**
 * Split a progression into key areas.
 *
 * detectKey answers "what key is this in", which is the wrong question for
 * anything that modulates: forcing one key on a progression that moves does not
 * merely miss the modulation, it reports the opening as a string of errors. A
 * phrase in C that moves to G was being read wholly in G, which made its tonic
 * chord a IV and its F natural a borrowed ♭VII.
 *
 * Solved as a shortest path rather than a sliding window, because the question
 * is global: whether a chord belongs to a new key depends on how long the new
 * key lasts, which a window centred on that chord cannot see. Each chord scores
 * against all thirty candidate keys, staying is free, switching costs
 * KEY_SWITCH_COST, and the best path through is the segmentation. O(n × 30).
 *
 * @returns [{ start, end, key }] — `end` exclusive, contiguous, covering
 *          every chord. A progression that does not modulate returns one area.
 */
export function detectKeyAreas(progression, homeKey = null, { switchCost = KEY_SWITCH_COST } = {}) {
  if (!progression.length) return []
  const ctxs = candidateKeys()
  const K = ctxs.length
  const n = progression.length
  const homePc = homeKey ? pcOf(homeKey.tonic) : null

  // Per-chord score against every key. The key-signature preferences that
  // detectKey applies once per progression are applied once per chord here,
  // which is their equivalent when the spans being compared are the same
  // length — as they are for every pair of paths through this lattice.
  const domWeight = dominantEvidenceWeight(progression)
  const emit = progression.map((chord) =>
    ctxs.map((ctx) => {
      let s = chordKeyScore(chord, ctx, 1, false, domWeight)
      s -= ctx.doubles * 0.5
      s -= ctx.accidentals * 0.05
      if (homePc !== null && ctx.tonicPc === homePc && ctx.mode === homeKey.mode) s += HOME_KEY_BONUS
      return s
    }),
  )

  // Running totals per key, so the score of any span is one subtraction.
  const sum = ctxs.map((_, k) => {
    const acc = new Float64Array(n + 1)
    for (let i = 0; i < n; i++) acc[i + 1] = acc[i] + emit[i][k]
    return acc
  })

  // What the progression's own first and last chords are worth *extra*.
  //
  // detectKey leans on where a chord sits — the first and last carry more, and
  // a final chord on the dominant more again — and dropping that here was a
  // bug, not a simplification: a key and its relative share all seven notes, so
  // position is the only thing telling them apart, and without it ten backing
  // presets came back in the relative minor of the key detectKey reports.
  //
  // These attach to the ends of the *progression*, not of every area. Paying
  // them at each area's edges looked more principled and was much worse: an
  // extra area then earns a fresh pair of bonuses, which is a standing bribe to
  // split, and the segmenter took it — a plain twelve-bar blues came back in
  // three keys. Scoped this way, a one-area reading scores exactly what
  // detectKey scores, which is the property the panel needs.
  const openBonus = ctxs.map((ctx) =>
    chordKeyScore(progression[0], ctx, 1.3, false, domWeight) - chordKeyScore(progression[0], ctx, 1, false, domWeight))
  const last = progression[n - 1]
  const closeBonus = ctxs.map((ctx) =>
    chordKeyScore(last, ctx, 1.6, true, domWeight) - chordKeyScore(last, ctx, 1, false, domWeight))
  const spanScore = (j, i, k) =>
    sum[k][i] - sum[k][j] + (j === 0 ? openBonus[k] : 0) + (i === n ? closeBonus[k] : 0)

  // Anything too short to hold two key areas is one area, by definition.
  if (n < MIN_KEY_AREA * 2) {
    let only = 0
    let total = -Infinity
    for (let k = 0; k < K; k++) {
      const s = spanScore(0, n, k)
      if (s > total) { total = s; only = k }
    }
    return [{ start: 0, end: n, key: ctxs[only].key }]
  }

  // best[i][k]: the best reading of the first i chords whose final area ends at
  // i and is in key k. Segment-wise rather than chord-wise, because the minimum
  // length is a property of a segment and a chord-by-chord walk cannot enforce
  // it without carrying "how long have I been here" through every state.
  const best = Array.from({ length: n + 1 }, () => new Float64Array(K).fill(-Infinity))
  const fromAt = Array.from({ length: n + 1 }, () => new Int32Array(K).fill(-1))
  const fromKey = Array.from({ length: n + 1 }, () => new Int32Array(K).fill(-1))

  // Cached best-and-runner-up over each row, so scoring a switch into key k is
  // O(1): it comes from whichever other key read best up to that point.
  const bestAt = new Array(n + 1).fill(null)
  const rank = (i) => {
    if (bestAt[i]) return bestAt[i]
    let b1 = -Infinity; let b1k = -1; let b2 = -Infinity; let b2k = -1
    for (let k = 0; k < K; k++) {
      const v = best[i][k]
      if (v > b1) { b2 = b1; b2k = b1k; b1 = v; b1k = k } else if (v > b2) { b2 = v; b2k = k }
    }
    bestAt[i] = { b1, b1k, b2, b2k }
    return bestAt[i]
  }

  for (let i = MIN_KEY_AREA; i <= n; i++) {
    for (let k = 0; k < K; k++) {
      let bestScore = -Infinity
      let bestFrom = -1
      let bestFromKey = -1
      for (let j = 0; j <= i - MIN_KEY_AREA; j++) {
        const span = spanScore(j, i, k)
        if (j === 0) {
          // The opening area pays no switch cost — it is where the music starts.
          if (span > bestScore) { bestScore = span; bestFrom = 0; bestFromKey = -1 }
          continue
        }
        // The previous area must be in a different key, or this is not a switch.
        const { b1, b1k, b2, b2k } = rank(j)
        const prevKey = b1k === k ? b2k : b1k
        if (prevKey < 0) continue
        const prevScore = b1k === k ? b2 : b1
        if (prevScore === -Infinity) continue
        const total = prevScore - switchCost + span
        if (total > bestScore) { bestScore = total; bestFrom = j; bestFromKey = prevKey }
      }
      best[i][k] = bestScore
      fromAt[i][k] = bestFrom
      fromKey[i][k] = bestFromKey
    }
  }

  // Walk the segments back.
  let k = 0
  for (let j = 1; j < K; j++) if (best[n][j] > best[n][k]) k = j
  const areas = []
  let at = n
  while (at > 0 && k >= 0) {
    const j = fromAt[at][k]
    areas.unshift({ start: j, end: at, key: ctxs[k].key })
    k = fromKey[at][k]
    at = j
  }
  return areas
}

/**
 * Spell a bare MIDI number as a note in a key.
 *
 * Melody notes are stored as pitch numbers, which is the one place in this app
 * where spelling has been thrown away — fine while the roll only had to colour
 * them, and not fine the moment they have to be written down. A diatonic pitch
 * takes the key's own spelling of that degree, so in D♭ major the fourth degree
 * is G♭ and never F♯. A chromatic one is written as an alteration of whichever
 * neighbouring degree the key's own accidentals point at: sharps raise the
 * degree below, flats lower the degree above.
 */
export function spellPitchInKey(midi, key) {
  const pc = mod(midi, 12)
  const scale = scaleNotes(key)

  let note = scale.find((n) => pcOf(n) === pc)
  if (!note) {
    const flats = prefersFlats(key)
    // The degree a half step away in the direction the key leans.
    const neighbour = scale.find((n) => pcOf(n) === mod(pc + (flats ? 1 : -1), 12))
    note = neighbour
      ? { letter: neighbour.letter, acc: normAcc(neighbour.acc + (flats ? -1 : 1)) }
      : { letter: LETTERS.indexOf(pcName(pc, flats)[0]), acc: pcName(pc, flats).length > 1 ? (flats ? -1 : 1) : 0 }
  }

  // The octave belongs to the letter, not the sounding pitch: B♯ sounding at
  // middle C is B♯3, not B♯4, and C♭ sounding a semitone below is C♭4.
  const octave = Math.floor((midi - note.acc) / 12) - 1
  return { note, octave }
}

export function keySignatureAccidentals(key) {
  return scaleNotes(key).filter((n) => n.acc !== 0).map(noteName)
}
