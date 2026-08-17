// The suggestion engine.
//
// Generators propose candidate next chords with a base "commonality" score;
// the scorer then reweights every candidate against the actual progression so
// far (previous chord's function, root motion, unresolved expectations, voice
// leading, phrase position). Everything is ranked common -> rare.

import { mod, pcOf, spellFrom, prettyName } from './notes.js'
import { QUALITIES, makeChord, makePolychord, chordId, chordSymbol, chordPcs, chordNotes } from './chords.js'
import { romanNumeral, harmonicFunction, scalePcs } from './keys.js'

export const CATEGORIES = {
  diatonic: { label: 'Diatonic', hue: 152 },
  extension: { label: 'Extension', hue: 178 },
  secondary: { label: 'Secondary dominant', hue: 42 },
  secondaryLT: { label: 'Secondary leading-tone', hue: 28 },
  relatedII: { label: 'Related ii–V', hue: 60 },
  mixture: { label: 'Modal mixture', hue: 268 },
  tritoneSub: { label: 'Tritone sub', hue: 320 },
  neapolitan: { label: 'Neapolitan', hue: 300 },
  aug6: { label: 'Augmented sixth', hue: 288 },
  mediant: { label: 'Chromatic mediant', hue: 210 },
  passing: { label: 'Passing / linking', hue: 196 },
  backdoor: { label: 'Backdoor', hue: 12 },
  coltrane: { label: 'Thirds cycle', hue: 340 },
  constant: { label: 'Constant structure', hue: 232 },
  poly: { label: 'Polychord / upper structure', hue: 250 },
  pedal: { label: 'Slash / pedal', hue: 120 },
}

export const TIERS = [
  { min: 78, label: 'Very common', key: 'vcommon' },
  { min: 58, label: 'Common', key: 'common' },
  { min: 38, label: 'Occasional', key: 'occasional' },
  { min: 20, label: 'Uncommon', key: 'uncommon' },
  { min: -Infinity, label: 'Rare', key: 'rare' },
]

export function tierFor(score) {
  return TIERS.find((t) => score >= t.min)
}

const MAJOR_DIATONIC = [
  { semi: 0, gen: 1, tri: 'maj', sev: 'maj7', rn: 'I', triBase: 96, sevBase: 74 },
  { semi: 2, gen: 2, tri: 'min', sev: 'm7', rn: 'ii', triBase: 82, sevBase: 86 },
  { semi: 4, gen: 3, tri: 'min', sev: 'm7', rn: 'iii', triBase: 55, sevBase: 52 },
  { semi: 5, gen: 4, tri: 'maj', sev: 'maj7', rn: 'IV', triBase: 92, sevBase: 76 },
  { semi: 7, gen: 5, tri: 'maj', sev: 'dom7', rn: 'V', triBase: 95, sevBase: 93 },
  { semi: 9, gen: 6, tri: 'min', sev: 'm7', rn: 'vi', triBase: 85, sevBase: 62 },
  { semi: 11, gen: 7, tri: 'dim', sev: 'm7b5', rn: 'vii°', triBase: 30, sevBase: 38 },
]

const MINOR_DIATONIC = [
  { semi: 0, gen: 1, tri: 'min', sev: 'm7', rn: 'i', triBase: 96, sevBase: 70 },
  { semi: 2, gen: 2, tri: 'dim', sev: 'm7b5', rn: 'ii°', triBase: 42, sevBase: 66 },
  { semi: 3, gen: 3, tri: 'maj', sev: 'maj7', rn: '♭III', triBase: 74, sevBase: 60 },
  { semi: 5, gen: 4, tri: 'min', sev: 'm7', rn: 'iv', triBase: 86, sevBase: 70 },
  { semi: 7, gen: 5, tri: 'min', sev: 'm7', rn: 'v', triBase: 52, sevBase: 50 },
  { semi: 8, gen: 6, tri: 'maj', sev: 'maj7', rn: '♭VI', triBase: 76, sevBase: 58 },
  { semi: 10, gen: 7, tri: 'maj', sev: 'dom7', rn: '♭VII', triBase: 80, sevBase: 62 },
]

const genAdd = (gen, steps) => mod(gen - 1 + steps, 7) + 1

function degrees(key) {
  return key.mode === 'minor' ? MINOR_DIATONIC : MAJOR_DIATONIC
}

/** Build a chord on a scale degree of the key, spelled from the generic degree. */
export function at(key, semi, gen, qualityId, alts = [], bassSemi = null, bassGen = null) {
  const root = spellFrom(key.tonic, gen, semi)
  const bass = bassSemi === null ? null : spellFrom(key.tonic, bassGen ?? gen, bassSemi)
  return makeChord(root, qualityId, alts, bass)
}

// --- context analysis -------------------------------------------------------

/**
 * What does the previous chord want to happen next? Returns weighted target
 * pitch classes with the reason, which the scorer folds into every candidate.
 */
