// Drills, generated rather than written.
//
// Every question here is built from the same engine the app runs on, and the
// right answer is whatever that engine says — never a second copy of the theory
// kept in this file. That is the whole point: a hand-authored question bank goes
// stale the moment the engine is corrected, and the two then disagree in front
// of someone who is trying to learn. Ask romanNumeral() what the numeral is and
// they cannot drift.
//
// It also means the supply is unlimited. Twelve keys times seven degrees times
// six question types, in every level, with no content to write.

import { makeChord, chordSymbol, chordName, chordNotes, QUALITIES, voiceChord } from './chords.js'
import {
  makeKey, keyName, romanNumeral, harmonicFunction, isDiatonic, spellDegree, scalePcs,
} from './keys.js'
import { prettyName, pcOf, mod, pcName, midiName, parseNote, midiAtOrAbove } from './notes.js'
import { cadenceAt, CADENCE_LABELS } from './analyze.js'
import { INTERVALS, INTERVAL_EAR, intervalBetween, noteAtInterval } from './intervals.js'
import { TUNINGS } from './guitar.js'

/**
 * Seeded RNG (mulberry32), so a question is reproducible from its seed.
 *
 * Math.random would do for the page, but not for the checks: a generator that
 * produces a broken question one time in five hundred is exactly the kind of bug
 * that needs a seed to pin down.
 */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length]

function shuffle(list, rng) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** First occurrence wins, so putting the answer first guarantees it survives. */
const distinct = (list) => [...new Map(list.map((x) => [x, x])).values()]

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

// Note letters are read aloud as letters, and "F" is "eff" — so A, E and F all
// take "an" even though only two of them are vowels.
const chordArticle = (symbol) => (/^[AEF]/.test(symbol) ? 'an' : 'a')

// --- vocabulary by level -----------------------------------------------------

/**
 * Degrees as [semitonesAboveTonic, genericDegree, qualityId]. The generic degree
 * is what keeps the spelling honest — ♭III in C minor has to be E♭, not D♯, and
 * only the degree number can decide that.
 */
const DEGREES = {
  major: {
    triads: [[0, 1, 'maj'], [2, 2, 'min'], [4, 3, 'min'], [5, 4, 'maj'], [7, 5, 'maj'], [9, 6, 'min'], [11, 7, 'dim']],
    sevenths: [[0, 1, 'maj7'], [2, 2, 'm7'], [4, 3, 'm7'], [5, 4, 'maj7'], [7, 5, 'dom7'], [9, 6, 'm7'], [11, 7, 'm7b5']],
  },
  minor: {
    triads: [[0, 1, 'min'], [2, 2, 'dim'], [3, 3, 'maj'], [5, 4, 'min'], [7, 5, 'min'], [8, 6, 'maj'], [10, 7, 'maj']],
    sevenths: [[0, 1, 'm7'], [2, 2, 'm7b5'], [3, 3, 'maj7'], [5, 4, 'm7'], [7, 5, 'm7'], [8, 6, 'maj7'], [10, 7, 'dom7']],
  },
}

/** Chords from outside the key, for the levels that use them. */
const CHROMATIC = [
  // `why` never repeats the numeral: the explanations already print that, and
  // "A7 is V7/ii — V7/ii, an applied dominant" is how you get there.
  { spec: [5, 4, 'min'], why: 'borrowed from the parallel minor' },
  { spec: [8, 6, 'maj'], why: 'borrowed from the parallel minor' },
  { spec: [10, 7, 'maj'], why: 'borrowed from the parallel minor' },
  { spec: [9, 6, 'dom7'], why: 'an applied dominant, aiming a V7 at a chord that is not the tonic' },
  { spec: [2, 2, 'dom7'], why: 'an applied dominant, aiming a V7 at a chord that is not the tonic' },
  { spec: [4, 3, 'dom7'], why: 'an applied dominant, aiming a V7 at a chord that is not the tonic' },
  { spec: [1, 2, 'dom7'], why: 'the tritone substitute for V7 — same tritone, root a half step above the tonic' },
]

