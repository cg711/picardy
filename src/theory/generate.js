// "Surprise me" — generate a whole progression rather than one chord at a time.
//
// The body is a weighted random walk through the ranked suggestions, so every
// step is still a move the engine considers idiomatic; the flavour restricts
// which harmonic categories are in play and how adventurous the sampling is.
// The last two or three chords come from a fixed cadence template, which is what
// makes the result end rather than just stop.

import { at, suggestNext } from './suggest.js'
import { chordId } from './chords.js'
import { pcOf } from './notes.js'
import { harmonicFunction } from './keys.js'

/**
 * Cadence templates. Each entry is [semitonesAboveTonic, genericDegree,
 * qualityId, alterations?, bassSemitones?, bassGeneric?].
 * `needsPredominant` asks the body to end on a predominant so the cadence has
 * something to push off from.
 */
const CADENCES = {
  major: {
    perfect: {
      weight: 3,
      label: 'a perfect authentic cadence, V7–I',
      needsPredominant: true,
      chords: [[7, 5, 'dom7'], [0, 1, 'maj']],
    },
    perfectTriad: {
      weight: 3,
      label: 'an authentic cadence, V–I',
      needsPredominant: true,
      chords: [[7, 5, 'maj'], [0, 1, 'maj']],
    },
    twoFiveOne: {
      weight: 3,
      label: 'a ii–V–I',
      chords: [[2, 2, 'm7'], [7, 5, 'dom7'], [0, 1, 'maj7']],
    },
    tritoneSub: {
      weight: 1.5,
      label: 'a ii–subV–I, the dominant replaced by its tritone substitute',
      chords: [[2, 2, 'm7'], [1, 2, 'dom7'], [0, 1, 'maj7']],
    },
    plagal: {
      weight: 2.5,
      label: 'a plagal "amen" cadence, IV–I',
      chords: [[5, 4, 'maj'], [0, 1, 'maj']],
    },
    minorPlagal: {
      weight: 2,
      label: 'a minor plagal cadence, iv–I, borrowing ♭6 from the parallel minor',
      chords: [[5, 4, 'min'], [0, 1, 'maj']],
    },
    half: {
      weight: 1.5,
      label: 'a half cadence, resting on V',
      chords: [[2, 2, 'min'], [7, 5, 'maj']],
    },
    deceptive: {
      weight: 1,
      label: 'a deceptive cadence, V7–vi',
      needsPredominant: true,
      chords: [[7, 5, 'dom7'], [9, 6, 'min']],
    },
    backdoor: {
      weight: 1.5,
      label: 'a backdoor cadence, iv7–♭VII7–I, approaching the tonic from the flat side',
      chords: [[5, 4, 'm7'], [10, 7, 'dom7'], [0, 1, 'maj7']],
    },
    neapolitan: {
      weight: 1,
      label: 'a Neapolitan sixth into V–I',
      chords: [[1, 2, 'maj', [], 5, 4], [7, 5, 'dom7'], [0, 1, 'maj']],
    },
    german: {
      weight: 1,
      label: 'a German augmented sixth expanding outward into V–I',
      chords: [[8, 6, 'ger6'], [7, 5, 'dom7'], [0, 1, 'maj']],
    },
    cadential64: {
      weight: 1.2,
      label: 'a cadential 6/4 resolving through V7 to I',
      chords: [[0, 1, 'maj', [], 7, 5], [7, 5, 'dom7'], [0, 1, 'maj']],
    },
  },
  minor: {
    perfect: {
      weight: 3,
      label: 'a perfect authentic cadence, V7–i, using the raised 7th of harmonic minor',
      needsPredominant: true,
      chords: [[7, 5, 'dom7'], [0, 1, 'min']],
    },
    twoFiveOne: {
      weight: 3,
      label: 'a minor ii–V–i, iiø7–V7♭9–i',
      chords: [[2, 2, 'm7b5'], [7, 5, 'dom7', ['b9']], [0, 1, 'min']],
    },
    picardy: {
      weight: 1.5,
      label: 'a Picardy third — V7 landing on a major tonic',
      needsPredominant: true,
      chords: [[7, 5, 'dom7'], [0, 1, 'maj']],
    },
    phrygianHalf: {
      weight: 1.5,
      label: 'a Phrygian half cadence, iv6–V, with ♭6 falling by half step to the dominant',
      chords: [[5, 4, 'min', [], 8, 6], [7, 5, 'maj']],
    },
    plagal: {
      weight: 2.5,
      label: 'a plagal cadence, iv–i',
      chords: [[5, 4, 'min'], [0, 1, 'min']],
    },
    aeolian: {
      weight: 2.5,
      label: 'an Aeolian cadence, ♭VI–♭VII–i',
      chords: [[8, 6, 'maj'], [10, 7, 'maj'], [0, 1, 'min']],
    },
    deceptive: {
      weight: 1,
      label: 'a deceptive cadence, V7–♭VI',
      needsPredominant: true,
      chords: [[7, 5, 'dom7'], [8, 6, 'maj']],
    },
    german: {
      weight: 1,
      label: 'a German augmented sixth expanding outward into V–i',
      chords: [[8, 6, 'ger6'], [7, 5, 'dom7'], [0, 1, 'min']],
    },
  },
}

