import React, { useEffect, useRef, useState } from 'react'
import { chordSymbol } from '../theory/chords.js'
import { keyName, numeralFor, spellPitchInKey } from '../theory/keys.js'
import { LETTERS } from '../theory/notes.js'
import { timeSignatureOf } from '../theory/rhythm.js'
import { layOutMeasures, figureFor } from '../lib/leadsheet.js'
import { fifthsFor } from '../lib/musicxml.js'

/**
 * The progression on a staff, with the melody on it.
 *
 * Everything else in this app is drawn by hand — the fretboard, the piano, the
 * melody roll — and this one is not, deliberately. Those are diagrams with a
 * handful of primitives and no typographic tradition to fall short of. Music
 * engraving has four hundred years of one, and a hand-rolled clef, beam and
 * accidental stack would announce itself immediately as not quite right.
 * VexFlow is loaded on demand, the way jsPDF already is, so the studio stays as
 * light as it was for everyone who never opens this tab.
 *
 * What is *not* delegated is any musical decision. Where the bar lines fall,
 * which notes are tied across them, how a pitch is spelled and what the chord
 * above it is called all come from the engine — the same layOutMeasures the
 * MusicXML export uses. VexFlow is asked only to draw what it is given.
 */

/** VexFlow names a pitch "c#/4": letter, accidental, octave. */
function vexKey(spelled, octave) {
  const acc = spelled.acc > 0 ? '#'.repeat(spelled.acc) : spelled.acc < 0 ? 'b'.repeat(-spelled.acc) : ''
  return `${LETTERS[spelled.letter].toLowerCase()}${acc}/${octave}`
}

/** The key signature VexFlow wants, named rather than counted. */
const SIGNATURES = {
  '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
  0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
}

// Narrower than this and a bar cannot hold its chord symbol, let alone its
// notes; wider than four to a line and a lead sheet stops looking like one.
const MIN_BAR_WIDTH = 190
const MAX_BARS_PER_LINE = 4
const LINE_HEIGHT = 130

export default function StaffView({
  progression,
  inversions,
  durations,
  timeSignature,
  musicKey,
  melody = [],
  numeralStyle = 'roman',
}) {
  const host = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    let cancelled = false
    const node = host.current
    if (!node) return undefined
    node.innerHTML = ''
    if (!progression.length) { setLoading(false); return undefined }
    setLoading(true)

    // Loaded here rather than imported at the top so the tab pays for it and
    // nobody else does.
    import('vexflow').then((VF) => {
      if (cancelled || !host.current) return
      try {
        draw(VF, host.current, {
          progression, inversions, durations, timeSignature, musicKey, melody, numeralStyle,
        })
        setError(null)
      } catch (e) {
        // Engraving can fail on input the formatter cannot fit — better to say
        // so than to leave an empty box that looks like there is no music.
        setError(String(e?.message ?? e))
      } finally {
        setLoading(false)
      }
    }).catch((e) => {
      if (!cancelled) { setError(String(e?.message ?? e)); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [progression, inversions, durations, timeSignature, musicKey, melody, numeralStyle, width])

  // How many bars fit on a line depends on how wide the panel is, so the
  // engraving has to be redone when that changes — otherwise the staff keeps a
  // layout chosen for a window that is no longer there.
  useEffect(() => {
    const node = host.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width)
      // Ignore sub-pixel jitter, or every scrollbar appearing re-engraves.
      setWidth((prev) => (Math.abs(prev - w) > 12 ? w : prev))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (!progression.length) {
    return (
      <div className="staff-view">
        <p className="muted">
          Add some chords and they will be engraved here, with the melody on the staff
          and the numerals underneath.
        </p>
      </div>
    )
  }

  return (
    <div className="staff-view">
      {loading && <p className="muted small">Engraving…</p>}
      {error && (
        <p className="muted small staff-error">
          Could not engrave this: {error}. The chart and the exports are unaffected.
        </p>
      )}
      <div className="staff-host" ref={host} />
    </div>
  )
}

function draw(VF, node, opts) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation, StaveTie, Dot } = VF
  const { progression, inversions, durations, timeSignature, musicKey, melody, numeralStyle } = opts

  const parts = progression.map((chord, i) => ({
    chord,
    inversion: inversions?.[i] ?? 0,
    beats: durations?.[i],
  }))
  const measures = layOutMeasures(parts, { timeSignature, melody })
  const ts = timeSignatureOf(timeSignature)

  // Fit the bars to the space rather than scrolling: a lead sheet wraps, and a
  // staff you have to drag sideways is one you cannot read while playing.
  const available = Math.max(MIN_BAR_WIDTH + 40, (node.clientWidth || 640) - 8)
  const barsPerLine = Math.max(1, Math.min(MAX_BARS_PER_LINE, Math.floor((available - 40) / MIN_BAR_WIDTH)))
  const staveWidth = Math.floor((available - 40) / barsPerLine)

  const lines = Math.ceil(measures.length / barsPerLine)
  const width = 20 + barsPerLine * staveWidth + 20
  const height = 30 + lines * LINE_HEIGHT

  const renderer = new Renderer(node, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()

  measures.forEach((measure, i) => {
    const line = Math.floor(i / barsPerLine)
    const col = i % barsPerLine
    const first = col === 0
    const x = 20 + col * staveWidth
    const y = 10 + line * LINE_HEIGHT

    const stave = new Stave(x, y, staveWidth)
    // Clef and signatures only at the start of a line, the way a part is set.
    if (first) {
      stave.addClef('treble')
      stave.addKeySignature(SIGNATURES[String(fifthsFor(musicKey))] ?? 'C')
      if (line === 0) stave.addTimeSignature(`${ts.top}/${ts.bottom}`)
    }
    stave.setContext(ctx).draw()

    const ties = []
    const notes = measure.slots.map((slot) => {
      const { code, dots } = figureFor(slot.beats)
      const rest = slot.midi == null
      const spelled = rest ? null : spellPitchInKey(slot.midi, musicKey)

      const note = new StaveNote({
        keys: rest ? ['b/4'] : [vexKey(spelled.note, spelled.octave)],
        duration: rest ? `${code}r` : code,
        clef: 'treble',
      })
      for (let d = 0; d < dots; d++) Dot.buildAndAttach([note], { all: true })

      // The accidental has to be asked for explicitly: VexFlow draws the key
      // signature but will not infer which notes need reminding, and this app
      // knows exactly — the spelling came from the engine.
      if (!rest && spelled.note.acc !== 0) {
        const glyph = spelled.note.acc > 0 ? '#'.repeat(spelled.note.acc) : 'b'.repeat(-spelled.note.acc)
        note.addModifier(new Accidental(glyph), 0)
      }

      // Chord symbol above, numeral below — the two readings the app always
      // shows together.
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

    // Ties within the bar. A tie across a bar line would need both staves laid
    // out first, so those are left to the exports, where they are explicit.
    measure.slots.forEach((slot, n) => {
      if (slot.tieStart && n + 1 < notes.length && measure.slots[n + 1].tieStop) {
        ties.push(new StaveTie({ firstNote: notes[n], lastNote: notes[n + 1], firstIndexes: [0], lastIndexes: [0] }))
      }
    })
    ties.forEach((tie) => tie.setContext(ctx).draw())
  })
}
