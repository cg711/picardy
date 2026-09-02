// Reading a progression back: what the chords are doing, and where.

import { mod, pcOf, prettyName } from './notes.js'
import { QUALITIES, chordSymbol, chordNotes, inversionCount, bassOf } from './chords.js'
import { romanNumeral, harmonicFunction, isDiatonic, detectKey, detectKeyAreas, keyName, scalePcs } from './keys.js'

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

/**
 * Chords that are consequences of voice leading rather than harmonies.
 *
 * The central claim of Aldwell & Schachter, and the one thing this engine had
 * no vocabulary for at all: some chords carry the structure and some decorate
 * it. A VII6 between I and I6 is not a third harmony in a three-chord
 * progression — it is a passing chord inside one prolonged tonic, and the book
 * writes it in parentheses to say so.
 *
 * Two cases only, both decidable from the bass alone:
 *
 *   passing    — the bass walks by step in one direction and lands back on the
 *                same harmony it left, in a different position. I–(VII6)–I6.
 *   neighbour  — the harmony either side is identical, and the bass steps away
 *                and back, or holds while the upper voices move. I–(IV 6/4)–I.
 *
 * Everything else the book calls contrapuntal needs judgement this engine
 * cannot defend — an apparent tonic between IV and V depends on where the
 * soprano is and which beat it falls on. Picardy's rule is that it only says
 * what it can justify, so those are left alone rather than guessed at, and a
 * chord this returns null for is simply a chord like any other.
 */
export function contrapuntalRole(progression, index, inversions) {
  if (!inversions) return null
  const prev = progression[index - 1]
  const chord = progression[index]
  const next = progression[index + 1]
  if (!prev || !chord || !next) return null

  const bassPc = (c, i) => {
    const b = bassOf(c, inversions[i] ?? 0)
    return b.note ? pcOf(b.note) : null
  }
  // A chord standing on its own root is claiming to be a harmony, and mostly
  // is: C–Dm–C is I–ii–I, not a tonic with a neighbour inside it. Every
  // contrapuntal chord the book names is an inversion — VII6, V 4/3, IV 6/4 —
  // because sitting over a bass borrowed from the harmony it decorates is what
  // makes it subordinate. Without this the detector relabelled ordinary
  // root-position progressions.
  if ((inversions[index] ?? 0) === 0) return null

  const b0 = bassPc(prev, index - 1)
  const b1 = bassPc(chord, index)
  const b2 = bassPc(next, index + 1)
  if (b0 === null || b1 === null || b2 === null) return null

  // Signed motion in semitones, counting only steps — a leap is not this.
  const step = (from, to) => {
    const up = mod(to - from, 12)
    if (up === 1 || up === 2) return up
    if (up === 10 || up === 11) return up - 12
    return up === 0 ? 0 : null
  }
  const d1 = step(b0, b1)
  const d2 = step(b1, b2)
  if (d1 === null || d2 === null) return null

  const sameHarmony = pcOf(prev.root) === pcOf(next.root) && prev.qualityId === next.qualityId

  // Passing: through in one direction, from one position of a harmony to
  // another. Both steps must actually move, or nothing is being passed through.
  if (sameHarmony && d1 !== 0 && d2 !== 0 && Math.sign(d1) === Math.sign(d2) && b0 !== b2) {
    return { role: 'passing', label: 'passing chord', of: prev }
  }

  // Neighbour: away and back to exactly where it started, or a bass that holds
  // while the chord above it changes and returns.
  const samePosition = sameHarmony && (inversions[index - 1] ?? 0) === (inversions[index + 1] ?? 0)
  if (samePosition && b0 === b2 && (d2 === -d1)) {
    return { role: 'neighbour', label: d1 === 0 ? 'pedal chord' : 'neighbour chord', of: prev }
  }

  return null
}

/**
 * Named sequence patterns, tested against a run of root motions.
 *
 * The engine already noticed that a progression was full of falling fifths and
 * said so as a statistic — "6 of 7 changes fall by a fifth". True, and one word
 * short of the name. Aldwell & Schachter separate four patterns and give each a
 * compositional job, so this names them.
 *
 * `steps` is the repeating unit of root motion in semitones, and a sequence has
 * to state it at least twice — one statement is a progression, two is a pattern.
 */