/**
 * A flavour is a slice of the engine's vocabulary plus a sampling temperature.
 * Higher `temp` hugs the top of the ranked list; lower reaches further down it.
 */
export const FLAVOURS = {
  pop: {
    label: 'Pop / folk',
    categories: ['diatonic', 'extension', 'pedal'],
    temp: 2.6,
    lengths: [4, 4, 6, 8],
    cadences: ['perfect', 'perfectTriad', 'plagal', 'minorPlagal', 'half', 'deceptive', 'aeolian', 'phrygianHalf'],
  },
  jazz: {
    label: 'Jazz',
    categories: ['diatonic', 'extension', 'secondary', 'secondaryLT', 'relatedII', 'tritoneSub', 'mixture', 'backdoor', 'constant', 'coltrane', 'poly'],
    temp: 1.0,
    lengths: [4, 6, 8, 8],
    cadences: ['twoFiveOne', 'tritoneSub', 'backdoor', 'perfect', 'deceptive'],
  },
  modal: {
    label: 'Modal / rock',
    categories: ['diatonic', 'mixture', 'extension', 'pedal', 'backdoor'],
    temp: 1.7,
    lengths: [4, 4, 6, 8],
    cadences: ['plagal', 'minorPlagal', 'backdoor', 'aeolian', 'perfectTriad', 'half', 'phrygianHalf'],
  },
  chromatic: {
    label: 'Chromatic / romantic',
    categories: ['diatonic', 'secondary', 'secondaryLT', 'mixture', 'neapolitan', 'aug6', 'mediant', 'passing', 'pedal'],
    temp: 1.1,
    lengths: [6, 6, 8],
    cadences: ['neapolitan', 'german', 'cadential64', 'perfect', 'deceptive', 'phrygianHalf', 'picardy'],
  },
  cinematic: {
    label: 'Cinematic',
    categories: ['diatonic', 'mediant', 'mixture', 'pedal', 'constant'],
    temp: 1.3,
    lengths: [4, 6, 6, 8],
    cadences: ['plagal', 'minorPlagal', 'aeolian', 'half', 'perfectTriad', 'deceptive'],
  },
}

const rand = (rng) => rng()
const choice = (arr, rng) => arr[Math.floor(rand(rng) * arr.length)]

/** Pick a cadence id, favouring the ones that actually resolve. */
function chooseCadence(ids, table, rng) {
  const total = ids.reduce((sum, id) => sum + (table[id].weight ?? 1), 0)
  let r = rand(rng) * total
  for (const id of ids) {
    r -= table[id].weight ?? 1
    if (r <= 0) return id
  }
  return ids[ids.length - 1]
}