function expectations(prev, key) {
  if (!prev) return []
  const out = []
  const q = QUALITIES[prev.qualityId]
  const r = pcOf(prev.root)
  const push = (pc, weight, reason, quality = null) => out.push({ pc: mod(pc, 12), weight, reason, quality })

  if (q.family === 'dom' || prev.qualityId === 'sevenAlt') {
    push(r + 5, 34, 'resolves the previous dominant down a fifth, with its tritone pulling inward')
    push(r + 2, 13, 'takes the deceptive resolution a step above the expected target')
    push(r - 1, 11, 'resolves the previous dominant down a half step, tritone-sub style')
    push(r + 9, 10, 'lands on the submediant of the expected target instead — a deceptive cadence')
  }
  if (q.family === 'dim' && prev.qualityId === 'dim7') {
    push(r + 1, 30, 'sits a half step above the °7, which is exactly where a °7 wants to resolve')
    push(r + 4, 12, 'works because any tone of a symmetrical °7 can act as the leading tone')
    push(r + 7, 12, 'works because any tone of a symmetrical °7 can act as the leading tone')
    push(r + 10, 12, 'works because any tone of a symmetrical °7 can act as the leading tone')
  }
  if (prev.qualityId === 'm7b5' || prev.qualityId === 'dim') {
    push(r + 5, 26, 'is the V that the preceding ø7 sets up as a ii')
  }
  if (q.family === 'minor') {
    push(r + 5, 18, 'is the V that the preceding minor 7th points to as a ii')
    push(r + 10, 8, 'continues the stepwise fall of a whole tone')
  }
  if (q.family === 'sus') {
    push(r, 24, 'is where the suspension resolves — same root, 4th falling to 3rd')
    push(r + 5, 14, 'follows the 7sus4 the way a dominant would, down a fifth')
  }
  if (q.family === 'aug6') {
    push(r + 4, 32, 'is the dominant that the augmented sixth expands outward into')
  }
  if (q.family === 'major') {
    push(r + 7, 12, 'answers the previous chord plagally, up a fifth')
    push(r + 5, 10, 'continues the falling-fifth root motion')
  }
  return out
}

// An applied dominant ("AD") is dominant-functioning, but it points at its own
// target rather than at the key's tonic, so it gets its own row: the pull toward
// the right chord is supplied by the expectation bonus instead.
const FUNC_TABLE = {
  T: { T: 0.74, PD: 1.0, D: 0.92, AD: 0.92 },
  PD: { T: 0.52, PD: 0.66, D: 1.0, AD: 0.9 },
  D: { T: 1.0, PD: 0.34, D: 0.62, AD: 0.62 },
  AD: { T: 0.62, PD: 0.86, D: 0.95, AD: 0.7 },
}

/** Harmonic function as the scorer sees it, splitting out applied dominants. */
function contextFunction(chord, key) {
  const fn = harmonicFunction(chord, key)
  if (fn !== 'D') return fn
  const deg = mod(pcOf(chord.root) - pcOf(key.tonic), 12)
  const isOwnDominant = deg === 7 || deg === 11 || (key.mode === 'minor' && deg === 10)
  return isOwnDominant ? 'D' : 'AD'
}

// Bonus by ascending semitone distance between roots. Falling fifths (+5) win.
const ROOT_MOTION = {
  0: -8, 1: 2, 2: 8, 3: 2, 4: 0, 5: 14, 6: -10, 7: -2, 8: 2, 9: 6, 10: 6, 11: 3,
}

function voiceLeadingBonus(a, b) {
  const A = chordPcs(a)
  const B = chordPcs(b)
  if (!A.length || !B.length) return 0
  const common = B.filter((pc) => A.includes(pc)).length
  let total = 0
  for (const pc of B) {
    let best = 6
    for (const p of A) best = Math.min(best, Math.min(mod(pc - p, 12), mod(p - pc, 12)))
    total += best
  }
  const avg = total / B.length
  return (2.1 - avg) * 4.5 + common * 1.4
}

// --- generators -------------------------------------------------------------

function pushCand(list, chord, category, base, why, extra = {}) {
  if (!chord) return
  list.push({ chord, category, base, why, ...extra })
}

