// What a melody note is doing against the chord underneath it.
//
// A piano roll that only draws pitches is a sequencer. The whole reason to put
// one in Picardy is that the app already knows what chord is sounding at every
// beat, so it can say whether the note you just placed is a chord tone, a colour
// the chord invites, or the one note that will fight it — and why.

import { mod, pcOf } from './notes.js'
import { chordNotes, degreeLabel, QUALITIES } from './chords.js'
import { scalePcs } from './keys.js'

/**
 * Named tensions by their distance above the chord root.
 *
 * Written as the 9/11/13 a player would call them rather than 2/4/6, because
 * that is how they are talked about over a chord.
 */
const TENSION = {
  1: { label: '♭9', why: 'a flat ninth — sharp and unstable, at home over a dominant and harsh elsewhere' },
  2: { label: '9', why: 'the ninth, the most consonant colour you can add' },
  3: { label: '♯9', why: 'a sharp ninth — the blues third sitting over a major third' },
  5: { label: '11', why: 'the eleventh' },
  6: { label: '♯11', why: 'a sharp eleventh — the Lydian colour, bright and open' },
  8: { label: '♭13', why: 'a flat thirteenth — dark, and a dominant chord takes it well' },
  9: { label: '13', why: 'the thirteenth, warm and open' },
  10: { label: '♭7', why: 'a flat seventh over a chord that has none — it turns it dominant' },
  11: { label: '7', why: 'a major seventh over a chord that has none' },
}

/**
 * The note that fights the chord.
 *
 * A natural 11th sits a half step above the major third, and those two together
 * are the one combination that reliably sounds like a mistake rather than a
 * colour. It is only a problem when the chord actually has that third, which is
 * why this asks rather than assuming.
 */
function isAvoid(interval, chord) {
  if (interval !== 5) return false
  return chordNotes(chord).some((e) => e.degree === 3 && mod(e.semi, 12) === 4)
}

/**
 * Classify one pitch against one chord.
 *
 * @returns { role, label, why } where role is one of:
 *   chord   — a note of the chord itself
 *   tension — in the key, and a colour the chord invites
 *   avoid   — in the key, but a half step above the chord's major third
 *   outside — not in the key at all
 */
export function classifyNote(midi, chord, key) {
  const pc = mod(midi, 12)
  if (!chord) {
    return { role: 'outside', label: '', why: 'No chord is sounding here.' }
  }

  const tones = chordNotes(chord)
  const hit = tones.find((e) => pcOf(e.note) === pc)
  if (hit) {
    const label = degreeLabel(hit, chord)
    return { role: 'chord', label, why: chordToneWhy(label, chord) }
  }

  const interval = mod(pc - pcOf(chord.root), 12)
  const inKey = key ? new Set(scalePcs(key)).has(pc) : true
  const named = TENSION[interval]

  if (isAvoid(interval, chord)) {
    return {
      role: 'avoid',
      label: '11',
      why: 'a natural eleventh, a half step above the chord’s third — the one tension that fights rather than colours. Fine passing through, rough held.',
    }
  }

  if (!inKey) {
    return {
      role: 'outside',
      label: named?.label ?? '',
      why: 'outside the key — it works as a passing note or an approach into the next chord tone, and stands out if you sit on it.',
    }
  }

  return {
    role: 'tension',
    label: named?.label ?? '',
    why: named ? `${named.why}.` : 'in the key, but not a note of this chord.',
  }
}

const chordToneWhy = (label, chord) => {
  const family = QUALITIES[chord.qualityId]?.family
  if (label === 'R') return 'the root — the most stable note you can land on, and the least surprising.'
  if (label === '3') return 'the third — the note that makes this chord major.'
  if (label === '♭3') return 'the third — the note that makes this chord minor.'
  if (label === '5') return 'the fifth — stable, but it says less about the chord than the third does.'
  if (label === '♭7') return family === 'dom'
    ? 'the seventh — half of the tritone that gives a dominant its pull.'
    : 'the seventh.'
  if (label === '7') return 'the major seventh — the brightest note in the chord.'
  return `the ${label} of the chord.`
}

/**
 * What a melody note is *doing*, as opposed to what it is.
 *
 * classifyNote answers vertically: this pitch against that chord, one note at a
 * time. That is the wrong question for most of what a melody does. A suspension
 * and an appoggiatura can be the same pitch over the same chord on the same beat
 * and are different events entirely — what separates them is where the note came
 * from and where it goes, which a vertical reading cannot see.
 *
 * So this one reads horizontally: approach, departure, and metrical position.
 * Ordered first-match-wins like the cadence table, and for the same reason —
 * a suspension also satisfies the test for an accented passing tone, and an
 * appoggiatura also satisfies the looser incomplete-neighbour test, so the
 * specific figures have to be tried before the general ones.
 *
 * @returns { role, label, why } or null when the note is simply a chord tone.
 */