// Keys are capped well short of the full circle: nobody learns anything extra
// from being asked the same question in C♭ major, and seven accidentals turn a
// theory drill into a spelling drill.
const KEYS = {
  basics: { major: ['C', 'G', 'F', 'D'], minor: [] },
  sevenths: { major: ['C', 'G', 'D', 'A', 'F', 'Bb'], minor: ['A', 'E', 'D', 'C'] },
  chromatic: { major: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'], minor: ['A', 'E', 'B', 'D', 'G', 'C'] },
}

export const LEVELS = [
  {
    id: 'basics',
    rank: 0,
    label: 'Basics',
    blurb: 'Diatonic triads in major keys. Numerals, function, and how a phrase closes.',
    types: ['numeral', 'fn', 'spelling', 'cadence'],
  },
  {
    id: 'sevenths',
    rank: 1,
    label: 'Sevenths & minor',
    blurb: 'Seventh chords and minor keys, with the cadences that only exist there.',
    types: ['numeral', 'fn', 'spelling', 'cadence', 'resolve'],
  },
  {
    id: 'chromatic',
    rank: 2,
    label: 'Chromatic',
    blurb: 'Applied dominants, borrowed chords and tritone subs — everything that leaves the key.',
    types: ['numeral', 'fn', 'cadence', 'resolve', 'outsider'],
  },
  {
    id: 'intervals',
    rank: 2,
    label: 'Intervals',
    blurb: 'Naming the distance between two notes — written, by ear, and found on the instrument.',
    types: ['interval', 'earInterval', 'findInterval'],
  },
  {
    id: 'ear',
    rank: 2,
    label: 'By ear',
    blurb: 'Nothing written down. Listen, then name what you heard.',
    types: ['earInterval', 'earChord'],
  },
  {
    id: 'instrument',
    rank: 2,
    label: 'On the instrument',
    blurb: 'Where the notes actually are, on a keyboard and on a fretboard.',
    types: ['noteOn', 'findNote', 'findInterval'],
  },
]

export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[0]

// --- instruments -------------------------------------------------------------
//
// Ranges are chosen so every question is answerable inside the drawn instrument:
// a perfect octave above the highest possible reference still has to be a key on
// the keyboard, and a fret on the neck.

export const GUITAR_TUNING = TUNINGS.standard.strings
export const GUITAR_MAX_FRET = 12
export const PIANO_LOW = 48
export const PIANO_HIGH = 84

const GUITAR_LOW = GUITAR_TUNING[0]
const GUITAR_HIGH = GUITAR_TUNING[GUITAR_TUNING.length - 1] + GUITAR_MAX_FRET

const RANGE = {
  piano: { low: PIANO_LOW, high: PIANO_HIGH },
  guitar: { low: GUITAR_LOW, high: GUITAR_HIGH },
}

/** Every place a MIDI note can be played on the drawn instrument. */
export function positionsFor(instrument, midi) {
  if (instrument === 'piano') return midi >= PIANO_LOW && midi <= PIANO_HIGH ? [midi] : []
  const out = []
  GUITAR_TUNING.forEach((open, string) => {
    const fret = midi - open
    if (fret >= 0 && fret <= GUITAR_MAX_FRET) out.push({ string, fret })
  })
  return out
}

/**
 * Guitarists number strings from the thinnest down: the high E is string 1 and
 * the low E is string 6. The arrays here run the other way, lowest first, which
 * is the order the fretboard is drawn in — so anything shown to a player has to
 * be flipped back.
 */
export const stringNumber = (index) => GUITAR_TUNING.length - index

const positionText = (midi) =>
  positionsFor('guitar', midi)
    .map((p) => `string ${stringNumber(p.string)} fret ${p.fret}`)
    .join(', or ')

/**
 * Where a note actually is, named concretely rather than restated.
 *
 * Octave numbers take a single spelling — "F♯ / G♭4" reads as a fraction. The
 * prompt has already given both names; this only has to say which octave.
 */
function whereText(instrument, midi) {
  if (instrument === 'guitar') return positionText(midi)
  return `${pcName(mod(midi, 12), false).replace('#', '♯')}${Math.floor(midi / 12) - 1}`
}

/** Every octave of a pitch class inside the drawn range. */
function allOf(instrument, pc) {
  const { low, high } = RANGE[instrument]
  const out = []
  for (let m = low; m <= high; m++) if (mod(m, 12) === pc) out.push(m)
  return out
}

/**
 * A note name that does not depend on which enharmonic spelling you learned.
 *
 * A black key is F♯ to a guitarist and G♭ to a horn player, and both are looking
 * at the same key. Asking someone to pick between them is a question about
 * notation, not about where the note is.
 */
export function pcLabel(pc) {
  const sharp = pcName(pc, false)
  const flat = pcName(pc, true)
  return sharp === flat ? sharp : `${sharp.replace('#', '♯')} / ${flat.replace('b', '♭')}`
}

// --- building blocks ---------------------------------------------------------

function buildDegree(key, [semis, generic, qualityId]) {
  return makeChord(spellDegree(key, semis, generic), qualityId)
}

function pickKey(levelId, rng) {
  const pool = KEYS[levelId] ?? KEYS.basics
  const modes = [...pool.major.map((t) => ['major', t]), ...pool.minor.map((t) => ['minor', t])]
  const [mode, tonic] = pick(modes, rng)
  return makeKey(tonic, mode)
}

function degreeTable(key, levelId, rng) {
  const set = DEGREES[key.mode]
  if (levelId === 'basics') return set.triads
  // Above basics, mix triads and sevenths so the shape of the question does not
  // give away which one it is.
  return rng() < 0.55 ? set.sevenths : set.triads
}

// --- question types ----------------------------------------------------------
//
// Each returns null rather than throwing when it cannot build a sound question
// for the key it drew; makeQuestion retries with the next draw.

function numeralQ(levelId, rng) {
  const key = pickKey(levelId, rng)
  const table = degreeTable(key, levelId, rng)
  const useChromatic = levelId === 'chromatic' && key.mode === 'major' && rng() < 0.45
  const entry = useChromatic ? pick(CHROMATIC, rng) : null
  const chord = buildDegree(key, entry ? entry.spec : pick(table, rng))

  const answer = romanNumeral(chord, key)
  const others = [
    ...table.map((s) => romanNumeral(buildDegree(key, s), key)),
    ...(levelId === 'chromatic' && key.mode === 'major'
      ? CHROMATIC.map((c) => romanNumeral(buildDegree(key, c.spec), key))
      : []),
  ]
  const options = distinct([answer, ...shuffle(others, rng)]).slice(0, 4)
  if (options.length < 3) return null

  return {
    type: 'numeral',
    prompt: `What is ${chordSymbol(chord)} in ${keyName(key)}?`,
    key,
    chords: [chord],
    options,
    answer,
    explain: `${chordSymbol(chord)} is ${answer} in ${keyName(key)}${
      isDiatonic(chord, key) ? '' : ` — ${entry ? entry.why : 'a chord from outside the key'}`
    }.`,
  }
}

const FN_NAME = { T: 'Tonic', PD: 'Predominant', D: 'Dominant' }
const FN_WHY = {
  T: 'it is where the key rests',
  PD: 'it sets up the dominant rather than resolving on its own',
  D: 'it pulls back towards the tonic',
}

/**
 * Why a chord has the function it has.
 *
 * "vi is tonic" is true and useless on its own — it is the answer most likely to
 * be got wrong, and the reason is the whole lesson: it shares two of its three
 * notes with the tonic chord, so it can stand in for it. Say that.
 */
function functionWhy(chord, key, fn) {
  const deg = mod(pcOf(chord.root) - pcOf(key.tonic), 12)
  if (fn === 'T' && deg !== 0) {
    return 'it shares two notes with the tonic chord, so it stands in for it'
  }
  if (fn === 'D' && chord.qualityId === 'dom7' && deg !== 7) {
    return 'any dominant seventh functions as a dominant, whether or not it is the key’s own V'
  }
  return FN_WHY[fn]
}

function fnQ(levelId, rng) {
  const key = pickKey(levelId, rng)
  const table = degreeTable(key, levelId, rng)
  const useChromatic = levelId === 'chromatic' && key.mode === 'major' && rng() < 0.4
  const chord = buildDegree(key, useChromatic ? pick(CHROMATIC, rng).spec : pick(table, rng))

  const fn = harmonicFunction(chord, key)
  const roman = romanNumeral(chord, key)

  return {
    type: 'fn',
    prompt: `In ${keyName(key)}, what is ${chordSymbol(chord)} doing?`,
    key,
    chords: [chord],
    options: ['Tonic', 'Predominant', 'Dominant'],
    answer: FN_NAME[fn],
    explain: `${chordSymbol(chord)} is ${roman}, so it is ${FN_NAME[fn].toLowerCase()} — ${functionWhy(chord, key, fn)}.`,
  }
}

function spellingQ(levelId, rng) {
  const key = pickKey(levelId, rng)
  const table = degreeTable(key, levelId, rng)
  const spec = pick(table, rng)
  const chord = buildDegree(key, spec)
  const spell = (c) => chordNotes(c).map((e) => prettyName(e.note)).join(' ')

  // Wrong answers are the same root wearing a different quality, which is the
  // confusion actually worth drilling — not four unrelated chords, where the
  // root alone gives it away.
  const neighbours = spec[2].includes('7')
    ? ['maj7', 'm7', 'dom7', 'm7b5', 'dim7']
    : ['maj', 'min', 'dim', 'aug']
  const answer = spell(chord)
  const others = neighbours.map((q) => spell(makeChord(chord.root, q)))
  const options = distinct([answer, ...shuffle(others, rng)]).slice(0, 4)
  if (options.length < 3) return null

  return {
    type: 'spelling',
    prompt: `Which notes make up ${chordSymbol(chord)}?`,
    key,
    chords: [chord],
    options,
    answer,
    explain: `${chordSymbol(chord)} is ${chordArticle(chordSymbol(chord))} ${chordName(chord)}: ${answer}.`,
  }
}

/**
 * Cadence pairs, as [aSpec, bSpec]. `null` in place of a quality means "the
 * tonic chord of whichever mode we are in".
 *
 * These are only *intended* cadences. What the question actually asks is
 * whatever cadenceAt() names the pair — so the drill can never teach something
 * the app itself would contradict.
 */
const CADENCE_PAIRS = {
  major: [
    { rank: 0, a: [7, 5, 'dom7'], b: [0, 1, null] },
    { rank: 0, a: [7, 5, 'maj'], b: [0, 1, null] },
    { rank: 0, a: [5, 4, 'maj'], b: [0, 1, null] },
    { rank: 0, a: [2, 2, 'min'], b: [7, 5, 'maj'] },
    { rank: 1, a: [5, 4, 'min'], b: [0, 1, null] },
    { rank: 1, a: [7, 5, 'dom7'], b: [9, 6, 'min'] },
    { rank: 2, a: [10, 7, 'dom7'], b: [0, 1, null] },
  ],
  minor: [
    { rank: 1, a: [7, 5, 'dom7'], b: [0, 1, null] },
    { rank: 1, a: [5, 4, 'min'], b: [0, 1, null] },
    { rank: 1, a: [5, 4, 'min'], b: [7, 5, 'maj'] },
    { rank: 2, a: [10, 7, 'maj'], b: [0, 1, null] },
    { rank: 2, a: [10, 7, 'dom7'], b: [0, 1, null] },
    { rank: 2, a: [7, 5, 'dom7'], b: [8, 6, 'maj'] },
  ],
}

const buildPair = (key, pair) => {
  const tonicQuality = key.mode === 'minor' ? 'min' : 'maj'
  const fill = ([s, g, q]) => [s, g, q ?? tonicQuality]
  return [buildDegree(key, fill(pair.a)), buildDegree(key, fill(pair.b))]
}

/**
 * Which cadence names are even reachable at a level.
 *
 * Wrong answers have to come from the same world as the right one. Offering a
 * Phrygian half cadence against a plain V–I in Basics teaches nothing — it is
 * eliminable without knowing any theory, and it names a thing the level has not
 * introduced. The set is derived by asking the engine to name every pair the
 * level can build, so it stays correct if the pairs change.
 */
const reachableLabels = (() => {
  const cache = new Map()
  return (rank) => {
    if (!cache.has(rank)) {
      const labels = new Set()
      for (const [mode, tonic] of [['major', 'C'], ['minor', 'A']]) {
        const key = makeKey(tonic, mode)
        for (const pair of CADENCE_PAIRS[mode]) {
          if (pair.rank > rank) continue
          const found = cadenceAt(buildPair(key, pair), 1, key)
          if (found) labels.add(found.label)
        }
      }
      cache.set(rank, [...labels])
    }
    return cache.get(rank)
  }
})()

function cadenceQ(levelId, rng) {
  const level = levelById(levelId)
  const key = pickKey(levelId, rng)
  const pairs = CADENCE_PAIRS[key.mode].filter((p) => p.rank <= level.rank)
  if (!pairs.length) return null
  const [a, b] = buildPair(key, pick(pairs, rng))

  const found = cadenceAt([a, b], 1, key)
  if (!found) return null

  // Top up from the full list only if the level cannot field four names of its
  // own, so a two-option question never reaches the page.
  const near = reachableLabels(level.rank).filter((l) => l !== found.label)
  const rest = CADENCE_LABELS.filter((l) => l !== found.label && !near.includes(l))
  const options = distinct([found.label, ...shuffle(near, rng), ...shuffle(rest, rng)]).slice(0, 4)
  if (options.length < 3) return null

  return {
    type: 'cadence',
    prompt: `In ${keyName(key)}, what cadence is ${chordSymbol(a)} to ${chordSymbol(b)}?`,
    key,
    chords: [a, b],
    options,
    answer: found.label,
    explain: `${romanNumeral(a, key)} to ${romanNumeral(b, key)} is ${article(found.label)} ${found.label}. ${found.why}`,
  }
}

function resolveQ(levelId, rng) {
  const key = pickKey(levelId, rng)
  if (key.mode !== 'major') return null
  const table = DEGREES.major[rng() < 0.5 ? 'triads' : 'sevenths']

  // An applied dominant a fifth above one of the key's own degrees. ii, iii, IV
  // and vi only: V/I is just V, and vii° is not a chord anything tonicises.
  const targetSpec = pick(table.filter(([s]) => [2, 4, 5, 9].includes(s)), rng)
  const target = buildDegree(key, targetSpec)
  const domRoot = spellDegree(key, mod(targetSpec[0] + 7, 12), ((targetSpec[1] + 3) % 7) + 1)
  const dominant = makeChord(domRoot, 'dom7')

  const answer = chordSymbol(target)
  const others = table.map((s) => chordSymbol(buildDegree(key, s)))
  const options = distinct([answer, ...shuffle(others, rng)]).slice(0, 4)
  if (options.length < 3) return null

  const tones = chordNotes(dominant)
  const third = prettyName(tones[1].note)
  const seventh = prettyName(tones[3].note)

  return {
    type: 'resolve',
    prompt: `In ${keyName(key)}, ${chordSymbol(dominant)} is pointing at which chord?`,
    key,
    chords: [dominant, target],
    options,
    answer,
    explain: `${chordSymbol(dominant)} is ${romanNumeral(dominant, key)}. Its third, ${third}, is the leading tone of ${prettyName(target.root)}, and its seventh, ${seventh}, falls a half step — both land inside ${answer}.`,
  }
}

function outsiderQ(levelId, rng) {
  const key = makeKey(pick(KEYS[levelId].major, rng), 'major')
  const table = DEGREES.major[rng() < 0.5 ? 'triads' : 'sevenths']

  // Built rather than generated: a random progression happens to contain one
  // chromatic chord only sometimes, and a question with two right answers is
  // worse than no question.
  const diatonic = shuffle(table, rng).slice(0, 3).map((s) => buildDegree(key, s))
  const entry = pick(CHROMATIC, rng)
  const stranger = buildDegree(key, entry.spec)
  if (isDiatonic(stranger, key)) return null
  if (diatonic.some((c) => pcOf(c.root) === pcOf(stranger.root))) return null

  const at = Math.floor(rng() * 4)
  const progression = [...diatonic]
  progression.splice(at, 0, stranger)

  const scale = new Set(scalePcs(key))
  const outside = chordNotes(stranger)
    .filter((e) => !scale.has(pcOf(e.note)))
    .map((e) => prettyName(e.note))

  return {
    type: 'outsider',
    prompt: `One of these is not in ${keyName(key)}. Which?`,
    key,
    chords: progression,
    options: progression.map(chordSymbol),
    answer: chordSymbol(stranger),
    explain: `${chordSymbol(stranger)} is ${romanNumeral(stranger, key)} — ${entry.why}${
      outside.length ? `, bringing in ${outside.join(', ')}` : ''
    }.`,
  }
}

// --- intervals, ear and instrument -------------------------------------------

/** Roots that spell every interval in the catalogue without a double accidental. */
const INTERVAL_ROOTS = ['C', 'G', 'D', 'A', 'E', 'F', 'B', 'Bb', 'Eb', 'Ab']

/**
 * A root and an interval whose upper note spells cleanly.
 *
 * A diminished 5th above E♭ is B𝄫. That is correct, and it is not a question
 * anyone learns anything from — so the pair is redrawn rather than asked.
 */
function pickInterval(rng, { maxRank = 2, pool = INTERVALS } = {}) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const spec = pick(pool.filter((i) => i.rank <= maxRank), rng)
    const from = parseNote(pick(INTERVAL_ROOTS, rng))
    const to = noteAtInterval(from, spec.generic, spec.semitones)
    if (Math.abs(to.acc) > 1 || Math.abs(from.acc) > 1) continue
    const named = intervalBetween(from, to, { octave: spec.generic === 8 })
    // The catalogue and the namer have to agree, or the question is unanswerable.
    if (!named || named.name !== spec.name) continue
    return { spec, from, to, named }
  }
  return null
}