function genDiatonic(key, list) {
  const table = degrees(key)
  const minor = key.mode === 'minor'
  for (const d of table) {
    const tri = at(key, d.semi, d.gen, d.tri)
    pushCand(list, tri, 'diatonic', d.triBase,
      `${d.rn} is built entirely from notes of the key — the plainest way to keep the harmony inside ${key.mode === 'minor' ? 'the natural minor' : 'the major scale'}.`)
    const sev = at(key, d.semi, d.gen, d.sev)
    pushCand(list, sev, 'diatonic', d.sevBase,
      `The diatonic seventh on ${d.rn}. Adding the 7th thickens the chord without leaving the key${d.sev === 'dom7' ? ' — and the tritone inside it is what makes this the dominant' : ''}.`)
  }
  if (minor) {
    // Harmonic and melodic minor raise the 7th, which is where minor gets a real dominant.
    pushCand(list, at(key, 7, 5, 'maj'), 'diatonic', 88,
      'V major in minor comes from harmonic minor: raising ♯7 gives a true leading tone so the cadence pulls home.')
    pushCand(list, at(key, 7, 5, 'dom7'), 'diatonic', 90,
      'V7 in minor. The raised 7th supplies the leading tone and the tritone that resolves into i.')
    pushCand(list, at(key, 11, 7, 'dim7'), 'diatonic', 64,
      'vii°7 from harmonic minor — a rootless V7♭9 that leans hard onto the tonic.')
    pushCand(list, at(key, 7, 5, 'dom7', ['b9']), 'diatonic', 58,
      'V7♭9: the ♭9 is ♭6 of the key, so this is the most idiomatic dominant colour in minor.')
  }
}

function genExtensions(key, list) {
  const minor = key.mode === 'minor'
  const t = degrees(key)
  const scale = new Set(scalePcs(key))
  const inKey = (c) => chordNotes(c).every((e) => scale.has(pcOf(e.note)))

  const tryAdd = (semi, gen, quality, alts, base, why) => {
    const c = at(key, semi, gen, quality, alts)
    if (c && inKey(c)) pushCand(list, c, 'extension', base, why)
  }

  const I = t[0]
  const IV = t[3]
  const V = t[4]

  tryAdd(I.semi, 1, minor ? 'madd9' : 'add9', [], 58,
    'add9 keeps the triad intact and stacks the 9th on top — colour with no functional change, so it can go anywhere the plain chord goes.')
  tryAdd(IV.semi, 4, minor ? 'madd9' : 'add9', [], 52,
    'add9 on the subdominant. The 9th is a common tone with the tonic chord, so the move in and out is smooth.')
  if (!minor) {
    tryAdd(I.semi, 1, 'six', [], 50, 'The 6th replaces the leading-tone pull of maj7 with a softer, more open tonic — the default "resting" chord in swing and surf.')
    tryAdd(I.semi, 1, 'sixNine', [], 36, '6/9 is a tonic with no 7th at all: maximally stable, which is why it so often ends a jazz tune.')
    tryAdd(IV.semi, 4, 'maj11', [], 34, 'IV as lydian (♯11) — the ♯11 is the key\'s ♯4, borrowed from the parent scale of IV; it removes the clash the natural 11 makes with the 3rd.')
    tryAdd(I.semi, 1, 'maj9', [], 46, 'maj9 on the tonic: the 9th sits a whole step over the root and is fully diatonic, so it colours without destabilising.')
    tryAdd(t[1].semi, 2, 'm9', [], 52, 'ii9 — the standard jazz predominant. Every extension stays in the key.')
    tryAdd(t[1].semi, 2, 'm11', [], 46, 'ii11 stacks the 4th over the minor 3rd, which is consonant on a minor chord (unlike over a major one).')
  }
  tryAdd(V.semi, 5, 'sus4', [], 56,
    'Vsus4 delays the leading tone by a beat. The 4th above V is the tonic itself, so the suspension is a held-over common tone.')
  tryAdd(V.semi, 5, 'sevenSus4', [], 60,
    'V7sus4 — dominant weight without the 3rd. The tritone is gone, so it pushes forward but lands softer than V7.')
  tryAdd(V.semi, 5, 'dom9', [], 54, 'V9. The 9th is scale degree 2, fully diatonic, and adds shimmer over the dominant tritone.')
  tryAdd(V.semi, 5, 'dom13', [], 50, 'V13 — the 13th is scale degree 3, so the chord already contains the tonic triad\'s third. Very common in gospel and soul.')
  pushCand(list, at(key, V.semi, 5, 'dom7', ['b9']), 'extension', minor ? 62 : 44,
    'V7♭9. The ♭9 borrows ♭6 from the parallel minor and tightens the pull to the tonic.')
  pushCand(list, at(key, V.semi, 5, 'dom7', ['#9']), 'extension', 34,
    'V7♯9 — the "Hendrix" sound. ♯9 is the parallel-minor 3rd rubbing against the chord\'s major 3rd.')
  pushCand(list, at(key, V.semi, 5, 'sevenAlt'), 'extension', 30,
    'V7alt: every tension altered (♭9 ♯9 ♯11 ♭13). It comes from the melodic minor a half step above the root and is the strongest possible dominant tension.')
  pushCand(list, at(key, t[0].semi, 1, minor ? 'm6' : 'six', []), 'extension', minor ? 40 : 0,
    'i6 borrows the raised 6th of melodic/dorian minor — a brighter tonic that avoids the heaviness of i minor 7.')
}

