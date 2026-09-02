import React, { useEffect, useRef, useState } from 'react'
import { chordSymbol } from '../theory/chords.js'
import { numeralFor } from '../theory/keys.js'
import { fifthsFor } from '../lib/musicxml.js'
import { SIGNATURES, vexPitch } from '../lib/vexbridge.js'

/**
 * The chord under the keyboard, written down.
 *
 * A grand staff rather than a single one, because this shows the voicing the
 * piano is actually holding — which starts below middle C and would otherwise
 * be a column of ledger lines. Notes split at middle C the way two hands do.
 *
 * The keyboard above says which keys; this says what a reader would call them.
 * It is the same information the app has always had and never written out: the
 * spelling is the engine's, so an A♭ is drawn as an A♭ and not as a G♯, which
 * is the one thing a piano diagram physically cannot show you.
 */

const MIDDLE_C = 60
const WIDTH = 220
const HEIGHT = 190

export default function ChordStaff({ chord, voicing = [], musicKey, inversion = 0, numeralStyle = 'roman' }) {
  const host = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const node = host.current
    if (!node) return undefined
    node.innerHTML = ''
    if (!chord || !voicing.length || !musicKey) return undefined

    import('vexflow').then((VF) => {
      if (cancelled || !host.current) return
      try {
        drawChord(VF, host.current, { chord, voicing, musicKey, inversion, numeralStyle })
        setFailed(false)
      } catch {
        // A voicing the formatter cannot place is not worth an error message
        // here — the keyboard above is still showing it.
        setFailed(true)
      }
    }).catch(() => { if (!cancelled) setFailed(true) })

    return () => { cancelled = true }
  }, [chord, voicing, musicKey, inversion, numeralStyle])

  if (!chord || !voicing.length) return null

  return (
    <div className="chord-staff">
      <div ref={host} />
      {failed && <span className="muted small">Could not engrave this voicing.</span>}
    </div>
  )
}

function drawChord(VF, node, { chord, voicing, musicKey, inversion, numeralStyle }) {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation, StaveConnector } = VF

  const renderer = new Renderer(node, Renderer.Backends.SVG)
  renderer.resize(WIDTH, HEIGHT)
  const ctx = renderer.getContext()

  const signature = SIGNATURES[String(fifthsFor(musicKey))] ?? 'C'
  const treble = new Stave(10, 10, WIDTH - 20).addClef('treble').addKeySignature(signature)
  const bass = new Stave(10, 95, WIDTH - 20).addClef('bass').addKeySignature(signature)
  treble.setContext(ctx).draw()
  bass.setContext(ctx).draw()
  new StaveConnector(treble, bass).setType(StaveConnector.type.BRACE).setContext(ctx).draw()
  new StaveConnector(treble, bass).setType(StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw()

  const sorted = [...voicing].sort((a, b) => a - b)
  const halves = [
    { clef: 'treble', stave: treble, midis: sorted.filter((m) => m >= MIDDLE_C) },
    { clef: 'bass', stave: bass, midis: sorted.filter((m) => m < MIDDLE_C) },
  ]

  for (const half of halves) {
    let note
    if (half.midis.length) {
      const pitches = half.midis.map((m) => vexPitch(m, musicKey))
      note = new StaveNote({ keys: pitches.map((p) => p.key), duration: 'w', clef: half.clef })
      // One accidental per notehead, addressed by index — a chord with two
      // altered notes needs both, and VexFlow attaches them positionally.
      pitches.forEach((p, i) => {
        if (p.accidental) note.addModifier(new Accidental(p.accidental), i)
      })
      if (half.clef === 'treble') {
        note.addModifier(
          new Annotation(chordSymbol(chord)).setVerticalJustification(Annotation.VerticalJustify.TOP),
        )
      }
      if (half.clef === 'bass') {
        note.addModifier(
          new Annotation(numeralFor(chord, musicKey, inversion, numeralStyle))
            .setVerticalJustification(Annotation.VerticalJustify.BOTTOM),
        )
      }
    } else {
      // A hand with nothing to play still needs its bar filled.
      note = new StaveNote({ keys: [half.clef === 'treble' ? 'b/4' : 'd/3'], duration: 'wr', clef: half.clef })
    }

    const voice = new Voice({ numBeats: 4, beatValue: 4 })
    voice.setStrict(false)
    voice.addTickables([note])
    new Formatter().joinVoices([voice]).format([voice], WIDTH - 110)
    voice.draw(ctx, half.stave)
  }
}