/**
 * Interval names that cannot be confused by ear.
 *
 * An augmented 4th and a diminished 5th are the same sound. Offering both as
 * options in a listening question makes it unanswerable — there is no hearing
 * good enough to tell a notation choice apart.
 */
const audiblyDistinct = (specs) => {
  const seen = new Set()
  return specs.filter((s) => (seen.has(s.semitones) ? false : seen.add(s.semitones)))
}

function intervalQ(levelId, rng) {
  const drawn = pickInterval(rng)
  if (!drawn) return null
  const { spec, from, to, named } = drawn

  const others = shuffle(INTERVALS.filter((i) => i.name !== spec.name), rng)
  const options = distinct([spec.name, ...others.map((i) => i.name)]).slice(0, 4)

  return {
    type: 'interval',
    prompt: `What is the interval from ${prettyName(from)} up to ${prettyName(to)}?`,
    options,
    answer: spec.name,
    play: [[midiAtOrAbove(pcOf(from), 60)], [midiAtOrAbove(pcOf(from), 60) + spec.semitones]],
    explain: `${prettyName(from)} up to ${prettyName(to)} spans ${spec.generic === 8 ? 8 : spec.generic} letter names and ${spec.semitones} semitone${spec.semitones === 1 ? '' : 's'} — ${article(spec.name)} ${spec.name}.`,
  }
}