function genSecondaryDominants(key, list) {
  const t = degrees(key)
  for (const d of t) {
    if (d.semi === 0) continue // V/I is just V
    if (d.tri === 'dim') continue // no tonicising a diminished triad
    const rootSemi = mod(d.semi + 7, 12)
    const gen = genAdd(d.gen, 4)
    const base = { 7: 78, 9: 70, 5: 62, 2: 66, 4: 48, 3: 60, 8: 58, 10: 56 }[d.semi] ?? 45
    pushCand(list, at(key, rootSemi, gen, 'dom7'), 'secondary', base,
      `V7/${d.rn} — a dominant seventh borrowed from the key of ${d.rn}. It raises ${d.rn}'s leading tone, tonicising ${d.rn} for one chord without actually changing key.`,
      { target: mod(d.semi, 12) })
    pushCand(list, at(key, rootSemi, gen, 'maj'), 'secondary', base - 16,
      `V/${d.rn} as a plain triad. Same tonicising function as V7/${d.rn} but gentler — no tritone, so the pull is suggestion rather than demand.`,
      { target: mod(d.semi, 12) })
    pushCand(list, at(key, rootSemi, gen, 'dom9'), 'secondary', base - 30,
      `V9/${d.rn}. The added 9th softens the applied dominant while keeping its tritone drive toward ${d.rn}.`,
      { target: mod(d.semi, 12) })
  }
}

function genSecondaryLeadingTone(key, list) {
  const t = degrees(key)
  for (const d of t) {
    if (d.semi === 0 || d.tri === 'dim') continue
    const rootSemi = mod(d.semi - 1, 12)
    const gen = genAdd(d.gen, -1)
    const base = { 7: 52, 9: 44, 2: 40, 5: 34, 4: 30, 3: 44, 8: 36, 10: 34 }[d.semi] ?? 28
    pushCand(list, at(key, rootSemi, gen, 'dim7'), 'secondaryLT', base,
      `vii°7/${d.rn} sits a half step under ${d.rn} and shares three notes with V7/${d.rn} — it is that dominant without its root, so it resolves upward by half step into ${d.rn}.`,
      { target: mod(d.semi, 12) })
    if (d.tri === 'maj') {
      pushCand(list, at(key, rootSemi, gen, 'm7b5'), 'secondaryLT', base - 12,
        `viiø7/${d.rn}. The half-diminished form is used when ${d.rn} is major, keeping the chord inside ${d.rn}'s major scale.`,
        { target: mod(d.semi, 12) })
    }
  }
}

function genRelatedII(key, list) {
  const t = degrees(key)
  for (const d of t) {
    if (d.tri === 'dim') continue
    const rootSemi = mod(d.semi + 2, 12)
    const gen = genAdd(d.gen, 1)
    const quality = d.tri === 'min' ? 'm7b5' : 'm7'
    const base = { 7: 56, 9: 44, 5: 40, 2: 42, 0: 34, 4: 30, 3: 40, 8: 36, 10: 34 }[d.semi] ?? 26
    const targetV = prettyName(spellFrom(key.tonic, genAdd(d.gen, 4), mod(d.semi + 7, 12)))
    pushCand(list, at(key, rootSemi, gen, quality), 'relatedII', base,
      `The related ii of ${d.rn}: this sets up ${targetV}7, so you get a full ii–V pointing at ${d.rn} instead of the bare applied dominant. ${quality === 'm7b5' ? 'It is half-diminished because ' + d.rn + ' is minor.' : ''}`,
      { target: mod(d.semi + 7, 12) })
  }
}

