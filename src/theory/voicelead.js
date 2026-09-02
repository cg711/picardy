// Choosing inversions so a progression moves as little as possible.
//
// The same metric the suggestion engine uses to judge how smoothly one chord
// leads to another, applied here as a search: pick the inversion of each chord
// that keeps the voices closest to the chord before it.

import { chordNotes, voiceChord, chordSymbol } from './chords.js'
import { mod, pcOf } from './notes.js'

/** The simple interval between two pitches, octaves collapsed. */
const simple = (lo, hi) => mod(hi - lo, 12)

/**
 * Parallel fifths and octaves between two voiced chords.
 *
 * Shared by the fault report and by the inversion search, so that the thing the
 * app warns about and the thing it optimises away cannot drift apart.
 *
 * Voices are matched by position, and where one chord has more notes than the
 * other only the voices both have are compared — a limit of representing a
 * chord as a list of pitches rather than as parts.
 */
function parallelsBetween(a, b) {
  const out = []
  const n = Math.min(a.length, b.length)
  for (let v = 0; v < n; v++) {
    for (let w = v + 1; w < n; w++) {
      const before = simple(a[v], a[w])
      if (before !== simple(b[v], b[w])) continue
      if (before !== 7 && before !== 0) continue
      // Both voices must actually move, and move the same way. A held note is
      // oblique motion, which is exactly how parallels are avoided.
      const dv = b[v] - a[v]
      const dw = b[w] - a[w]
      if (dv === 0 || dw === 0) continue
      if (Math.sign(dv) !== Math.sign(dw)) continue
      out.push({ interval: before, voices: [v, w] })
    }
  }
  return out
}

/**
 * What a parallel costs the inversion search, in the units movement() returns.
 *
 * Enough to break a tie and to pay for a little extra movement, not enough to
 * send the voicing somewhere absurd to avoid one. Smoothness is still the point
 * of the feature; this stops it buying smoothness with fused voices.
 */
const PARALLEL_COST = 2.5

/** Total semitone movement between two voiced chords, matched voice to voice. */
function movement(a, b) {
  if (!a.length || !b.length) return 0
  // Match each note of the new chord to its nearest neighbour in the old one,
  // which is what a keyboard player's hand actually does.
  let total = 0
  for (const note of b) {
    let best = Infinity
    for (const prev of a) best = Math.min(best, Math.abs(note - prev))
    total += best
  }
  // Penalise leaping bass separately: it is the voice the ear tracks hardest.
  const bassLeap = Math.abs(Math.min(...b) - Math.min(...a))
  return total / b.length + bassLeap * 0.6
}

/**
 * Pick inversions across a progression to minimise total movement.
 *
 * Exact via dynamic programming — at each chord, the best running cost for
 * every inversion of that chord, given the best way of reaching it.
 *
 * @param progression chord objects
 * @param options.bottom lowest MIDI note to voice from
 * @param options.lockFirst keep the first chord's existing inversion
 * @param options.startInversion inversion of the first chord when locked
 * @returns array of inversion indices, one per chord
 */
export function optimiseInversions(progression, { bottom = 48, lockFirst = false, startInversion = 0 } = {}) {
  if (!progression.length) return []

  const options = progression.map((chord, i) => {
    const n = Math.max(1, chordNotes(chord).length)
    // A slash chord has its bass fixed by the user; don't reinvert it.
    if (chord.bass) return [0]
    if (i === 0 && lockFirst) return [startInversion % n]
    return Array.from({ length: n }, (_, k) => k)
  })

  const voiced = progression.map((chord, i) =>
    options[i].map((inv) => voiceChord(chord, { inversion: inv, bottom })),
  )

  // cost[i][j] = cheapest total movement ending at chord i using its j-th option
  let previousCosts = options[0].map(() => 0)
  const backpointers = []

  for (let i = 1; i < progression.length; i++) {
    const costs = []
    const from = []
    options[i].forEach((_, j) => {
      let bestCost = Infinity
      let bestFrom = 0
      options[i - 1].forEach((_, k) => {
        // Smoothness plus a price on fused voices. Minimising movement alone
        // happily returns parallel fifths — moving two voices in lockstep is
        // about the smoothest thing they can do, which is exactly why parallels
        // turn up in the voicings a movement-only search likes best.
        const pair = voiced[i - 1][k]
        const next = voiced[i][j]
        const cost = previousCosts[k] + movement(pair, next)
          + parallelsBetween(pair, next).length * PARALLEL_COST
        if (cost < bestCost) {
          bestCost = cost
          bestFrom = k
        }
      })
      costs.push(bestCost)
      from.push(bestFrom)
    })
    previousCosts = costs
    backpointers.push(from)
  }

  // Walk back from the cheapest ending.
  let index = previousCosts.indexOf(Math.min(...previousCosts))
  const chosen = new Array(progression.length)
  for (let i = progression.length - 1; i >= 0; i--) {
    chosen[i] = options[i][index]
    if (i > 0) index = backpointers[i - 1][index]
  }
  return chosen
}

