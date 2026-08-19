// Guitar voicing search.
//
// Rather than shipping a chord dictionary, shapes are searched for: every
// combination of open/fretted/muted strings inside a four-fret window is tested
// against the chord's pitch classes, then filtered for playability and ranked.

import { mod, pcOf, midiToPc } from './notes.js'
import { QUALITIES, chordNotes } from './chords.js'

/**
 * Tunings, low string first, as MIDI numbers.
 *
 * Grouped so the picker can show them under headings — the list is long enough
 * now that a flat one is hard to scan. Nothing here assumes six strings: the
 * voicing search, the neck and the chord boxes all read `tuning.length`.
 */
export const TUNINGS = {
  standard: { name: 'Standard (EADGBE)', group: 'Standard', strings: [40, 45, 50, 55, 59, 64] },
  halfStepDown: { name: 'E♭ standard (E♭A♭D♭G♭B♭E♭)', group: 'Standard', strings: [39, 44, 49, 54, 58, 63] },
  wholeStepDown: { name: 'D standard (DGCFAD)', group: 'Standard', strings: [38, 43, 48, 53, 57, 62] },
  cStandard: { name: 'C standard (CFB♭E♭GC)', group: 'Standard', strings: [36, 41, 46, 51, 55, 60] },

  dropD: { name: 'Drop D (DADGBE)', group: 'Dropped', strings: [38, 45, 50, 55, 59, 64] },
  doubleDropD: { name: 'Double drop D (DADGBD)', group: 'Dropped', strings: [38, 45, 50, 55, 59, 62] },
  dropCsharp: { name: 'Drop C♯ (C♯G♯C♯F♯A♯D♯)', group: 'Dropped', strings: [37, 44, 49, 54, 58, 63] },
  dropC: { name: 'Drop C (CGCFAD)', group: 'Dropped', strings: [36, 43, 48, 53, 57, 62] },
  dropB: { name: 'Drop B (BF♯BEG♯C♯)', group: 'Dropped', strings: [35, 42, 47, 52, 56, 61] },

  openG: { name: 'Open G (DGDGBD)', group: 'Open', strings: [38, 43, 50, 55, 59, 62] },
  openD: { name: 'Open D (DADF♯AD)', group: 'Open', strings: [38, 45, 50, 54, 57, 62] },
  openE: { name: 'Open E (EBEG♯BE)', group: 'Open', strings: [40, 47, 52, 56, 59, 64] },
  openC: { name: 'Open C (CGCGCE)', group: 'Open', strings: [36, 43, 48, 55, 60, 64] },
  openA: { name: 'Open A (EAEAC♯E)', group: 'Open', strings: [40, 45, 52, 57, 61, 64] },
  openDminor: { name: 'Open Dm (DADFAD)', group: 'Open', strings: [38, 45, 50, 53, 57, 62] },

  dadgad: { name: 'DADGAD', group: 'Modal', strings: [38, 45, 50, 55, 57, 62] },
  cgdgcd: { name: 'Orkney (CGDGCD)', group: 'Modal', strings: [36, 43, 50, 55, 60, 62] },

  sevenString: { name: '7-string (BEADGBE)', group: 'Extended range', strings: [35, 40, 45, 50, 55, 59, 64] },
  sevenDropA: { name: '7-string drop A (AEADGBE)', group: 'Extended range', strings: [33, 40, 45, 50, 55, 59, 64] },
  eightString: { name: '8-string (F♯BEADGBE)', group: 'Extended range', strings: [30, 35, 40, 45, 50, 55, 59, 64] },
  baritone: { name: 'Baritone B (BEADF♯B)', group: 'Extended range', strings: [35, 40, 45, 50, 54, 59] },
  bassFour: { name: 'Bass, 4-string (EADG)', group: 'Extended range', strings: [28, 33, 38, 43] },
}

/** The id used to stamp a pinned shape. */
export const CUSTOM_TUNING = 'custom'
export const MIN_STRINGS = 4
export const MAX_STRINGS = 8
/** Playable range for a string: low B on an 8-string up to a high A. */
export const MIN_STRING_MIDI = 24
export const MAX_STRING_MIDI = 76

/**
 * A stable identity for whatever tuning is in force.
 *
 * A pinned shape is only meaningful against the exact strings it was found on,
 * so a custom tuning's key has to be its notes — otherwise editing one string
 * would silently keep every shape pinned under the old one. Underscores, not
 * colons: encodeShape separates the tuning from the frets with a colon.
 */