function genMixture(key, list) {
  if (key.mode === 'major') {
    pushCand(list, at(key, 5, 4, 'min'), 'mixture', 70,
      'iv borrowed from the parallel minor. Its ♭6 falls a half step to the 5th of the tonic — the classic "minor plagal" sigh after IV.')
    pushCand(list, at(key, 5, 4, 'm7'), 'mixture', 52,
      'iv7 from the parallel minor. Same ♭6 pull as iv, with the ♭7 setting up backdoor motion to I.')
    pushCand(list, at(key, 5, 4, 'm6'), 'mixture', 40,
      'iv6 — the added 6th is the key\'s 3rd, so it holds a common tone with the tonic while ♭6 leans downward.')
    pushCand(list, at(key, 10, 7, 'maj'), 'mixture', 68,
      '♭VII from the parallel minor (also the IV of IV). No leading tone, so it sounds modal rather than dominant — a staple of rock and folk.')
    pushCand(list, at(key, 8, 6, 'maj'), 'mixture', 62,
      '♭VI borrowed from parallel minor. It shares the tonic\'s root as its own 3rd, so the shift feels like a lighting change rather than a modulation.')
    pushCand(list, at(key, 8, 6, 'maj7'), 'mixture', 38,
      '♭VImaj7 — the same borrowed chord with a 7th that is the key\'s 5th, tying it back to home.')
    pushCand(list, at(key, 3, 3, 'maj'), 'mixture', 50,
      '♭III from parallel minor. It flattens the mediant, instantly darkening the mode while keeping the tonic as a common tone.')
    pushCand(list, at(key, 0, 1, 'min'), 'mixture', 38,
      'The parallel minor tonic. Same root, flattened 3rd — the most direct way to change the mode without changing the key centre.')
    pushCand(list, at(key, 2, 2, 'dim'), 'mixture', 38,
      'ii° borrowed from minor. Flattening the 6th turns the usual ii into a diminished predominant with extra pull to V.')
    pushCand(list, at(key, 2, 2, 'm7b5'), 'mixture', 46,
      'iiø7 — the minor-key predominant used in a major key. Extremely common as the first half of a minor ii–V.')
    pushCand(list, at(key, 7, 5, 'min'), 'mixture', 30,
      'v minor. Removing the leading tone drains the dominant of its pull; used for modal colour or to set up ♭VII.')
    pushCand(list, at(key, 10, 7, 'dom7'), 'backdoor', 42,
      '♭VII7 — the backdoor dominant. Its 3rd is the key\'s ♭6 and its ♭7 is ♭6 of the tonic chord, both resolving into the tonic major 3rd from above.')
    pushCand(list, at(key, 8, 6, 'dom7'), 'mixture', 22,
      '♭VI7. A dominant on the borrowed ♭6; usually heard on its way to ♭II or as a tritone sub of V/V.')
  } else {
    pushCand(list, at(key, 5, 4, 'maj'), 'mixture', 62,
      'IV major in a minor key — the dorian brightener. The raised 6th lifts the subdominant without touching the tonic.')
    pushCand(list, at(key, 0, 1, 'maj'), 'mixture', 40,
      'The Picardy third: ending a minor passage on a major tonic. Almost always a final or sectional arrival.')
    pushCand(list, at(key, 2, 2, 'maj'), 'mixture', 26,
      'II major in minor. The raised 3rd makes it a dominant of V — bright and unexpected against the minor context.')
    pushCand(list, at(key, 9, 6, 'min'), 'mixture', 30,
      'vi from the melodic minor / dorian side. Its raised 6th is the same note that makes IV major.')
    pushCand(list, at(key, 0, 1, 'mMaj7'), 'mixture', 28,
      'i(maj7) — melodic minor tonic. The natural 7th under a minor 3rd gives the "James Bond" tension.')
  }
}

function genTritoneSubs(key, list) {
  const t = degrees(key)
  for (const d of t) {
    if (d.tri === 'dim') continue
    const rootSemi = mod(d.semi + 1, 12)
    const gen = genAdd(d.gen, 1)
    const base = { 0: 48, 7: 38, 9: 28, 2: 30, 5: 24, 4: 20, 3: 30, 10: 22, 8: 24 }[d.semi] ?? 18
    pushCand(list, at(key, rootSemi, gen, 'dom7'), 'tritoneSub', base,
      `sub V7/${d.rn}: a dominant a tritone away from V7/${d.rn}. Both chords contain the same tritone, so it resolves to ${d.rn} just as strongly — but the bass slides down a half step instead of a fifth.`,
      { target: mod(d.semi, 12) })
    pushCand(list, at(key, rootSemi, gen, 'dom7', ['#11']), 'tritoneSub', base - 12,
      `sub V7♯11/${d.rn}. The ♯11 is the root of the dominant it replaces, which is why lydian-dominant is the default scale on a tritone sub.`,
      { target: mod(d.semi, 12) })
  }
}

function genNeapolitanAndAug6(key, list) {
  pushCand(list, at(key, 1, 2, 'maj', [], 5, 4), 'neapolitan', 36,
    'The Neapolitan sixth (♭II6): a major triad on ♭2, nearly always in first inversion so the bass keeps scale degree 4. It is a supercharged predominant heading to V.')
  pushCand(list, at(key, 1, 2, 'maj'), 'neapolitan', 26,
    '♭II in root position. Same borrowed ♭2 colour as the Neapolitan, used in rock and film harmony as a flat-side shock chord.')

  const fifthSemi = 7
  pushCand(list, at(key, 8, 6, 'it6'), 'aug6', 24,
    'Italian augmented sixth: ♭6 and ♯4 squeeze outward by half step onto the 5th, producing V. Three notes only, with the tonic doubled.')
  pushCand(list, at(key, 8, 6, 'fr6'), 'aug6', 22,
    'French augmented sixth: adds scale degree 2 to the Italian, giving a whole-tone shimmer. Still expands outward to V.')
  pushCand(list, at(key, 8, 6, 'ger6'), 'aug6', 28,
    'German augmented sixth: sounds identical to ♭VI7 but is spelled with an augmented 6th, so it expands to V (usually via a cadential 6/4) rather than resolving down a fifth.')
  void fifthSemi
}

