// Chord vocabulary, symbol parsing, and spelling.
//
// A chord is stored as a root note plus a list of [genericDegree, semitones]
// pairs. Storing the generic degree (not just the semitone) is what lets the
// app spell C7#9 as C E G Bb D# rather than C E G Bb Eb.

import {
  mod,
  pcOf,
  noteName,
  prettyName,
  parseNote,
  spellFrom,
  midiAtOrAbove,
} from './notes.js'

const D = (...pairs) => pairs

// id -> definition. `sym` is the canonical suffix, `aliases` are accepted on input.
export const QUALITIES = {
  maj: { sym: '', aliases: ['maj', 'M', 'major', 'Δ'], name: 'major triad', degrees: D([1, 0], [3, 4], [5, 7]), family: 'major' },
  min: { sym: 'm', aliases: ['m', 'min', '-', 'minor'], name: 'minor triad', degrees: D([1, 0], [3, 3], [5, 7]), family: 'minor' },
  dim: { sym: '°', aliases: ['dim', 'o', '°', 'º'], name: 'diminished triad', degrees: D([1, 0], [3, 3], [5, 6]), family: 'dim' },
  aug: { sym: '+', aliases: ['aug', '+', '#5'], name: 'augmented triad', degrees: D([1, 0], [3, 4], [5, 8]), family: 'aug' },
  sus2: { sym: 'sus2', aliases: ['sus2'], name: 'suspended 2nd', degrees: D([1, 0], [2, 2], [5, 7]), family: 'sus' },
  sus4: { sym: 'sus4', aliases: ['sus4', 'sus'], name: 'suspended 4th', degrees: D([1, 0], [4, 5], [5, 7]), family: 'sus' },
  five: { sym: '5', aliases: ['5'], name: 'power chord', degrees: D([1, 0], [5, 7]), family: 'other' },
  six: { sym: '6', aliases: ['6'], name: 'major 6th', degrees: D([1, 0], [3, 4], [5, 7], [6, 9]), family: 'major' },
  m6: { sym: 'm6', aliases: ['m6', 'min6', '-6'], name: 'minor 6th', degrees: D([1, 0], [3, 3], [5, 7], [6, 9]), family: 'minor' },
  sixNine: { sym: '6/9', aliases: ['6/9', '69', '6add9'], name: '6/9', degrees: D([1, 0], [3, 4], [5, 7], [6, 9], [9, 14]), family: 'major' },
  m69: { sym: 'm6/9', aliases: ['m6/9', 'm69'], name: 'minor 6/9', degrees: D([1, 0], [3, 3], [5, 7], [6, 9], [9, 14]), family: 'minor' },
  maj7: { sym: 'maj7', aliases: ['maj7', 'M7', 'Δ7', 'Δ', 'ma7', 'j7'], name: 'major 7th', degrees: D([1, 0], [3, 4], [5, 7], [7, 11]), family: 'major' },
  dom7: { sym: '7', aliases: ['7', 'dom7'], name: 'dominant 7th', degrees: D([1, 0], [3, 4], [5, 7], [7, 10]), family: 'dom' },
  m7: { sym: 'm7', aliases: ['m7', 'min7', '-7'], name: 'minor 7th', degrees: D([1, 0], [3, 3], [5, 7], [7, 10]), family: 'minor' },
  mMaj7: { sym: 'mMaj7', aliases: ['mMaj7', 'mM7', 'minmaj7', '-Δ7', 'mΔ7'], name: 'minor-major 7th', degrees: D([1, 0], [3, 3], [5, 7], [7, 11]), family: 'minor' },
  m7b5: { sym: 'm7♭5', aliases: ['m7b5', 'ø7', 'ø', 'min7b5', '-7b5', 'halfdim'], name: 'half-diminished 7th', degrees: D([1, 0], [3, 3], [5, 6], [7, 10]), family: 'dim' },
  dim7: { sym: '°7', aliases: ['dim7', 'o7', '°7', 'º7'], name: 'diminished 7th', degrees: D([1, 0], [3, 3], [5, 6], [7, 9]), family: 'dim' },
  sevenSus4: { sym: '7sus4', aliases: ['7sus4', '7sus'], name: 'dominant 7 sus4', degrees: D([1, 0], [4, 5], [5, 7], [7, 10]), family: 'sus' },
  add9: { sym: 'add9', aliases: ['add9', 'add2'], name: 'added 9th', degrees: D([1, 0], [3, 4], [5, 7], [9, 14]), family: 'major' },
  madd9: { sym: 'madd9', aliases: ['madd9', 'm(add9)', '-add9'], name: 'minor added 9th', degrees: D([1, 0], [3, 3], [5, 7], [9, 14]), family: 'minor' },
  add11: { sym: 'add11', aliases: ['add11', 'add4'], name: 'added 11th', degrees: D([1, 0], [3, 4], [5, 7], [11, 17]), family: 'major' },
  maj9: { sym: 'maj9', aliases: ['maj9', 'M9', 'Δ9'], name: 'major 9th', degrees: D([1, 0], [3, 4], [5, 7], [7, 11], [9, 14]), family: 'major' },
  dom9: { sym: '9', aliases: ['9'], name: 'dominant 9th', degrees: D([1, 0], [3, 4], [5, 7], [7, 10], [9, 14]), family: 'dom' },
  m9: { sym: 'm9', aliases: ['m9', 'min9', '-9'], name: 'minor 9th', degrees: D([1, 0], [3, 3], [5, 7], [7, 10], [9, 14]), family: 'minor' },
  maj11: { sym: 'maj9♯11', aliases: ['maj9#11', 'M9#11', 'Δ9#11'], name: 'major 9 ♯11 (lydian)', degrees: D([1, 0], [3, 4], [5, 7], [7, 11], [9, 14], [11, 18]), family: 'major' },
  dom11: { sym: '11', aliases: ['11'], name: 'dominant 11th', degrees: D([1, 0], [5, 7], [7, 10], [9, 14], [11, 17]), family: 'dom' },
  m11: { sym: 'm11', aliases: ['m11', 'min11', '-11'], name: 'minor 11th', degrees: D([1, 0], [3, 3], [5, 7], [7, 10], [9, 14], [11, 17]), family: 'minor' },
  dom13: { sym: '13', aliases: ['13'], name: 'dominant 13th', degrees: D([1, 0], [3, 4], [5, 7], [7, 10], [9, 14], [13, 21]), family: 'dom' },
  maj13: { sym: 'maj13', aliases: ['maj13', 'M13', 'Δ13'], name: 'major 13th', degrees: D([1, 0], [3, 4], [5, 7], [7, 11], [9, 14], [13, 21]), family: 'major' },
  m13: { sym: 'm13', aliases: ['m13', 'min13', '-13'], name: 'minor 13th', degrees: D([1, 0], [3, 3], [5, 7], [7, 10], [9, 14], [13, 21]), family: 'minor' },
  sevenAlt: { sym: '7alt', aliases: ['7alt', 'alt'], name: 'altered dominant', degrees: D([1, 0], [3, 4], [7, 10], [9, 13], [9, 15], [13, 20]), family: 'dom' },
  // Augmented sixths are spelled from their ♭6 root; the +6 is a 6th, not a ♭7,
  // which is exactly why they pull outward to the dominant instead of resolving
  // down a fifth like a real dominant seventh.
  it6: { sym: '+6(It)', roman: 'It+6', aliases: ['it+6', 'it6'], name: 'Italian augmented 6th', degrees: D([1, 0], [3, 4], [6, 10]), family: 'aug6' },
  fr6: { sym: '+6(Fr)', roman: 'Fr+6', aliases: ['fr+6', 'fr6'], name: 'French augmented 6th', degrees: D([1, 0], [3, 4], [4, 6], [6, 10]), family: 'aug6' },
  ger6: { sym: '+6(Ger)', roman: 'Ger+6', aliases: ['ger+6', 'ger6'], name: 'German augmented 6th', degrees: D([1, 0], [3, 4], [5, 7], [6, 10]), family: 'aug6' },
}

