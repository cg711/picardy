// MusicXML export — a lead sheet that keeps its spelling.
//
// The MIDI export throws away the one thing this engine exists to get right. A
// German sixth and a ♭VI7 are the same bytes in a .mid; so are C7♯9's D♯ and an
// E♭. MusicXML carries step, alter and octave separately, which is the same
// shape the chord model has used all along — so a chart opened in MuseScore,
// Sibelius or Dorico arrives spelled the way Picardy decided rather than
// respelled by whatever the importer guesses.
//
// Written by hand for the same reason midi.js is: the file is a few hundred
// lines of very regular XML, and a dependency to produce it would be larger
// than the code that produces it.

import { chordNotes, chordSymbol } from '../theory/chords.js'
import { scaleNotes, spellPitchInKey, romanNumeral } from '../theory/keys.js'
import { pcOf, LETTERS } from '../theory/notes.js'
import { timeSignatureOf, toBeats } from '../theory/rhythm.js'
import { layOutMeasures, figureFor } from './leadsheet.js'

/** Ticks per quarter note. Divides thirds, halves and sixteenths exactly. */
const DIVISIONS = 96

/**
 * Picardy's chord qualities in MusicXML's fixed vocabulary.
 *
 * The vocabulary is smaller than the app's, so anything without a real match
 * uses `other` — and every kind carries a `text` attribute holding Picardy's own
 * symbol, which is what notation programs actually display. That way an
 * augmented sixth still reads "A♭+6(Ger)" on the page even though MusicXML has
 * no idea what one is.
 */