export function tuningKey(tuningId, strings) {
  if (tuningId !== CUSTOM_TUNING) return tuningId
  return `${CUSTOM_TUNING}_${(strings ?? []).join('_')}`
}

/** Clamp a proposed custom tuning into something playable. */
export function normaliseTuning(strings) {
  const out = (Array.isArray(strings) ? strings : [])
    .map((m) => Math.round(Number(m)))
    .filter((m) => Number.isFinite(m))
    .map((m) => Math.min(MAX_STRING_MIDI, Math.max(MIN_STRING_MIDI, m)))
    .slice(0, MAX_STRINGS)
  while (out.length < MIN_STRINGS) out.push(out.length ? out[out.length - 1] + 5 : 40)
  return out
}

export const FRET_COUNT = 15
const MAX_SPAN = 3 // four-fret reach

/** Which chord tone (if any) sounds at this string+fret, given the chord. */
export function toneAt(stringMidi, fret, toneByPc) {
  return toneByPc.get(mod(stringMidi + fret, 12)) ?? null
}

export function toneMap(chord) {
  const map = new Map()
  for (const entry of chordNotes(chord)) {
    const pc = pcOf(entry.note)
    if (!map.has(pc)) map.set(pc, entry)
  }
  return map
}

/** Tones the voicing must contain to still be the chord. */
function essentialPcs(chord) {
  const entries = chordNotes(chord)
  const need = []
  for (const e of entries) {
    const isRoot = e.degree === 1
    const isThird = e.degree === 3 || e.degree === 2 || e.degree === 4
    const isSeventh = e.degree === 7
    const isSixth = e.degree === 6
    if (isRoot || isThird || isSeventh || isSixth) need.push(pcOf(e.note))
  }
  // Power chords and quartal shapes have no third; fall back to everything.
  return need.length ? [...new Set(need)] : [...new Set(entries.map((e) => pcOf(e.note)))]
}

/**
 * Search playable shapes.
 * @returns array of { frets:[6] (null = muted), midis, bassPc, score, span, position, fingers, barre }
 */
export function findVoicings(chord, {
  tuning = TUNINGS.standard.strings,
  bassPc = null,
  limit = 12,
  maxFret = FRET_COUNT,
} = {}) {
  if (!chord) return []
  const tones = toneMap(chord)
  const chordPcs = new Set(tones.keys())
  const need = essentialPcs(chord)
  const nStrings = tuning.length
  const results = []
  const seen = new Set()

  for (let win = 0; win <= maxFret - MAX_SPAN; win++) {
    const options = tuning.map((open) => {
      const opts = [null] // muted
      if (chordPcs.has(mod(open, 12))) opts.push(0)
      for (let f = Math.max(1, win); f <= win + MAX_SPAN && f <= maxFret; f++) {
        if (chordPcs.has(mod(open + f, 12))) opts.push(f)
      }
      return opts
    })

    const frets = new Array(nStrings).fill(null)
    const walk = (i) => {
      if (i === nStrings) {
        const shape = evaluate(frets, tuning, need, bassPc, chord)
        if (shape) {
          const key = frets.map((f) => (f === null ? 'x' : f)).join('-')
          if (!seen.has(key)) {
            seen.add(key)
            results.push(shape)
          }
        }
        return
      }
      for (const f of options[i]) {
        frets[i] = f
        walk(i + 1)
      }
      frets[i] = null
    }
    walk(0)
  }

  results.sort((a, b) => b.score - a.score)
  const distinct = dropSubsetShapes(results)
  const chosen = diversify(distinct, limit)
  // How many distinct grips exist in total, so the UI can say what it is hiding.
  chosen.total = distinct.length
  return chosen
}

/**
 * Drop shapes that are just a higher-scoring shape with strings left out.
 * x32010 and x320x0 are the same grip; showing both wastes a slot.
 */
function dropSubsetShapes(sorted) {
  const kept = []
  const keys = []
  for (const shape of sorted) {
    const pairs = new Set(shape.sounding.map((s) => `${s}:${shape.frets[s]}`))
    if (keys.some((k) => isSubset(pairs, k))) continue
    kept.push(shape)
    keys.push(pairs)
  }
  return kept
}

function isSubset(small, big) {
  if (small.size > big.size) return false
  for (const v of small) if (!big.has(v)) return false
  return true
}

/**
 * Greedy selection that spreads the results along the neck. Ranking by score
 * alone buries every barre and CAGED shape, because the scorer prefers low
 * positions and open strings — so each repeat of a position pays a penalty.
 */