function earIntervalQ(levelId, rng) {
  // Only intervals that are distinct by ear, and only one of the two tritone
  // spellings, so no two options can ever sound the same.
  const pool = audiblyDistinct(INTERVALS)
  const drawn = pickInterval(rng, { pool })
  if (!drawn) return null
  const { spec, from, to } = drawn

  const base = midiAtOrAbove(pcOf(from), 57 + Math.floor(rng() * 8))
  const others = shuffle(pool.filter((i) => i.semitones !== spec.semitones), rng)
  const options = distinct([spec.name, ...others.map((i) => i.name)]).slice(0, 4)

  return {
    type: 'earInterval',
    prompt: 'Two notes, low then high. What interval is it?',
    options,
    answer: spec.name,
    play: [[base], [base + spec.semitones]],
    secret: true,
    autoPlay: true,
    explain: `${prettyName(from)} up to ${prettyName(to)} — ${article(spec.name)} ${spec.name}, ${spec.semitones} semitone${spec.semitones === 1 ? '' : 's'}. ${INTERVAL_EAR[spec.name] ?? ''}`,
  }
}

/** Qualities worth telling apart by ear, in rough order of how distinct they are. */
const EAR_QUALITIES = ['maj', 'min', 'dim', 'aug', 'maj7', 'm7', 'dom7', 'm7b5', 'dim7', 'sus4']