// Alterations applied after the base quality, e.g. the "#11" in Cmaj7#11.
const ALTERATIONS = {
  b5: { deg: 5, semi: 6, label: '♭5' },
  '#5': { deg: 5, semi: 8, label: '♯5' },
  b9: { deg: 9, semi: 13, label: '♭9' },
  '#9': { deg: 9, semi: 15, label: '♯9' },
  '#11': { deg: 11, semi: 18, label: '♯11' },
  b13: { deg: 13, semi: 20, label: '♭13' },
  add9: { deg: 9, semi: 14, label: 'add9' },
  add11: { deg: 11, semi: 17, label: 'add11' },
  add13: { deg: 13, semi: 21, label: 'add13' },
  b6: { deg: 6, semi: 8, label: '♭6' },
}

// Longest-first so "maj7" wins over "maj" and "m7b5" over "m7".
const ALIAS_TABLE = Object.entries(QUALITIES)
  .flatMap(([id, q]) => q.aliases.map((a) => ({ id, alias: a })))
  .sort((a, b) => b.alias.length - a.alias.length)

const ALT_KEYS = Object.keys(ALTERATIONS).sort((a, b) => b.length - a.length)

function normalizeInput(s) {
  return String(s)
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '')
}

/**
 * Build a chord object. `degrees` are deduped by generic degree so an
 * alteration replaces the natural tone it targets (b5 replaces 5).
 */
