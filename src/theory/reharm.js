// Reharmonisation: substitutions for a chord already written, and chords to
// slip between two existing ones.
//
// The suggestion engine only looks forward. This looks sideways — what else
// could stand in this slot and still do the same job — and into the gaps.

import { mod, pcOf, spellFrom, prettyName } from './notes.js'
import { QUALITIES, makeChord, chordId, chordNotes, chordPcs } from './chords.js'
import { romanNumeral, scalePcs, isDiatonic } from './keys.js'

const rel = (note, generic, semitones) => spellFrom(note, generic, semitones)

/** Chord built at an interval above a given root, spelled from a generic degree. */
function at(root, generic, semitones, qualityId, alts = [], bass = null) {
  return makeChord(rel(root, generic, semitones), qualityId, alts, bass)
}

function push(list, chord, category, why) {
  if (chord) list.push({ chord, category, why })
}

/**
 * Substitutions for the chord at `index`, and chords that could be inserted
 * before it.
 *
 * @returns { replace: [...], insert: [...] } each entry { chord, category, why, roman }
 */
export function reharmonise(progression, index, key) {
  const chord = progression[index]
  if (!chord) return { replace: [], insert: [] }
  const next = progression[index + 1] ?? null
  const previous = progression[index - 1] ?? null

  const replace = []
  const insert = []
  const family = QUALITIES[chord.qualityId]?.family ?? 'other'
  const root = chord.root

  // --- richer versions of the same chord -------------------------------------
  const enrich = {
    maj: [['maj7', 'a major 7th'], ['six', 'a 6th'], ['add9', 'an added 9th'], ['maj9', 'a major 9th'], ['sixNine', 'a 6/9']],
    min: [['m7', 'a minor 7th'], ['m9', 'a minor 9th'], ['madd9', 'an added 9th'], ['m6', 'a minor 6th'], ['m11', 'a minor 11th']],
    dom7: [['dom9', 'a 9th'], ['dom13', 'a 13th'], ['sevenSus4', 'a 7sus4'], ['sevenAlt', 'an altered dominant']],
  }
  const enrichList = chord.qualityId === 'maj' ? enrich.maj
    : chord.qualityId === 'min' ? enrich.min
    : chord.qualityId === 'dom7' ? enrich.dom7
    : []
  for (const [quality, label] of enrichList) {
    push(replace, makeChord(root, quality), 'colour',
      `Same chord as ${label}. The function does not change, so it is safe anywhere the plain chord works — this is the cheapest way to make a progression sound less bare.`)
  }

  // --- dominant substitutions -------------------------------------------------
  if (family === 'dom') {
    push(replace, at(root, 2, 1, 'dom7'), 'tritoneSub',
      'Tritone substitute: a dominant a tritone away shares the same tritone, so it resolves the same way — but the bass slides down a half step instead of falling a fifth.')
    push(replace, makeChord(root, 'dom7', ['b9']), 'tension',
      'The ♭9 tightens the pull without changing where the chord goes.')
    push(replace, makeChord(root, 'sevenAlt'), 'tension',
      'Every tension altered at once. Strongest possible dominant colour, and it wants to resolve immediately.')
    push(replace, at(root, 7, 11, 'dim7'), 'rootless',
      'The diminished 7th a half step below is this dominant without its root — three of its four notes are shared, so it resolves identically but sounds lighter.')
    push(replace, makeChord(root, 'sevenSus4'), 'colour',
      'Suspending the 3rd removes the tritone, so the chord still pushes forward but arrives softer.')
  }

  // --- function-preserving swaps ---------------------------------------------
  const scale = new Set(scalePcs(key))
  const degree = mod(pcOf(root) - pcOf(key.tonic), 12)

  if (family === 'major' || family === 'minor') {
    // A chord a third away shares two of its three notes and usually its job.
    const down3 = at(root, 6, 9, family === 'major' ? 'min' : 'maj')
    const up3 = at(root, 3, family === 'major' ? 4 : 3, family === 'major' ? 'min' : 'maj')
    for (const candidate of [down3, up3]) {
      if (!candidate) continue
      const shared = chordPcs(candidate).filter((pc) => chordPcs(chord).includes(pc)).length
      if (shared < 2) continue
      if (!isDiatonic(candidate, key)) continue
      push(replace, candidate, 'mediantSwap',
        `Shares ${shared} of its notes with the original and sits in the same functional group, so it can stand in for it — the classic relative-major/minor swap.`)
    }
  }

  // --- borrowing ---------------------------------------------------------------
  if (family === 'major' && degree === 5) {
    push(replace, makeChord(root, 'min'), 'mixture',
      'IV borrowed from the parallel minor. Its ♭6 falls a half step into the 5th of the tonic — the "minor plagal" sigh.')
  }
  if (family === 'major' && degree === 0 && key.mode === 'major') {
    push(replace, makeChord(root, 'six'), 'colour',
      'A 6th instead of a major 7th: no leading tone, so the tonic sits still rather than leaning anywhere.')
  }
  if (family === 'minor' && isDiatonic(chord, key)) {
    push(replace, makeChord(root, 'dom7'), 'secondary',
      'Turning this minor chord into a dominant 7th makes it an applied dominant, pulling hard to the chord a fifth below it.')
  }

  // --- bass movement ------------------------------------------------------------
  const tones = chordNotes(chord)
  if (tones.length > 1 && !chord.bass) {
    const third = tones.find((t) => t.degree === 3)
    const fifth = tones.find((t) => t.degree === 5)
    for (const [tone, label] of [[third, 'third'], [fifth, 'fifth']]) {
      if (!tone) continue
      push(replace, makeChord(root, chord.qualityId, chord.alterations, tone.note), 'bass',
        `Same chord with the ${label} in the bass. Use it to keep the bass line stepwise instead of leaping between roots.`)
    }
  }

  // --- chords to insert before this one -----------------------------------------
  if (chord) {
    const targetRoman = romanNumeral(chord, key)

    // Its own dominant.
    push(insert, at(root, 5, 7, 'dom7'), 'secondary',
      `V7 of ${targetRoman} — one chord of borrowed dominant, tonicising ${targetRoman} without changing key.`)

    // A full ii–V pointing at it.
    push(insert, at(root, 2, 2, family === 'minor' ? 'm7b5' : 'm7'), 'relatedII',
      `The related ii of ${targetRoman}, so you get a whole ii–V approach instead of a bare dominant.`)

    // Chromatic approach from a half step below.
    push(insert, at(root, 7, 11, 'dim7'), 'passing',
      `A diminished 7th a half step below ${targetRoman}. Every voice steps up by a semitone into it — pure voice-leading glue.`)

    // Tritone sub of its dominant: bass slides down chromatically into the chord.
    push(insert, at(root, 2, 1, 'dom7'), 'tritoneSub',
      `A dominant a half step above ${targetRoman}, sliding down into it. Same tritone as its real dominant, chromatic bass.`)

    if (previous) {
      // A passing chord between the previous root and this one, when they are a
      // whole step apart — the gap a chromatic passing chord is made for.
      // Descending whole step only: the ascending case is the same chord as the
      // leading-tone rule above, and spelled better there.
      const gap = mod(pcOf(root) - pcOf(previous.root), 12)
      if (gap === 10) {
        push(insert, at(previous.root, 7, 11, 'dim7'), 'passing',
          `${prettyName(previous.root)} falls a whole step to ${prettyName(root)}, leaving room for a chromatic passing chord exactly between them.`)
      }
    }
  }

  const decorate = (entry) => ({ ...entry, roman: romanNumeral(entry.chord, key), id: chordId(entry.chord) })

  // Each list dedupes against itself only: A♭7 as a substitute for G7 and A♭7
  // slipped in before it are different suggestions, and both are worth offering.
  const dedupe = (list) => {
    const seen = new Set([chordId(chord)])
    return list.map(decorate).filter((entry) => {
      if (seen.has(entry.id)) return false
      seen.add(entry.id)
      return true
    })
  }

  return { replace: dedupe(replace), insert: dedupe(insert) }
}