function earChordQ(levelId, rng) {
  const qualityId = pick(EAR_QUALITIES, rng)

  // A diminished 7th on E♭ spells E♭ G♭ B♭♭ D♭♭. Correct, and unreadable — the
  // root is redrawn until the chord spells without a double accidental, since
  // the printed notes are the whole of the explanation.
  let chord = null
  for (const name of shuffle(INTERVAL_ROOTS, rng)) {
    const built = makeChord(parseNote(name), qualityId)
    if (chordNotes(built).every((e) => Math.abs(e.note.acc) <= 1)) { chord = built; break }
  }
  if (!chord) return null

  const answer = QUALITIES[qualityId].name
  const others = shuffle(EAR_QUALITIES.filter((q) => q !== qualityId), rng)
  const options = distinct([answer, ...others.map((q) => QUALITIES[q].name)]).slice(0, 4)

  return {
    type: 'earChord',
    prompt: 'One chord. What quality is it?',
    options,
    answer,
    chords: [chord],
    play: [voiceChord(chord, { bottom: 52 })],
    secret: true,
    autoPlay: true,
    explain: `${chordSymbol(chord)} — ${article(answer)} ${answer}: ${chordNotes(chord).map((e) => prettyName(e.note)).join(' ')}.`,
  }
}

const pickInstrument = (rng) => (rng() < 0.5 ? 'piano' : 'guitar')