function genChromaticMediants(key, prev, list) {
  const anchor = prev ?? { root: key.tonic }
  const base = pcOf(anchor.root)
  const anchorLetter = anchor.root.letter
  const moves = [
    { semi: 4, gen: 3, q: 'maj', why: 'a major third above', w: 26 },
    { semi: 8, gen: 6, q: 'maj', why: 'a major third below', w: 30 },
    { semi: 3, gen: 3, q: 'maj', why: 'a minor third above', w: 24 },
    { semi: 9, gen: 6, q: 'maj', why: 'a minor third below', w: 26 },
    { semi: 4, gen: 3, q: 'min', why: 'a major third above', w: 20 },
    { semi: 9, gen: 6, q: 'min', why: 'a minor third below', w: 20 },
  ]
  for (const m of moves) {
    const root = spellFrom({ letter: anchorLetter, acc: anchor.root.acc }, m.gen, m.semi)
    const chord = makeChord(root, m.q)
    if (!chord) continue
    const shared = chordPcs(chord).filter((pc) => chordPcs(anchor.root ? makeChord(anchor.root, anchor.qualityId ?? 'maj') : chord).includes(pc)).length
    pushCand(list, chord, 'mediant', m.w + shared * 3,
      `Chromatic mediant ${m.why} the current chord. Root motion by third with ${shared} common tone${shared === 1 ? '' : 's'} and a chromatic third relationship — it side-steps functional harmony entirely, which is why film and rock use it for a sudden change of light.`)
  }
  void base
}

function genPassing(key, list) {
  const t = degrees(key)
  const spots = key.mode === 'major'
    ? [
        { semi: 1, gen: 1, between: 'I and ii', w: 44 },
        { semi: 3, gen: 2, between: 'ii and iii', w: 38 },
        { semi: 6, gen: 4, between: 'IV and V', w: 46 },
        { semi: 8, gen: 5, between: 'V and vi', w: 30 },
      ]
    : [
        { semi: 1, gen: 1, between: 'i and ii°', w: 30 },
        { semi: 6, gen: 4, between: 'iv and V', w: 34 },
        { semi: 11, gen: 7, between: '♭VII and i', w: 40 },
      ]
  for (const s of spots) {
    pushCand(list, at(key, s.semi, s.gen, 'dim7'), 'passing', s.w,
      `Ascending passing diminished between ${s.between}. Every voice moves by half step into the next chord, so the °7 works as pure voice-leading glue rather than a functional harmony.`)
  }
  // Chromatic approach: a °7 a half step below whatever comes next.
  for (const d of t) {
    if (d.semi === 0) continue
    pushCand(list, at(key, mod(d.semi - 1, 12), genAdd(d.gen, -1), 'dim7'), 'passing', 22,
      `A °7 a half step under ${d.rn}, used as a chromatic approach chord. Because °7 is symmetrical it can be inserted almost anywhere and still resolve upward by half step.`)
  }
  pushCand(list, at(key, 0, 1, degrees(key)[0].tri, [], 7, 5), 'pedal', 40,
    'Cadential 6/4 — the tonic triad over the dominant bass. Heard as an ornamented V rather than a real tonic; the 6th and 4th fall to the 5th and 3rd over a held bass.')
}

/** Semitones above a degree's root to its own third — 3 for a minor triad, 4 otherwise. */
const thirdOf = (d) => (d.tri === 'min' || d.tri === 'dim' ? 3 : 4)

function genPedalAndSlash(key, list) {
  const t = degrees(key)
  const I = t[0]
  const IV = t[3]
  const minor = key.mode === 'minor'

  // In minor the useful first-inversion dominant is the harmonic-minor V major,
  // because that is the chord that actually has the leading tone in it.
  const vTri = minor ? 'maj' : t[4].tri
  const vThirdSemi = minor ? 11 : mod(t[4].semi + thirdOf(t[4]), 12)
  pushCand(list, at(key, t[4].semi, 5, vTri, [], vThirdSemi, 7), 'pedal', 56,
    'V in first inversion (V/7 in pop notation). The leading tone in the bass makes a stepwise descent from the tonic and on down to vi.')

  pushCand(list, at(key, I.semi, 1, I.tri, [], thirdOf(I), 3), 'pedal', 44,
    'Tonic in first inversion. Same chord, lighter arrival — used to keep a bass line moving rather than to mark a cadence.')
  pushCand(list, at(key, IV.semi, 4, IV.tri, [], 0, 1), 'pedal', 38,
    'Subdominant over a tonic pedal. Holding the tonic in the bass turns the chord change into colour rather than motion.')
  pushCand(list, at(key, 10, 7, 'maj', [], 0, 1), 'pedal', 30,
    '♭VII over a tonic pedal — a modal, suspended sound common in film and post-rock, since the bass never leaves home.')
  if (!minor) {
    pushCand(list, at(key, t[1].semi, 2, t[1].tri, [], 7, 5), 'pedal', 34,
      'ii over the dominant bass — functionally a V11. The bass is already on the dominant while the upper voices hold the predominant.')
  }
}