export function makeChord(root, qualityId, extraAlterations = [], bass = null, opts = {}) {
  const q = QUALITIES[qualityId]
  if (!q) return null
  let degrees = q.degrees.map((d) => [...d])
  const altLabels = []

  for (const key of extraAlterations) {
    const alt = ALTERATIONS[key]
    if (!alt) continue
    // "add" tones stack; true alterations replace the natural degree.
    if (key.startsWith('add')) {
      if (!degrees.some((d) => d[0] === alt.deg && d[1] === alt.semi)) degrees.push([alt.deg, alt.semi])
    } else {
      degrees = degrees.filter((d) => d[0] !== alt.deg)
      degrees.push([alt.deg, alt.semi])
    }
    altLabels.push(alt.label)
  }

  degrees.sort((a, b) => a[1] - b[1] || a[0] - b[0])

  return {
    root,
    qualityId,
    alterations: extraAlterations,
    altLabels,
    degrees,
    bass: bass && pcOf(bass) !== pcOf(root) ? bass : null,
    poly: opts.poly || null,
  }
}

/** Parse a chord symbol such as "F#m7b5", "Cmaj7#11/E", "Bb7alt", "D/C". */
export function parseChord(input) {
  const s = normalizeInput(input)
  if (!s) return null

  // Polychord notation: "D|C7" or "D over C7" -> upper triad on lower chord.
  const polyMatch = /^(.+?)\|(.+)$/.exec(s)
  if (polyMatch) {
    const upper = parseChord(polyMatch[1])
    const lower = parseChord(polyMatch[2])
    if (!upper || !lower) return null
    return makePolychord(upper, lower)
  }

  // Slash bass. Careful: "6/9" is a quality, not a slash chord.
  let body = s
  let bass = null
  const slash = s.lastIndexOf('/')
  if (slash > 0) {
    const tail = s.slice(slash + 1)
    const maybeBass = parseNote(tail)
    if (maybeBass && !/^\d/.test(tail)) {
      bass = maybeBass
      body = s.slice(0, slash)
    }
  }

  const rootMatch = /^([A-Ga-g])((?:#|b|x)*)/.exec(body)
  if (!rootMatch) return null
  const root = parseNote(rootMatch[0])
  if (!root) return null

  let rest = body.slice(rootMatch[0].length)

  // Parenthesised extensions are just noise for the parser: Cmaj7(#11) == Cmaj7#11
  rest = rest.replace(/[()]/g, '')

  // Case matters in chord symbols — "m7" and "M7" are different chords — so
  // match case-sensitively first and only fall back to a loose match for input
  // like "CMAJ7" that no case-sensitive alias covers.
  let qualityId = null
  const matchAlias = (caseSensitive) => {
    for (const { id, alias } of ALIAS_TABLE) {
      const hit = caseSensitive
        ? rest.startsWith(alias)
        : rest.toLowerCase().startsWith(alias.toLowerCase())
      if (!hit) continue
      // Guard against a bare "m" swallowing the m of "major".
      if (alias.toLowerCase() === 'm' && /^ma/i.test(rest)) continue
      rest = rest.slice(alias.length)
      return id
    }
    return null
  }
  qualityId = matchAlias(true) ?? matchAlias(false) ?? 'maj'

  const alterations = []
  let guard = 0
  while (rest.length && guard++ < 8) {
    const hit = ALT_KEYS.find((k) => rest.toLowerCase().startsWith(k.toLowerCase()))
    if (!hit) break
    alterations.push(hit)
    rest = rest.slice(hit.length)
  }
  if (rest.length) return null // trailing garbage -> not a chord

  return makeChord(root, qualityId, alterations, bass)
}

export function makePolychord(upper, lower) {
  const chord = makeChord(lower.root, lower.qualityId, lower.alterations, lower.bass, {
    poly: { upper, lower },
  })
  return chord
}

/** Canonical display symbol. */
export function chordSymbol(chord, { pretty = true } = {}) {
  if (!chord) return ''
  if (chord.poly) {
    return `${chordSymbol(chord.poly.upper, { pretty })} | ${chordSymbol(chord.poly.lower, { pretty })}`
  }
  const name = pretty ? prettyName(chord.root) : noteName(chord.root)
  const q = QUALITIES[chord.qualityId]
  const alts = chord.altLabels?.join('') ?? ''
  const bass = chord.bass ? '/' + (pretty ? prettyName(chord.bass) : noteName(chord.bass)) : ''
  return name + q.sym + alts + bass
}

/** Plain-ASCII symbol, safe for URLs and re-parsing. */
export function chordId(chord) {
  const q = chord && QUALITIES[chord.qualityId]
  if (!q) return ''
  if (chord.poly) return `${chordId(chord.poly.upper)}|${chordId(chord.poly.lower)}`
  const sym = chord.qualityId === 'maj' ? '' : q.aliases[0]
  const alts = (chord.alterations || []).join('')
  const bass = chord.bass ? '/' + noteName(chord.bass) : ''
  return noteName(chord.root) + sym + alts + bass
}

export function chordName(chord) {
  if (!chord) return ''
  if (chord.poly) {
    return `${chordSymbol(chord.poly.upper)} triad over ${chordSymbol(chord.poly.lower)}`
  }
  return `${prettyName(chord.root)} ${QUALITIES[chord.qualityId].name}`
}

/** Spelled notes of the chord, low degree to high, root-position order. */
export function chordNotes(chord) {
  if (!chord) return []
  const base = chord.degrees.map(([deg, semi]) => ({
    note: spellFrom(chord.root, deg, semi),
    degree: deg,
    semi,
  }))
  if (chord.poly) {
    const upper = chord.poly.upper
    const lowerPcs = new Set(base.map((b) => pcOf(b.note)))
    for (const [deg, semi] of upper.degrees) {
      const note = spellFrom(upper.root, deg, semi)
      if (lowerPcs.has(pcOf(note))) continue
      // Describe the upper-structure tone by its function over the lower root.
      const semiFromLower = mod(pcOf(note) - pcOf(chord.root), 12)
      base.push({ note, degree: upperDegreeLabel(semiFromLower), semi: semiFromLower, upper: true })
    }
  }
  return base
}

function upperDegreeLabel(semi) {
  const map = { 1: 9, 2: 9, 3: 9, 4: 3, 5: 11, 6: 11, 7: 5, 8: 13, 9: 13, 10: 7, 11: 7 }
  return map[semi] ?? 1
}

export function chordPcs(chord) {
  return chordNotes(chord).map((n) => pcOf(n.note))
}

/** Human label for a chord tone: R, 3, ♭7, ♯11… */
export function degreeLabel(entry, chord) {
  const { degree, semi } = entry
  if (degree === 1) return 'R'
  const natural = { 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 }[degree]
  if (natural === undefined) return String(degree)
  let diff = semi - natural
  while (diff > 6) diff -= 12
  while (diff < -6) diff += 12
  const acc = diff === 0 ? '' : diff > 0 ? '♯'.repeat(diff) : '♭'.repeat(-diff)
  return acc + degree
}

/**
 * Voice a chord as MIDI notes. `inversion` rotates the stack; the bass note of
 * a slash chord always wins and is placed underneath.
 */
export function voiceChord(chord, { inversion = 0, bottom = 48, spread = false } = {}) {
  const entries = chordNotes(chord)
  if (!entries.length) return []
  const pcs = entries.map((e) => pcOf(e.note))

  const inv = ((inversion % pcs.length) + pcs.length) % pcs.length
  const order = [...pcs.slice(inv), ...pcs.slice(0, inv)]

  const out = []
  let cursor = bottom
  for (const pc of order) {
    const m = midiAtOrAbove(pc, cursor)
    out.push(m)
    cursor = m + (spread ? 4 : 1)
  }

  if (chord.bass) {
    const bassPc = pcOf(chord.bass)
    const bassMidi = midiAtOrAbove(bassPc, bottom - 12)
    return [bassMidi, ...out.filter((m) => m !== bassMidi)]
  }
  return out
}

export function inversionCount(chord) {
  return chordNotes(chord).length
}

/**
 * Which note is actually sounding in the bass, and where it sits in the chord.
 *
 * An explicit slash bass wins over the inversion index: D/F♯ has F♯ in the bass
 * whatever `inversion` happens to be set to, because the symbol says so and
 * voiceChord puts it there. Reading the bass off `notes[inversion]` instead is
 * how the readouts came to call D/F♯ "root position — D in the bass".
 *
 * A bass that is not a chord tone at all — the D under C/D, or the lower root of
 * a polychord — gets `index: -1` rather than being forced onto a chord tone.
 */
export function bassOf(chord, inversion = 0) {
  const notes = chordNotes(chord)
  const n = notes.length
  if (!n) return { note: null, index: -1, isChordTone: false, fromSymbol: false }
  if (chord?.bass) {
    const index = notes.findIndex((e) => pcOf(e.note) === pcOf(chord.bass))
    return { note: chord.bass, index, isChordTone: index >= 0, fromSymbol: true }
  }
  const i = ((inversion % n) + n) % n
  return { note: notes[i].note, index: i, isChordTone: true, fromSymbol: false }
}

const INVERSION_NAMES = [
  'root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion', '5th inversion',
]

/** How an inversion is described in words, e.g. "1st inversion — F♯ in the bass". */
export function inversionLabel(chord, inversion) {
  const { note, index, isChordTone } = bassOf(chord, inversion)
  if (!note) return ''
  if (!isChordTone) return `${prettyName(note)} in the bass — below the chord, not one of its tones`
  return `${INVERSION_NAMES[index] ?? `${index}th inversion`} — ${prettyName(note)} in the bass`
}

/** The short form used on a chip: "root pos.", "1st inv", "F♯ bass". */
export function inversionShort(chord, inversion) {
  const { note, index, isChordTone } = bassOf(chord, inversion)
  if (!note) return ''
  if (!isChordTone) return `${prettyName(note)} bass`
  return index === 0 ? 'root pos.' : `${['1st', '2nd', '3rd', '4th', '5th'][index - 1] ?? `${index}th`} inv`
}

/** Figured-bass shorthand shown next to roman numerals. */
export function figuredBass(chord, inversion) {
  const n = chordNotes(chord).length
  const i = ((inversion % n) + n) % n
  if (i === 0) return ''
  if (n <= 3) return ['', '6', '6/4'][i] ?? ''
  return ['', '6/5', '4/3', '4/2'][i] ?? ''
}