const INSTRUMENT_NAME = { piano: 'keyboard', guitar: 'fretboard' }

function noteOnQ(levelId, rng) {
  const instrument = pickInstrument(rng)
  const { low, high } = RANGE[instrument]
  const reference = low + Math.floor(rng() * (high - low + 1))

  const answer = pcLabel(mod(reference, 12))
  const others = shuffle(Array.from({ length: 12 }, (_, pc) => pcLabel(pc)).filter((l) => l !== answer), rng)
  const options = distinct([answer, ...others]).slice(0, 4)

  return {
    type: 'noteOn',
    prompt: `Which note is highlighted on the ${INSTRUMENT_NAME[instrument]}?`,
    options,
    answer,
    instrument,
    reference,
    play: [[reference]],
    explain: `That is ${answer}, at ${whereText(instrument, reference)}.`,
  }
}

function findNoteQ(levelId, rng) {
  const instrument = pickInstrument(rng)
  const pc = Math.floor(rng() * 12)
  const label = pcLabel(pc)

  return {
    type: 'findNote',
    prompt: `Find ${label} on the ${INSTRUMENT_NAME[instrument]}.`,
    hint: instrument === 'guitar' ? 'Any string, any fret.' : 'Any octave.',
    input: 'instrument',
    instrument,
    answerPcs: [pc],
    answer: label,
    explain: `Every one of these is ${label}: ${allOf(instrument, pc)
      .flatMap((m) => (instrument === 'guitar' ? positionsFor('guitar', m).map((p) => `string ${stringNumber(p.string)} fret ${p.fret}`) : [whereText('piano', m)]))
      .join(', ')}.`,
  }
}