function genBackdoorAndColtrane(key, prev, list) {
  if (key.mode === 'major') {
    pushCand(list, at(key, 5, 4, 'm7'), 'backdoor', 40,
      'The backdoor ii: iv7 leading to ♭VII7 and then home. Both chords come from the parallel minor and approach the tonic from the flat side.')
  }
  if (!prev) return
  const r = pcOf(prev.root)
  const downMaj3 = mod(r - 4, 12)
  const rootDown = spellFrom(prev.root, 6, 8)
  pushCand(list, makeChord(rootDown, 'maj7'), 'coltrane', 16,
    'Thirds cycle (Coltrane changes): moving the tonal centre down a major third divides the octave into three equal parts. Each new centre is reached by its own V7, which is why "Giant Steps" changes key every two beats.')
  const vOfDown = spellFrom(prev.root, 3, 3)
  pushCand(list, makeChord(vOfDown, 'dom7'), 'coltrane', 14,
    'The V7 of the next centre in a major-thirds cycle. It sounds like a chromatic lurch because the target key is a major third away, not a fifth.')
  void downMaj3
}

function genConstantStructure(key, prev, list) {
  if (!prev) return
  const q = QUALITIES[prev.qualityId]
  const moves = [
    { gen: 2, semi: 2, why: 'up a whole step', w: 24 },
    { gen: 7, semi: 10, why: 'down a whole step', w: 24 },
    { gen: 3, semi: 3, why: 'up a minor third', w: 18 },
    { gen: 6, semi: 9, why: 'down a minor third', w: 18 },
    { gen: 2, semi: 1, why: 'up a half step', w: 16 },
  ]
  for (const m of moves) {
    const root = spellFrom(prev.root, m.gen, m.semi)
    pushCand(list, makeChord(root, prev.qualityId, prev.alterations), 'constant', m.w,
      `Constant structure: the same ${q.name} shape moved ${m.why}. The quality never changes, so the ear tracks the parallel motion instead of a functional root progression — a Bill Evans / McCoy Tyner device.`)
  }
}

const UPPER_STRUCTURES = [
  { semi: 2, gen: 2, q: 'maj', label: 'II', tones: '9, ♯11, 13', w: 22 },
  { semi: 8, gen: 6, q: 'maj', label: '♭VI', tones: '♭13, root, ♯9', w: 20 },
  { semi: 1, gen: 2, q: 'maj', label: '♭II', tones: '♭9, 11, ♭13', w: 18 },
  { semi: 3, gen: 3, q: 'maj', label: '♭III', tones: '♯9, 5, ♭7', w: 18 },
  { semi: 6, gen: 4, q: 'maj', label: '♯IV', tones: '♯11, ♭7, ♭9', w: 16 },
]

function genPolychords(key, prev, list) {
  const t = degrees(key)
  const V = t[4]
  const lower = at(key, V.semi, 5, 'dom7')
  for (const us of UPPER_STRUCTURES) {
    const upperRoot = spellFrom(lower.root, us.gen, us.semi)
    const upper = makeChord(upperRoot, us.q)
    pushCand(list, makePolychord(upper, lower), 'poly', us.w,
      `Upper-structure ${us.label} over V7: the triad supplies ${us.tones} above the dominant's root, 3rd and ♭7. Two simple shapes stacked give a dense altered dominant that is still easy to voice.`)
  }
  // A plain triad over a foreign bass — the pop polychord.
  pushCand(list, at(key, 2, 2, 'maj', [], 0, 1), 'poly', 28,
    'II major triad over the tonic bass. The bass note is not a chord tone of the triad, so the ear hears two layers at once — a lydian-flavoured polychord rather than a single stacked chord.')
  if (prev) {
    const upper = makeChord(spellFrom(prev.root, 2, 2), 'maj')
    pushCand(list, makePolychord(upper, prev), 'poly', 14,
      'Stacking a triad a whole step above the current chord\'s root keeps the existing harmony intact and adds a whole upper layer of tensions — the most common way to build a polychord from what is already sounding.')
  }
}

// --- scoring ----------------------------------------------------------------

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Returns the raw commonality, which may exceed 100. Ranking uses the raw value
 * so that chords which all "max out" still order sensibly; only the displayed
 * score and the tier are clamped.
 */