function diversify(sorted, limit) {
  const pool = [...sorted]
  const chosen = []
  const seenAtPosition = new Map()

  while (chosen.length < limit && pool.length) {
    let bestIndex = 0
    let bestValue = -Infinity
    for (let i = 0; i < pool.length; i++) {
      const repeats = seenAtPosition.get(pool[i].position) ?? 0
      const value = pool[i].score - repeats * 10
      if (value > bestValue) {
        bestValue = value
        bestIndex = i
      }
    }
    const [pick] = pool.splice(bestIndex, 1)
    chosen.push(pick)
    seenAtPosition.set(pick.position, (seenAtPosition.get(pick.position) ?? 0) + 1)
  }
  return chosen
}

function evaluate(fretsIn, tuning, need, bassPc, chord) {
  const frets = [...fretsIn]
  const sounding = []
  for (let i = 0; i < frets.length; i++) if (frets[i] !== null) sounding.push(i)
  if (sounding.length < 3) return null

  const fretted = sounding.filter((i) => frets[i] > 0).map((i) => frets[i])
  const minF = fretted.length ? Math.min(...fretted) : 0
  const maxF = fretted.length ? Math.max(...fretted) : 0
  if (fretted.length && maxF - minF > MAX_SPAN) return null

  // Open strings only mix with low positions; an open string next to fret 9 is a stretch.
  const hasOpen = sounding.some((i) => frets[i] === 0)
  if (hasOpen && maxF > 5) return null

  // Muted strings should sit at the edges; one interior mute is idiomatic, more is not.
  const first = sounding[0]
  const last = sounding[sounding.length - 1]
  let interiorMutes = 0
  for (let i = first; i <= last; i++) if (frets[i] === null) interiorMutes++
  if (interiorMutes > 1) return null

  const midis = sounding.map((i) => tuning[i] + frets[i])
  const pcs = midis.map(midiToPc)
  const lowestPc = midiToPc(Math.min(...midis))
  if (bassPc !== null && lowestPc !== mod(bassPc, 12)) return null
  for (const pc of need) if (!pcs.includes(pc)) return null

  if (!reachable(frets)) return null

  // Two ways to make a grip, and a shape is playable if either works.
  //
  // One finger per note: simplest, but capped at four fingers. Open A (x02220)
  // is this — three fingers at the same fret, no barre involved, so the open
  // strings ring fine.
  //
  // Or barre the lowest fret and finger the rest: that costs one finger for
  // however many notes sit at minF, which is the only way to play Bb (x13331)
  // or F (133211) — but the barre lies across every string in its span, so no
  // open string underneath it can sound.
  const notesAtMin = fretted.filter((f) => f === minF).length
  const openFingering = fretted.length <= 4 ? fretted.length : null
  const barrePossible = minF > 0 && notesAtMin >= 2 && !hasOpen
  const barreFingering = barrePossible ? 1 + fretted.filter((f) => f > minF).length : null
  const barreUsable = barreFingering !== null && barreFingering <= 4

  if (openFingering === null && !barreUsable) return null

  // Only call it a barre when the shape actually needs one.
  const barre = openFingering === null && barreUsable
  const fingerCount = barre ? barreFingering : openFingering

  const span = fretted.length ? maxF - minF : 0
  const position = fretted.length ? minF : 0
  const openCount = sounding.filter((i) => frets[i] === 0).length
  const uniquePcs = new Set(pcs).size
  const allTones = new Set(chordNotes(chord).map((e) => pcOf(e.note)))
  const coverage = [...allTones].filter((pc) => pcs.includes(pc)).length / allTones.size

  let score = 40
  // Weighted so a full six-string grip beats a thin one with a hole in the
  // middle: a two-finger shape with an interior mute is easy to play but it is
  // not the voicing a player means by the chord's name.
  score += sounding.length * 6
  score += openCount * 4
  score += coverage * 22
  score += uniquePcs * 2
  score -= span * 4
  score -= position * 1.1
  score -= interiorMutes * 14
  score -= Math.max(0, fingerCount - 3) * 5
  if (barre) score -= 3
  // A grip that sounds every string, whatever the instrument has — this used to
  // be hardcoded to six, so on a 7- or 8-string the bonus could never be earned
  // and on a bass it was unreachable too.
  if (sounding.length === frets.length) score += 4

  return { frets, midis, sounding, bassPc: lowestPc, score, span, position, fingers: fingerCount, barre, coverage }
}