// Measured in scale steps, not semitones. A diatonic descending-fifths sequence
// contains one diminished fifth — F to B in C major — so in semitones the chain
// breaks exactly once and a semitone matcher reports the sequence as starting
// two chords late. The 5–6 patterns fail outright for the same reason, since
// E–F is a semitone where the other steps are tones. Counting letters is how the
// music is actually regular.
const SEQUENCES = [
  {
    id: 'desc5', label: 'descending fifths', steps: [3],
    why: 'Roots falling a fifth each time, the most common sequence in tonal music — every chord is the dominant of the next.',
  },
  {
    id: 'asc5', label: 'ascending fifths', steps: [4],
    why: 'Roots rising a fifth each time. Rarer and less driven than the falling version, because it moves away from resolution rather than towards it.',
  },
  {
    id: 'asc56', label: 'ascending 5–6', steps: [5, 3],
    why: 'Down a third, up a fourth, climbing by a step each time round. The 5–6 technique: a rising line harmonised without parallel fifths.',
  },
  {
    id: 'desc56', label: 'descending 5–6', steps: [4, 1],
    why: 'Up a fifth then up a step, so the roots fall in thirds overall — the falling-thirds sequence.',
  },
  {
    id: 'descStep', label: 'descending steps', steps: [6],
    why: 'Roots walking down by step, which gives a scalar, marching feel rather than a functional pull.',
  },
  {
    id: 'ascStep', label: 'ascending steps', steps: [1],
    why: 'Roots walking up by step, gathering rather than resolving.',
  },
]

/**
 * The longest named sequence in a progression, if there is one.
 *
 * @returns { id, label, why, start, end, statements } or null. `end` exclusive.
 */
export function findSequence(progression) {
  if (!progression || progression.length < 4) return null
  const motions = []
  for (let i = 1; i < progression.length; i++) {
    motions.push(mod(progression[i].root.letter - progression[i - 1].root.letter, 7))
  }

  let best = null
  for (const seq of SEQUENCES) {
    const unit = seq.steps.length
    for (let start = 0; start + unit * 2 <= motions.length; start++) {
      // How far does the pattern hold from here?
      let len = 0
      while (start + len < motions.length && motions[start + len] === seq.steps[len % unit]) len++
      const statements = Math.floor(len / unit)
      if (statements < 2) continue
      const covered = statements * unit
      const candidate = {
        id: seq.id,
        label: seq.label,
        why: seq.why,
        start,
        end: start + covered + 1,
        statements,
      }
      // Longest wins; ties go to whichever pattern is listed first, which puts
      // the fifths above the steps they could otherwise be described as.
      if (!best || covered > best.end - best.start - 1) best = candidate
    }
  }
  return best
}

/**
 * The 5–6 technique: an upper voice stepping from the fifth above the bass to
 * the sixth, while the bass holds.
 *
 * Worth telling apart from an inversion because the two make different claims.
 * C major followed by A minor over the same C in the bass looks like Am in first
 * inversion, and Appendix III is emphatic that it is not: nothing has moved to a
 * new harmony, one voice has stepped up over a held bass. Written I 5–6 rather
 * than I–vi6, because the second says a chord change happened.
 *
 * Needs inversions, and says nothing without them.
 */