function scoreCandidate(cand, ctx) {
  const { key, prev, prev2, progression } = ctx
  let s = cand.base
  if (s <= 0) return 0

  if (!prev) {
    // Opening chord: strongly favour tonic and the other stable diatonic chords.
    const deg = mod(pcOf(cand.chord.root) - pcOf(key.tonic), 12)
    const openerBoost = { 0: 1.35, 9: 1.05, 5: 1.05, 7: 0.95, 2: 0.95 }[deg] ?? 0.72
    s *= openerBoost
    if (cand.category !== 'diatonic' && cand.category !== 'extension') s *= 0.65
    return Math.max(1, s)
  }

  s *= FUNC_TABLE[contextFunction(prev, key)][contextFunction(cand.chord, key)]
  s += ROOT_MOTION[mod(pcOf(cand.chord.root) - pcOf(prev.root), 12)] ?? 0
  s += voiceLeadingBonus(prev, cand.chord)

  for (const e of ctx.expect) {
    if (mod(pcOf(cand.chord.root) - 0, 12) !== e.pc) continue
    // A dominant's target is stronger when the candidate is a stable chord.
    const fam = QUALITIES[cand.chord.qualityId].family
    const stable = fam === 'major' || fam === 'minor' ? 1 : 0.55
    s += e.weight * stable
    cand.contextWhy = cand.contextWhy || e.reason
  }

  // Don't suggest the chord that is already sounding, and discourage bouncing.
  if (chordId(cand.chord) === chordId(prev)) s *= 0.04
  else if (pcOf(cand.chord.root) === pcOf(prev.root)) s *= 0.55
  if (prev2 && chordId(cand.chord) === chordId(prev2)) s *= 0.8

  // Phrase shape: the longer the progression runs, the more the ear wants a cadence.
  const len = progression.length
  const deg = mod(pcOf(cand.chord.root) - pcOf(key.tonic), 12)
  if (len >= 3) {
    if (deg === 7 && QUALITIES[cand.chord.qualityId].family === 'dom') s += 8
    if (deg === 0) s += 5
  }
  if (len >= 6 && deg === 0) s += 6

  return Math.max(1, s)
}

// --- public API -------------------------------------------------------------

/**
 * Rank every candidate next chord for the given key and progression.
 * `progression` is an array of chord objects (may be empty).
 */
export function suggestNext(key, progression = [], options = {}) {
  const prev = progression.length ? progression[progression.length - 1] : null
  const prev2 = progression.length > 1 ? progression[progression.length - 2] : null

  const list = []
  genDiatonic(key, list)
  genExtensions(key, list)
  genSecondaryDominants(key, list)
  genSecondaryLeadingTone(key, list)
  genRelatedII(key, list)
  genMixture(key, list)
  genTritoneSubs(key, list)
  genNeapolitanAndAug6(key, list)
  genPassing(key, list)
  genPedalAndSlash(key, list)
  genBackdoorAndColtrane(key, prev, list)
  if (options.includeAdvanced !== false) {
    genChromaticMediants(key, prev, list)
    genConstantStructure(key, prev, list)
    genPolychords(key, prev, list)
  }

  const ctx = { key, prev, prev2, progression, expect: expectations(prev, key) }

  // The same chord often arrives from several generators — Ab in C major is both
  // ♭VI from mixture and a chromatic mediant of the tonic. Keep the strongest
  // reading as the headline and carry the others as alternate explanations, so
  // no analytical category silently disappears from the list.
  const seen = new Map()
  for (const cand of list) {
    if (!cand.chord) continue
    const raw = scoreCandidate(cand, ctx)
    const score = clamp(raw, 1, 100)
    const id = chordId(cand.chord)
    const entry = {
      id,
      chord: cand.chord,
      symbol: chordSymbol(cand.chord),
      roman: romanNumeral(cand.chord, key),
      category: cand.category,
      categories: [cand.category],
      raw,
      score,
      tier: tierFor(score),
      why: cand.why,
      contextWhy: cand.contextWhy || null,
      alsoKnownAs: [],
    }
    const existing = seen.get(id)
    if (!existing) {
      seen.set(id, entry)
      continue
    }
    const [winner, loser] = existing.raw >= raw ? [existing, entry] : [entry, existing]
    winner.alsoKnownAs = [...existing.alsoKnownAs, ...entry.alsoKnownAs]
    if (loser.category !== winner.category && winner.alsoKnownAs.length < 3) {
      winner.alsoKnownAs.push({ category: loser.category, why: loser.why })
    }
    winner.categories = [...new Set([winner.category, ...winner.alsoKnownAs.map((a) => a.category)])]
    winner.contextWhy = winner.contextWhy || loser.contextWhy
    winner.tier = tierFor(winner.score)
    seen.set(id, winner)
  }

  return [...seen.values()].sort((a, b) => b.raw - a.raw)
}

/** Explain how a chord already in the progression functions in the key. */
export function analyzeChord(chord, key) {
  const roman = romanNumeral(chord, key)
  const fn = harmonicFunction(chord, key)
  const scale = new Set(scalePcs(key))
  const outside = chordNotes(chord).filter((e) => !scale.has(pcOf(e.note)))
  const fnLabel = { T: 'tonic', PD: 'predominant', D: 'dominant' }[fn]
  return {
    roman,
    fn,
    fnLabel,
    diatonic: outside.length === 0,
    outside: outside.map((e) => prettyName(e.note)),
  }
}