/**
 * Reject grips where one fret has to be stopped twice by different fingers
 * reaching backwards. If the same fret appears on two non-adjacent strings and
 * the strings between them contain both an open string (so a barre would mute
 * it) and a higher fret (so the second finger has to come from behind the ones
 * already further up the neck), no hand can make the shape.
 *
 * The two conditions have to hold together: open G (320003) has fret 3 twice
 * with open strings between and is perfectly ordinary, because nothing between
 * them is fretted higher.
 */
function reachable(frets) {
  const positions = new Map()
  for (let i = 0; i < frets.length; i++) {
    const f = frets[i]
    if (f === null || f === 0) continue
    if (!positions.has(f)) positions.set(f, [])
    positions.get(f).push(i)
  }

  for (const [fret, strings] of positions) {
    if (strings.length < 2) continue
    const lo = strings[0]
    const hi = strings[strings.length - 1]
    if (hi - lo < 2) continue // adjacent, one finger covers both
    let hasOpenBetween = false
    let hasHigherBetween = false
    for (let k = lo + 1; k < hi; k++) {
      if (frets[k] === 0) hasOpenBetween = true
      else if (frets[k] !== null && frets[k] > fret) hasHigherBetween = true
    }
    if (hasOpenBetween && hasHigherBetween) return false
  }
  return true
}

/** Short human label for a shape: "open", "barre, 5th position", etc. */
export function voicingLabel(shape) {
  const openCount = shape.frets.filter((f) => f === 0).length
  const bits = []
  if (shape.position === 0 && openCount) bits.push('open')
  else bits.push(`${ordinal(shape.position)} position`)
  if (shape.barre) bits.push('barre')
  bits.push(`${shape.fingers} finger${shape.fingers === 1 ? '' : 's'}`)
  return bits.join(' · ')
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** Every position of every chord tone across the neck, for the map view. */
export function fretboardMap(chord, tuning = TUNINGS.standard.strings, maxFret = FRET_COUNT) {
  const tones = toneMap(chord)
  const rows = []
  for (let s = 0; s < tuning.length; s++) {
    const row = []
    for (let f = 0; f <= maxFret; f++) {
      const entry = tones.get(mod(tuning[s] + f, 12))
      row.push(entry ? { ...entry, midi: tuning[s] + f } : null)
    }
    rows.push(row)
  }
  return rows
}

export { QUALITIES }

// --- storing a chosen shape --------------------------------------------------
//
// A shape is only meaningful against the tuning it was found in, so the tuning
// id travels with it. Anything stored under a different tuning is ignored rather
// than drawn wrong.

export function encodeShape(shape, tuningId) {
  if (!shape) return null
  return `${tuningId}:${shape.frets.map((f) => (f === null ? 'x' : f)).join('-')}`
}

export function decodeShape(encoded, tuningId) {
  if (!encoded) return null
  const [storedTuning, frets] = String(encoded).split(':')
  if (!frets || storedTuning !== tuningId) return null
  const parsed = frets.split('-').map((f) => (f === 'x' ? null : parseInt(f, 10)))
  if (parsed.some((f) => f !== null && !Number.isInteger(f))) return null
  return parsed
}

/** Rebuild a full shape record from stored frets, for drawing and playback. */
export function shapeFromFrets(frets, tuning) {
  if (!frets || frets.length !== tuning.length) return null
  const sounding = []
  for (let i = 0; i < frets.length; i++) if (frets[i] !== null) sounding.push(i)
  if (!sounding.length) return null
  const fretted = sounding.filter((i) => frets[i] > 0).map((i) => frets[i])
  const minF = fretted.length ? Math.min(...fretted) : 0
  const maxF = fretted.length ? Math.max(...fretted) : 0
  const notesAtMin = fretted.filter((f) => f === minF).length
  const hasOpen = sounding.some((i) => frets[i] === 0)
  const barre = fretted.length > 4 && minF > 0 && notesAtMin >= 2 && !hasOpen
  return {
    frets,
    sounding,
    midis: sounding.map((i) => tuning[i] + frets[i]),
    bassPc: mod(Math.min(...sounding.map((i) => tuning[i] + frets[i])), 12),
    span: fretted.length ? maxF - minF : 0,
    position: fretted.length ? minF : 0,
    fingers: barre ? 1 + fretted.filter((f) => f > minF).length : fretted.length,
    barre,
    score: 0,
  }
}