function findIntervalQ(levelId, rng) {
  const instrument = pickInstrument(rng)
  const { low, high } = RANGE[instrument]
  const pool = audiblyDistinct(INTERVALS).filter((i) => i.semitones > 0)

  for (let attempt = 0; attempt < 30; attempt++) {
    const spec = pick(pool, rng)
    const reference = low + Math.floor(rng() * (high - low + 1))
    const target = reference + spec.semitones
    // The answer has to be reachable on the instrument being drawn, or the
    // question is unanswerable however well you know the interval.
    if (!positionsFor(instrument, target).length) continue

    return {
      type: 'findInterval',
      prompt: `From the highlighted ${pcLabel(mod(reference, 12))}, find the note ${article(spec.name)} ${spec.name} above it.`,
      hint: instrument === 'guitar' ? 'Any position sounding that note counts.' : null,
      input: 'instrument',
      instrument,
      reference,
      answerMidi: target,
      answer: `${spec.name} above ${pcLabel(mod(reference, 12))}`,
      // Before answering you may hear the note you are measuring from, and only
      // that: playing the target as well would hand over the answer.
      play: [[reference]],
      playAnswer: [[reference], [target]],
      explain: `${article(spec.name)[0].toUpperCase()}${article(spec.name).slice(1)} ${spec.name} is ${spec.semitones} semitone${spec.semitones === 1 ? '' : 's'}, so ${pcLabel(mod(reference, 12))} goes to ${pcLabel(mod(target, 12))}${instrument === 'guitar' ? ` — ${positionText(target)}` : ` — ${whereText('piano', target)}`}.`,
    }
  }
  return null
}