export function fiveSixMove(progression, index, inversions) {
  if (!inversions) return null
  const a = progression[index - 1]
  const b = progression[index]
  if (!a || !b) return null

  const bassA = bassOf(a, inversions[index - 1] ?? 0)
  const bassB = bassOf(b, inversions[index] ?? 0)
  if (!bassA.note || !bassB.note) return null
  if (pcOf(bassA.note) !== pcOf(bassB.note)) return null

  // Everything above the bass, as intervals from it.
  const over = (chord, bass) =>
    new Set(chordNotes(chord).map((e) => mod(pcOf(e.note) - pcOf(bass.note), 12)))
  const setA = over(a, bassA)
  const setB = over(b, bassB)

  // A fifth above the bass has become a sixth, and nothing else changed.
  if (!setA.has(7) || setB.has(7)) return null
  const sixth = setB.has(9) ? 9 : setB.has(8) ? 8 : null
  if (sixth === null || setA.has(sixth)) return null
  const restA = [...setA].filter((x) => x !== 7).sort()
  const restB = [...setB].filter((x) => x !== sixth).sort()
  if (restA.length !== restB.length || restA.some((x, i) => x !== restB[i])) return null

  return {
    id: 'fiveSix',
    label: '5–6 technique',
    why: 'The bass holds and a voice above it steps from the fifth to the sixth. It shares a bass with the chord before it but is not its inversion — no new harmony has arrived, one line has moved.',
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
  if (!progression.length) return { key: null, chords: [], observations: [], areas: [] }
  const key = keyOverride ?? detectKey(progression)

  // Where the music changes key, if it does. A progression read wholly in the
  // key it ends in does not merely miss the modulation: it reports the opening
  // as a string of mistakes, because every chord belonging to the first key is
  // measured against the second. C–F–G–C moving to G came back with "♭VII is
  // outside the key" and "it opens on IV", both of which are artefacts of
  // asking one key to explain two.
  const found = detectKeyAreas(progression, keyOverride)
  // A key the user set is not a guess to be second-guessed. When the segmenter
  // finds no modulation there is nothing to add, so the setting stands — which
  // also means this whole feature changes nothing for the progressions that do
  // not modulate, which is most of them. Only when the music genuinely moves
  // does a second key get to contradict the setting, and the panel's existing
  // key-mismatch banner covers the case where it disagrees outright.
  const areas = keyOverride && found.length === 1
    ? [{ ...found[0], key: keyOverride }]
    : found
  const keyAt = (i) => areas.find((a) => i >= a.start && i < a.end)?.key ?? key

  // One scale per area rather than per chord, since areas are few and chords
  // are not.
  const scaleFor = new Map()
  for (const area of areas) {
    const s = new Set(scalePcs(area.key))
    // A minor key's raised 7th is part of its normal vocabulary, not borrowed
    // colour — without this every V7 in minor gets reported as chromatic.
    if (area.key.mode === 'minor') s.add(mod(pcOf(area.key.tonic) + 11, 12))
    scaleFor.set(area.key, s)
  }

  const chords = progression.map((chord, i) => {
    const localKey = keyAt(i)
    const scale = scaleFor.get(localKey) ?? new Set(scalePcs(localKey))
    const diatonic = isDiatonic(chord, localKey)
    const outside = chordNotes(chord)
      .filter((e) => !scale.has(pcOf(e.note)))
      .map((e) => prettyName(e.note))
    // With inversions in hand the numeral carries its figured bass, which is
    // what the progression chips have always shown. Without them this panel
    // said "I" while the chip beside it said "I 6/4".
    const roman = romanNumeral(chord, localKey, inversions?.[i] ?? 0)
    const sixFour = cadentialSixFour(progression, i, localKey, inversions)
    // A cadential 6/4 is already being read as something other than what it
    // spells, and calling it a passing chord as well would be two answers to
    // one question.
    const contrapuntal = sixFour ? null : contrapuntalRole(progression, i, inversions)
    return {
      index: i,
      symbol: chordSymbol(chord),
      roman,
      // The one place a chord's function depends on what follows it. Everywhere
      // else harmonicFunction is right; here it is looking at a tonic triad and
      // cannot see the dominant holding underneath it.
      fn: sixFour ? 'D' : harmonicFunction(chord, localKey),
      sixFour: sixFour ? sixFour.label : null,
      readAs: sixFour ? sixFour.readAs : null,
      // Structural or subordinate. The book writes a contrapuntal chord's
      // numeral in parentheses, so this does too — it is the established
      // notation for exactly this claim.
      contrapuntal: contrapuntal ? contrapuntal.label : null,
      structural: !contrapuntal,
      shownRoman: contrapuntal ? `(${roman})` : roman,
      // Which key this chord is being read in, and whether it starts an area.
      // The panel needs both to show where the music changes key.
      key: localKey,
      keyName: keyName(localKey),
      startsArea: areas.length > 1 && areas.some((a) => a.start === i),
      diatonic,
      outside: [...new Set(outside)],
      applied: isApplied(roman) && !roman.includes('♭') && /^(V|vii)/.test(roman),
    }
  })

  const observations = []
  const note = (kind, text) => observations.push({ kind, text })

  // --- modulation --------------------------------------------------------------
  // Named before the cadence, because which key the phrase closes in is the
  // first thing you need to know once there is more than one.
  if (areas.length > 1) {
    const route = areas.map((a) => keyName(a.key)).join(' → ')
    note('modulation', `It does not stay in one key: ${route}. ${areas.map((a, n) => `${n === 0 ? 'Bars' : 'then'} ${a.start + 1}–${a.end} in ${keyName(a.key)}`).join(', ')}. Each numeral below is read in the key of its own area, which is why the same chord can be a I in one place and a IV in another.`)
    for (let n = 1; n < areas.length; n++) {
      const pivot = chords[areas[n].start - 1]
      const arrival = chords[areas[n].start]
      note('modulation', `The change at chord ${areas[n].start + 1} turns on ${pivot.symbol}: ${pivot.roman} in ${pivot.keyName}, and ${arrival.symbol} arrives as ${arrival.roman} in ${arrival.keyName}.`)
    }
  }

  // --- cadence at the end -----------------------------------------------------
  // Read in the key the phrase actually ends in, not the one it started in.
  const ending = cadenceAt(progression, progression.length - 1, keyAt(progression.length - 1))
  if (ending) {
    // "a authentic cadence" — two of the nine labels start with a vowel.
    const article = /^[aeiou]/i.test(ending.label) ? 'an' : 'a'
    note('cadence', `Ends on ${article} ${ending.label}: ${chords[chords.length - 2].roman} to ${chords[chords.length - 1].roman}. ${ending.why}`)

    // Perfect and imperfect, the way the textbooks draw the line. CADENCES
    // splits perfect from authentic on chord quality — whether the dominant is
    // a seventh — which is a different question from the one the terms answer.
    // The real distinction is position: a perfect authentic cadence has both
    // chords in root position. Added as a qualifier rather than by rewriting
    // that table, which the exercises draw their wrong answers from, and only
    // when there are inversions to read.
    if ((ending.id === 'perfect' || ending.id === 'authentic') && inversions) {
      const last = progression.length - 1
      const rootPosition = (inversions[last - 1] ?? 0) === 0 && (inversions[last] ?? 0) === 0
      note('cadence', rootPosition
        ? 'Both chords are in root position, so it is perfect in the strict sense — the strongest form of the ending.'
        : 'One of the two chords is inverted, which makes it imperfect: still an authentic cadence, but it lands softer than a root-position pair would.')
    }
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

  // --- the 5-6 technique -------------------------------------------------------
  for (let i = 1; i < progression.length; i++) {
    const move = fiveSixMove(progression, i, inversions)
    if (!move) continue
    note('counterpoint', `${chords[i - 1].symbol} to ${chords[i].symbol} over the same bass is the ${move.label}, written ${chords[i - 1].roman} 5–6. ${move.why}`)
  }

  // --- contrapuntal chords -----------------------------------------------------
  // Worth saying out loud, because it changes what the progression *is*: three
  // chords with a passing chord in the middle are one harmony, not three.
  const decorative = chords.filter((c) => c.contrapuntal)
  if (decorative.length) {
    for (const c of decorative) {
      const around = chords[c.index - 1]
      note('counterpoint', `${c.symbol} is a ${c.contrapuntal}, not a harmony of its own — the bass ${c.contrapuntal === 'pedal chord' ? 'holds' : 'steps'} through it and ${around.roman} is still in force either side. Written ${c.shownRoman} in parentheses, the way an analysis marks a chord that decorates rather than structures.`)
    }
    const spine = chords.filter((c) => c.structural).map((c) => c.roman)
    if (spine.length >= 2 && spine.length < chords.length) {
      note('counterpoint', `Underneath, the progression is ${spine.join('–')}.`)
    }
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
  // A named sequence says everything the statistics below would, and says it
  // as a name, so it replaces them rather than sitting alongside.
  const sequence = findSequence(progression)
  if (sequence) {
    note('sequence', `Chords ${sequence.start + 1}–${sequence.end} are a ${sequence.label} sequence, stated ${sequence.statements} times: ${chords.slice(sequence.start, sequence.end).map((c) => c.roman).join('–')}. ${sequence.why}`)
  } else {
    const fifths = motions.filter((m) => m === 5).length
    if (motions.length && fifths / motions.length >= 0.6) {
      note('motion', `${fifths} of ${motions.length} changes fall by a fifth, so the progression is driven by the circle of fifths.`)
    }
    const steps = motions.filter((m) => m === 2 || m === 10).length
    if (motions.length && steps / motions.length >= 0.6) {
      note('motion', 'The roots mostly move by step, which gives a scalar, marching feel rather than a functional pull.')
    }
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

  return { key, keyName: keyName(key), chords, observations, areas }
}
