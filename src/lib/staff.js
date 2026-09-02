// Engraving a progression onto staves.
//
// Everything else in this app is drawn by hand — the fretboard, the piano, the
// melody roll. Those are diagrams built from a handful of primitives with no
// typographic tradition to fall short of. Music engraving has four hundred
// years of one, and a hand-rolled clef, beam and accidental stack announces
// itself immediately as not quite right, so VexFlow does the drawing here.
//
// It is loaded on demand and only by the PDF export, so it costs nothing to
// anyone who never ticks the box.
//
// No musical decision is delegated. Where the bar lines fall, which notes are
// tied across them, how a pitch is spelled and what the chord above it is
// called all come from the engine — layOutMeasures is the same function the
// MusicXML export uses. VexFlow is asked only to draw what it is given.

import { chordSymbol } from '../theory/chords.js'
import { numeralFor } from '../theory/keys.js'
import { timeSignatureOf } from '../theory/rhythm.js'
import { layOutMeasures, figureFor } from './leadsheet.js'
import { fifthsFor } from './musicxml.js'
import { SIGNATURES, vexPitch } from './vexbridge.js'

const LINE_HEIGHT = 130

/**
 * Draw a progression onto a canvas, one system per line.
 *
 * Canvas rather than SVG because the only caller is the PDF, and jsPDF takes a
 * raster image without a plugin. Rendered at `scale` so it is not soft when the
 * page is printed.
 *
 * @returns { width, height } in CSS pixels, or null when there is nothing to draw
 */
export function drawStaffToCanvas(VF, canvas, {
  progression,
  inversions,
  durations,
  timeSignature = '4/4',
  musicKey,
  melody = [],
  numeralStyle = 'roman',
  barsPerLine = 4,
  staveWidth = 240,
  scale = 2,
}) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation, StaveTie, Dot } = VF
  if (!progression?.length || !musicKey) return null

  const parts = progression.map((chord, i) => ({
    chord,
    inversion: inversions?.[i] ?? 0,
    beats: durations?.[i],
  }))
  const measures = layOutMeasures(parts, { timeSignature, melody })
  const ts = timeSignatureOf(timeSignature)

  const lines = Math.ceil(measures.length / barsPerLine)
  const width = 20 + barsPerLine * staveWidth + 20
  const height = 20 + lines * LINE_HEIGHT

  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const c2d = canvas.getContext('2d')
  // A transparent canvas becomes black in a PDF, so the page is painted first.
  c2d.fillStyle = '#ffffff'
  c2d.fillRect(0, 0, canvas.width, canvas.height)
  c2d.scale(scale, scale)

  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS)
  const ctx = renderer.getContext()

  measures.forEach((measure, i) => {
    const line = Math.floor(i / barsPerLine)
    const col = i % barsPerLine
    const first = col === 0
    const x = 20 + col * staveWidth
    const y = 5 + line * LINE_HEIGHT

    const stave = new Stave(x, y, staveWidth)
    // Clef and signatures at the start of a line, the way a part is set.
    if (first) {
      stave.addClef('treble')
      stave.addKeySignature(SIGNATURES[String(fifthsFor(musicKey))] ?? 'C')
      if (line === 0) stave.addTimeSignature(`${ts.top}/${ts.bottom}`)
    }
    stave.setContext(ctx).draw()

    const notes = measure.slots.map((slot) => {
      const { code, dots } = figureFor(slot.beats)
      const rest = slot.midi == null
      const pitch = rest ? null : vexPitch(slot.midi, musicKey)

      const note = new StaveNote({
        keys: rest ? ['b/4'] : [pitch.key],
        duration: rest ? `${code}r` : code,
        clef: 'treble',
      })
      for (let d = 0; d < dots; d++) Dot.buildAndAttach([note], { all: true })
      // Stated rather than inferred: VexFlow draws the key signature but will
      // not work out which notes still need one, and this app knows.
      if (pitch?.accidental) note.addModifier(new Accidental(pitch.accidental), 0)

      if (slot.chord) {
        note.addModifier(
          new Annotation(chordSymbol(slot.chord))
            .setVerticalJustification(Annotation.VerticalJustify.TOP),
        )
        note.addModifier(
          new Annotation(numeralFor(slot.chord, musicKey, slot.inversion, numeralStyle))
            .setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
        )
      }
      return note
    })

    if (!notes.length) return

    const voice = new Voice({ numBeats: ts.top, beatValue: ts.bottom })
    voice.setStrict(false)
    voice.addTickables(notes)
    new Formatter().joinVoices([voice]).format([voice], staveWidth - (first ? 90 : 30))
    voice.draw(ctx, stave)

    // Ties within the bar. One across a bar line would need both systems placed
    // first; those stay in the MusicXML export, where they are explicit anyway.
    measure.slots.forEach((slot, n) => {
      if (slot.tieStart && n + 1 < notes.length && measure.slots[n + 1].tieStop) {
        new StaveTie({ firstNote: notes[n], lastNote: notes[n + 1], firstIndexes: [0], lastIndexes: [0] })
          .setContext(ctx).draw()
      }
    })
  })

  return { width, height }
}