const BUILDERS = {
  numeral: numeralQ,
  fn: fnQ,
  spelling: spellingQ,
  cadence: cadenceQ,
  resolve: resolveQ,
  outsider: outsiderQ,
  interval: intervalQ,
  earInterval: earIntervalQ,
  earChord: earChordQ,
  noteOn: noteOnQ,
  findNote: findNoteQ,
  findInterval: findIntervalQ,
}

export const TYPE_LABELS = {
  numeral: 'Roman numerals',
  fn: 'Harmonic function',
  spelling: 'Chord spelling',
  cadence: 'Cadences',
  resolve: 'Resolution',
  outsider: 'Outside the key',
  interval: 'Intervals',
  earInterval: 'Intervals by ear',
  earChord: 'Chords by ear',
  noteOn: 'Reading the instrument',
  findNote: 'Finding notes',
  findInterval: 'Intervals on the instrument',
}

/**
 * One question, ready to render.
 *
 * Builders return null when a draw does not yield a sound question, so this
 * retries — bounded, because an unbounded retry loop is how a bad builder turns
 * into a hung tab rather than a visible bug.
 */
export function makeQuestion(levelId, rng = Math.random, { type = null } = {}) {
  const level = levelById(levelId)
  for (let attempt = 0; attempt < 40; attempt++) {
    const chosen = type ?? pick(level.types, rng)
    const q = BUILDERS[chosen]?.(level.id, rng)
    if (!q) continue

    const base = {
      input: 'choice',
      instrument: null,
      reference: null,
      play: null,
      secret: false,
      autoPlay: false,
      hint: null,
      ...q,
      level: level.id,
      typeLabel: TYPE_LABELS[q.type],
    }

    // Answered on an instrument: there is no list to shuffle, and the answer is
    // a note rather than a string.
    if (base.input === 'instrument') {
      if (base.answerMidi == null && !base.answerPcs?.length) continue
      return { ...base, options: [], answerIndex: -1 }
    }

    const options = shuffle(q.options, rng)
    const answerIndex = options.indexOf(q.answer)
    if (answerIndex < 0) continue

    return { ...base, options, answerIndex }
  }
  return null
}

/** Is a clicked note the right answer? The only place that rule lives. */
export function checkNote(question, midi) {
  if (question?.input !== 'instrument') return false
  if (question.answerMidi != null) return midi === question.answerMidi
  return (question.answerPcs ?? []).includes(mod(midi, 12))
}