const KINDS = {
  maj: 'major',
  min: 'minor',
  dim: 'diminished',
  aug: 'augmented',
  sus2: 'suspended-second',
  sus4: 'suspended-fourth',
  five: 'power',
  six: 'major-sixth',
  m6: 'minor-sixth',
  sixNine: 'major-sixth',
  m69: 'minor-sixth',
  maj7: 'major-seventh',
  dom7: 'dominant',
  m7: 'minor-seventh',
  mMaj7: 'major-minor',
  m7b5: 'half-diminished',
  dim7: 'diminished-seventh',
  sevenSus4: 'suspended-fourth',
  add9: 'major',
  madd9: 'minor',
  add11: 'major',
  maj9: 'major-ninth',
  dom9: 'dominant-ninth',
  m9: 'minor-ninth',
  maj11: 'major-11th',
  dom11: 'dominant-11th',
  m11: 'minor-11th',
  dom13: 'dominant-13th',
  maj13: 'major-13th',
  m13: 'minor-13th',
  sevenAlt: 'dominant',
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/**
 * The key signature as a number of sharps (positive) or flats (negative).
 *
 * Counted from the key's own scale rather than looked up, which gets the minor
 * keys right for free: a natural minor scale carries exactly the accidentals of
 * its relative major, which is what the signature shows.
 */
export function fifthsFor(key) {
  const notes = scaleNotes(key)
  return notes.filter((n) => n.acc > 0).length - notes.filter((n) => n.acc < 0).length
}

/** MusicXML writes a pitch as a letter, a numeric alteration, and an octave. */
function pitchXml(note, octave, indent) {
  return [
    `${indent}<pitch>`,
    `${indent}  <step>${LETTERS[note.letter]}</step>`,
    ...(note.acc ? [`${indent}  <alter>${note.acc}</alter>`] : []),
    `${indent}  <octave>${octave}</octave>`,
    `${indent}</pitch>`,
  ]
}

function harmonyXml(chord, key, indent) {
  const q = KINDS[chord.qualityId] ?? 'other'
  const root = chord.root
  const out = [
    `${indent}<harmony>`,
    `${indent}  <root>`,
    `${indent}    <root-step>${LETTERS[root.letter]}</root-step>`,
    ...(root.acc ? [`${indent}    <root-alter>${root.acc}</root-alter>`] : []),
    `${indent}  </root>`,
    `${indent}  <kind text="${esc(chordSymbol(chord))}">${q}</kind>`,
  ]
  // A slash bass is part of the symbol, so it travels with it.
  if (chord.bass) {
    out.push(
      `${indent}  <bass>`,
      `${indent}    <bass-step>${LETTERS[chord.bass.letter]}</bass-step>`,
      ...(chord.bass.acc ? [`${indent}    <bass-alter>${chord.bass.acc}</bass-alter>`] : []),
      `${indent}  </bass>`,
    )
  }
  out.push(`${indent}</harmony>`)
  return out
}

/**
 * A lead sheet: chord symbols over the melody, or over rests when there is none.
 *
 * @param parts   [{ chord, inversion, beats, sectionName? }] in playing order
 * @param options.melody [{ at, beats, midi }] in beats from the start
 * @returns the XML as a string
 */
export function buildMusicXml(parts, {
  key,
  timeSignature = '4/4',
  bpm = 84,
  title = 'Picardy',
  melody = [],
  romanNumerals = true,
} = {}) {
  if (!parts?.length || !key) return null

  const ts = timeSignatureOf(timeSignature)
  // Bar lines and ties are worked out in leadsheet.js — the arithmetic has all
  // the edge cases (odd metres, a last bar that does not fill, notes crossing a
  // bar line) and is far easier to hold to in isolation than tangled up here.
  const measures = layOutMeasures(parts, { timeSignature, melody })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    '  <work>',
    `    <work-title>${esc(title)}</work-title>`,
    '  </work>',
    '  <identification>',
    '    <encoding>',
    '      <software>Picardy</software>',
    '    </encoding>',
    '  </identification>',
    '  <part-list>',
    '    <score-part id="P1">',
    '      <part-name>Lead sheet</part-name>',
    '    </score-part>',
    '  </part-list>',
    '  <part id="P1">',
  ]
  let lastSection = null

  for (const measure of measures) {
    xml.push(`    <measure number="${measure.index + 1}">`)

    if (measure.index === 0) {
      xml.push(
        '      <attributes>',
        `        <divisions>${DIVISIONS}</divisions>`,
        '        <key>',
        `          <fifths>${fifthsFor(key)}</fifths>`,
        `          <mode>${key.mode}</mode>`,
        '        </key>',
        '        <time>',
        `          <beats>${ts.top}</beats>`,
        `          <beat-type>${ts.bottom}</beat-type>`,
        '        </time>',
        '        <clef>',
        '          <sign>G</sign>',
        '          <line>2</line>',
        '        </clef>',
        '      </attributes>',
        '      <direction placement="above">',
        '        <direction-type>',
        '          <metronome>',
        '            <beat-unit>quarter</beat-unit>',
        `            <per-minute>${Math.round(bpm)}</per-minute>`,
        '          </metronome>',
        '        </direction-type>',
        `        <sound tempo="${Math.round(bpm)}"/>`,
        '      </direction>',
      )
    }

    // A section change is a rehearsal mark, the same information the MIDI
    // export writes as a marker.
    if (measure.sectionName && measure.sectionName !== lastSection) {
      lastSection = measure.sectionName
      xml.push(
        '      <direction placement="above">',
        '        <direction-type>',
        `          <rehearsal>${esc(measure.sectionName)}</rehearsal>`,
        '        </direction-type>',
        '      </direction>',
      )
    }

    for (const slot of measure.slots) {
      if (slot.chord) {
        xml.push(...harmonyXml(slot.chord, key, '      '))
        if (romanNumerals) {
          xml.push(
            '      <direction placement="below">',
            '        <direction-type>',
            `          <words>${esc(romanNumeral(slot.chord, key, slot.inversion))}</words>`,
            '        </direction-type>',
            '      </direction>',
          )
        }
      }

      const { type, dots } = figureFor(slot.beats)
      const duration = Math.max(1, Math.round(slot.beats * DIVISIONS))

      if (slot.midi == null) {
        xml.push(
          '      <note>',
          '        <rest/>',
          `        <duration>${duration}</duration>`,
          `        <type>${type}</type>`,
          ...Array.from({ length: dots }, () => '        <dot/>'),
          '      </note>',
        )
        continue
      }

      const { note: spelled, octave } = spellPitchInKey(slot.midi, key)
      xml.push(
        '      <note>',
        ...pitchXml(spelled, octave, '        '),
        `        <duration>${duration}</duration>`,
        ...(slot.tieStop ? ['        <tie type="stop"/>'] : []),
        ...(slot.tieStart ? ['        <tie type="start"/>'] : []),
        `        <type>${type}</type>`,
        ...Array.from({ length: dots }, () => '        <dot/>'),
        ...(slot.tieStop || slot.tieStart ? [
          '        <notations>',
          ...(slot.tieStop ? ['          <tied type="stop"/>'] : []),
          ...(slot.tieStart ? ['          <tied type="start"/>'] : []),
          '        </notations>',
        ] : []),
        '      </note>',
      )
    }

    xml.push('    </measure>')
  }

  xml.push('  </part>', '</score-partwise>', '')
  return xml.join('\n')
}

/** The editor's progression as export parts. */
export function progressionToParts(progression, inversions, durations) {
  return progression.map((chord, i) => ({
    chord,
    inversion: inversions?.[i] ?? 0,
    beats: toBeats(durations?.[i]),
  }))
}

export function downloadMusicXml(text, filename) {
  const blob = new Blob([text], { type: 'application/vnd.recordare.musicxml+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.musicxml') ? filename : `${filename}.musicxml`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