/** Weighted sample: score^temp, so temp controls how greedy the walk is. */
function sample(candidates, temp, rng) {
  if (!candidates.length) return null
  const weights = candidates.map((c) => Math.pow(Math.max(1, c.score), temp))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand(rng) * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

function buildCadence(key, spec) {
  return spec.chords.map(([semi, gen, quality, alts = [], bassSemi = null, bassGen = null]) =>
    at(key, semi, gen, quality, alts, bassSemi, bassGen))
}

/** Openers: the tonic most of the time, occasionally another stable chord. */
function openingChord(key, rng) {
  const minor = key.mode === 'minor'
  const options = minor
    ? [[0, 1, 'min'], [0, 1, 'min'], [0, 1, 'min'], [8, 6, 'maj'], [5, 4, 'min'], [3, 3, 'maj']]
    : [[0, 1, 'maj'], [0, 1, 'maj'], [0, 1, 'maj'], [9, 6, 'min'], [5, 4, 'maj'], [2, 2, 'min']]
  const [semi, gen, quality] = choice(options, rng)
  return at(key, semi, gen, quality)
}

/**
 * Generate a complete progression in `key`.
 *
 * @param options.flavour  key of FLAVOURS, or 'any'
 * @param options.length   override the flavour's own length choice
 * @param options.rng      injectable RNG, for reproducible tests
 * @returns { progression, flavour, flavourLabel, cadence, cadenceLabel }
 */
export function generateProgression(key, { flavour = 'any', length = null, rng = Math.random } = {}) {
  const flavourId = flavour === 'any' ? choice(Object.keys(FLAVOURS), rng) : flavour
  const f = FLAVOURS[flavourId] ?? FLAVOURS.pop

  const table = CADENCES[key.mode]
  const available = f.cadences.filter((c) => table[c])
  const cadenceId = chooseCadence(available.length ? available : Object.keys(table), table, rng)
  const cadenceSpec = table[cadenceId]
  const cadence = buildCadence(key, cadenceSpec)

  const total = length ?? choice(f.lengths, rng)
  const bodyLength = Math.max(2, total - cadence.length)

  const allowed = new Set(f.categories)
  const progression = [openingChord(key, rng)]

  for (let i = 1; i < bodyLength; i++) {
    const isLastBodyChord = i === bodyLength - 1
    const ranked = suggestNext(key, progression)

    // Circling back to a chord heard two beats ago reads as indecision rather
    // than as a return, so keep a short memory of what has just been played.
    // Roots have a shorter memory than whole chords, since Dm11 followed two
    // slots later by Dm7 still sounds like the same chord twice.
    const recent = new Set(progression.slice(-3).map(chordId))
    const recentRoots = new Set(progression.slice(-2).map((c) => pcOf(c.root)))
    let pool = ranked.filter((c) => {
      if (!(c.categories ?? [c.category]).some((cat) => allowed.has(cat))) return false
      if (recentRoots.has(pcOf(c.chord.root))) return false
      return !recent.has(chordId(c.chord))
    })
    if (!pool.length) {
      const last = chordId(progression[progression.length - 1])
      pool = ranked.filter((c) => chordId(c.chord) !== last)
    }

    // Hand the cadence a predominant to push off from, and don't let the body
    // resolve to the tonic right before a cadence that reintroduces it.
    if (isLastBodyChord && cadenceSpec.needsPredominant) {
      const pd = pool.filter((c) => harmonicFunction(c.chord, key) === 'PD')
      if (pd.length) pool = pd
    }
    if (isLastBodyChord) {
      // Don't hand off to the cadence on a chord that pre-empts its first move
      // (…Dm into a ii–V–I starting on Dm7) or that already spent the tonic.
      const seam = pcOf(cadence[0].root)
      const goal = chordId(cadence[cadence.length - 1])
      const clean = pool.filter((c) => pcOf(c.chord.root) !== seam && chordId(c.chord) !== goal)
      if (clean.length) pool = clean
    }

    // Sampling from the whole tail would surface chords the engine rates as
    // near-impossible; the top slice is still 20+ genuine options.
    const picked = sample(pool.slice(0, 24), f.temp, rng)
    if (!picked) break
    progression.push(picked.chord)
  }

  // Safety net at the seam: never let the cadence restate the root the body has
  // just landed on, however the walk got there.
  const merged = [...progression]
  for (const chord of cadence) {
    const last = merged[merged.length - 1]
    if (last && pcOf(last.root) === pcOf(chord.root)) {
      // Prefer the cadence's own version of that root — it is the functional one.
      merged[merged.length - 1] = chord
      continue
    }
    merged.push(chord)
  }

  return {
    progression: merged,
    flavour: flavourId,
    flavourLabel: f.label,
    cadence: cadenceId,
    cadenceLabel: cadenceSpec.label,
  }
}