/** Average semitone movement per chord change, for reporting the improvement. */
export function progressionMovement(progression, inversions, { bottom = 48 } = {}) {
  if (progression.length < 2) return 0
  const voiced = progression.map((chord, i) =>
    voiceChord(chord, { inversion: inversions[i] ?? 0, bottom }),
  )
  let total = 0
  for (let i = 1; i < voiced.length; i++) total += movement(voiced[i - 1], voiced[i])
  return total / (voiced.length - 1)
}

// ---- Voice-leading faults --------------------------------------------------
//
// The other half of the job. optimiseInversions above searches for the smoothest
// voicing; nothing until now could say what is *wrong* with one, so the engine
// could neither warn nor teach.
//
// What is checked is Picardy's own realisation: these chords, in these
// inversions, voiced in close position by voiceChord. That is the honest scope.
// The app has no four independent voices that a user writes, so a fault here is
// a property of the progression as the app plays it, not of a chorale someone
// submitted — and it is reported as a reading you turn on, never as an error.
// Most of Picardy's users are writing pop and jazz, where parallel fifths are a
// texture rather than a mistake.


/**
 * Parallel and direct fifths and octaves, and sevenths that do not resolve.
 *
 * Deliberately not checked: a doubled leading tone. voiceChord puts one note per
 * chord tone and never doubles anything, so the test could not fire — reporting
 * that it passes would be claiming a guarantee the voicing makes trivially true.
 *
 * @returns [{ type, label, at, why }] — `at` is the index of the *second* chord
 *          of the pair, which is where the fault lands.
 */
export function voiceLeadingFaults(progression, inversions = null, key = null, { bottom = 48 } = {}) {
  if (!progression?.length) return []
  const voiced = progression.map((chord, i) =>
    voiceChord(chord, { inversion: inversions?.[i] ?? 0, bottom }))

  const faults = []
  for (let i = 1; i < progression.length; i++) {
    const a = voiced[i - 1]
    const b = voiced[i]
    if (!a.length || !b.length) continue
    // Voices are matched by position. Where one chord has more notes than the
    // other — a triad moving to a seventh — only the voices both chords have
    // can be compared, which is a limit of this representation rather than a
    // judgement about the music.
    const n = Math.min(a.length, b.length)

    for (const p of parallelsBetween(a, b)) {
      faults.push({
        type: p.interval === 7 ? 'parallel-fifths' : 'parallel-octaves',
        label: p.interval === 7 ? 'parallel fifths' : 'parallel octaves',
        at: i,
        why: p.interval === 7
          ? 'Two voices a fifth apart move to another fifth in the same direction. The two lines stop sounding independent and fuse into one.'
          : 'Two voices an octave apart move to another octave in the same direction, which collapses them into a single line.',
      })
    }

    // Direct (hidden) fifths and octaves, outer voices only: arriving at a
    // perfect fifth or octave by similar motion with the top voice leaping.
    // Between inner voices nobody hears it, which is why the rule is scoped to
    // the outside of the texture.
    if (n >= 2) {
      const loA = a[0]; const hiA = a[a.length - 1]
      const loB = b[0]; const hiB = b[b.length - 1]
      const arrive = simple(loB, hiB)
      const dLo = loB - loA
      const dHi = hiB - hiA
      const similar = dLo !== 0 && dHi !== 0 && Math.sign(dLo) === Math.sign(dHi)
      const leaps = Math.abs(dHi) > 2
      const wasSame = simple(loA, hiA) === arrive
      if ((arrive === 7 || arrive === 0) && similar && leaps && !wasSame) {
        faults.push({
          type: arrive === 7 ? 'direct-fifths' : 'direct-octaves',
          label: arrive === 7 ? 'direct fifths' : 'direct octaves',
          at: i,
          why: `The outer voices reach ${arrive === 7 ? 'a fifth' : 'an octave'} moving the same way, with the top voice leaping into it. Softer than a true parallel, and still exposed on the outside of the texture.`,
        })
      }
    }

    // A chordal seventh is a dissonance and wants to fall by step. Checked by
    // pitch class rather than by voice index, because which voice holds the
    // seventh depends on the inversion.
    const prevChord = progression[i - 1]
    const seventh = chordNotes(prevChord).find((e) => e.degree === 7)
    if (seventh) {
      const pc = mod(pcOf(seventh.note), 12)
      const holder = a.findIndex((m) => mod(m, 12) === pc)
      if (holder >= 0 && holder < n) {
        const moved = b[holder] - a[holder]
        // Down by step resolves it; holding it keeps it alive into the next
        // chord, which is how a chain of sevenths works and is not a fault.
        const resolved = moved === -1 || moved === -2 || moved === 0
        if (!resolved) {
          faults.push({
            type: 'unresolved-seventh',
            label: 'unresolved seventh',
            at: i,
            why: `The seventh of ${chordSymbol(prevChord)} leaves by ${moved > 0 ? 'rising' : 'leaping down'} instead of falling a step. It is the chord's dissonance, and the ear expects it to settle.`,
          })
        }
      }
    }
  }
  return faults
}
