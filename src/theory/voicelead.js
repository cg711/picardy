// Choosing inversions so a progression moves as little as possible.
//
// The same metric the suggestion engine uses to judge how smoothly one chord
// leads to another, applied here as a search: pick the inversion of each chord
// that keeps the voices closest to the chord before it.

import { chordNotes, voiceChord } from './chords.js'

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
        const cost = previousCosts[k] + movement(voiced[i - 1][k], voiced[i][j])
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