export function classifyFigure(melody, index, progression, durations, ts) {
  const note = melody?.[index]
  if (!note || !progression?.length) return null
  const prev = melody[index - 1]
  const next = melody[index + 1]

  const onset = chordAtBeat(progression, durations, note.at)
  if (!onset.chord) return null

  // Where the note ends up: a note may be struck under one chord and still be
  // sounding under the next, which is how a suspension is usually written.
  //
  // The step back has to be larger than chordAtBeat's own tolerance. At 1e-6 —
  // exactly that tolerance — the two cancelled, and a note ending flush against
  // a chord change was reported as sounding into the next chord. That is most
  // notes, and it invented figures for chord tones that were doing nothing.
  const endBeat = Math.max(note.at, note.at + note.beats - 1e-3)
  const atEnd = chordAtBeat(progression, durations, endBeat)
  const landsIn = atEnd.chord ?? onset.chord
  const spansChange = atEnd.index >= 0 && atEnd.index !== onset.index

  const isTone = (midi, chord) =>
    !!chord && chordNotes(chord).some((e) => pcOf(e.note) === mod(midi, 12))

  // Dissonant somewhere is the price of admission: a note consonant throughout
  // is a chord tone, whatever shape its line makes around it.
  const clashesAtOnset = !isTone(note.midi, onset.chord)
  const clashesAtEnd = !isTone(note.midi, landsIn)
  if (!clashesAtOnset && !clashesAtEnd) return null

  const beatsPerBar = ts?.beatsPerBar ?? 4
  const inBar = mod(note.at, beatsPerBar)
  const near = (a, b) => Math.abs(a - b) < 1e-6
  // The downbeat, and the middle of an even bar, are the accented positions.
  // Metrical strength is what separates an appoggiatura from an escape tone and
  // a suspension from an accented passing tone, so it cannot be skipped.
  const accented = near(inBar, 0) || (beatsPerBar % 2 === 0 && near(inBar, beatsPerBar / 2))

  const approach = prev ? note.midi - prev.midi : null
  const departure = next ? next.midi - note.midi : null
  const isStep = (d) => d !== null && Math.abs(d) >= 1 && Math.abs(d) <= 2
  const isLeap = (d) => d !== null && Math.abs(d) >= 3

  // Held from the previous harmony, either as a repeated pitch or as one note
  // still sounding across the change.
  const heldOver = (prev && prev.midi === note.midi && chordAtBeat(progression, durations, prev.at).index !== onset.index)
    || (spansChange && !clashesAtOnset && clashesAtEnd)

  const resolvesDown = departure !== null && departure >= -2 && departure <= -1
  const resolvesUp = departure !== null && departure >= 1 && departure <= 2

  if (heldOver && resolvesDown) {
    return {
      role: 'suspension',
      label: 'sus',
      why: 'a suspension — prepared as a consonance in the chord before, held while the harmony changes underneath it, and resolved down by step. Preparation, suspension, resolution.',
    }
  }
  if (heldOver && resolvesUp) {
    return {
      role: 'retardation',
      label: 'ret',
      why: 'a retardation — a suspension that resolves upward instead of down, which is rarer and sounds like a held breath rather than a sigh.',
    }
  }

  // Arrives early: the pitch belongs to the chord that has not started yet.
  if (next && next.midi === note.midi && !accented && clashesAtOnset) {
    const after = chordAtBeat(progression, durations, next.at)
    if (after.index !== onset.index && isTone(note.midi, after.chord)) {
      return {
        role: 'anticipation',
        label: 'ant',
        why: 'an anticipation — the next chord\'s note arriving before the chord does, on a weak part of the beat.',
      }
    }
  }

  if (isLeap(approach) && isStep(departure) && accented) {
    return {
      role: 'appoggiatura',
      label: 'app',
      why: 'an appoggiatura — an accented incomplete neighbour, leapt into on a strong beat and resolved by step. It leans on the chord and then gives way.',
    }
  }
  if (isStep(approach) && isLeap(departure) && !accented) {
    return {
      role: 'escape',
      label: 'esc',
      why: 'an escape tone — stepped into off the beat and then left by a leap in the other direction.',
    }
  }
  if (isStep(approach) && isStep(departure) && Math.sign(approach) === Math.sign(departure)) {
    return {
      role: 'passing',
      label: accented ? 'acc P' : 'P',
      why: accented
        ? 'an accented passing tone — passing between two chord tones, but landing on the beat, so it sounds against the chord before moving on.'
        : 'a passing tone — filling the step between two chord tones, off the beat.',
    }
  }
  if (isStep(approach) && isStep(departure) && prev && next && prev.midi === next.midi) {
    return {
      role: 'neighbour',
      label: note.midi > prev.midi ? 'UN' : 'LN',
      why: `a ${note.midi > prev.midi ? 'upper' : 'lower'} neighbour — a step away from a chord tone and straight back to it.`,
    }
  }
  if ((isLeap(approach) && isStep(departure)) || (isStep(approach) && isLeap(departure))) {
    return {
      role: 'incomplete',
      label: 'IN',
      why: 'an incomplete neighbour — approached or left by leap rather than by step on both sides, so it decorates without filling a gap.',
    }
  }

  return null
}

/** Which chord is sounding at a beat, given per-chord durations. */
export function chordAtBeat(progression, durations, beat) {
  let at = 0
  for (let i = 0; i < progression.length; i++) {
    const len = durations[i]
    if (beat >= at - 1e-6 && beat < at + len - 1e-6) return { chord: progression[i], index: i }
    at += len
  }
  return { chord: null, index: -1 }
}

/**
 * The pitch range a roll should draw.
 *
 * Two octaves centred on the key's tonic, which is where a sung or played line
 * actually sits — a full 88 keys of empty roll is unusable on a laptop.
 */
export function rollRange(key) {
  const tonic = key ? mod(pcOf(key.tonic), 12) : 0
  const bottom = 60 + tonic - 12
  return { low: bottom, high: bottom + 24 }
}

/** Notes sorted and de-duplicated, so two clicks on one cell cannot stack. */
export function normaliseMelody(notes) {
  const seen = new Set()
  return [...notes]
    .filter((n) => Number.isFinite(n.at) && Number.isFinite(n.midi) && n.beats > 0)
    .sort((a, b) => a.at - b.at || a.midi - b.midi)
    .filter((n) => {
      const k = `${+n.at.toFixed(3)}:${n.midi}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}
