import React, { useMemo, useRef, useState } from 'react'
import { chordSymbol, voiceChord } from '../theory/chords.js'
import { midiName, mod } from '../theory/notes.js'
import { timeSignatureOf } from '../theory/rhythm.js'
import { classifyNote, chordAtBeat, rollRange, normaliseMelody } from '../theory/melody.js'
import { playChord } from '../audio/synth.js'

const ROW = 13
const BEAT = 30
const GUTTER = 40
const BLACK = new Set([1, 3, 6, 8, 10])

/**
 * A melody roll that knows what the chords are.
 *
 * Drawn as one SVG rather than a grid of elements: a sixteen-bar line at eighth
 * resolution is a couple of thousand cells, and the browser should not be asked
 * to lay out two thousand divs so that someone can click four of them. It also
 * matches how the fretboard and keyboard are drawn.
 */
export default function MelodyRoll({
  progression,
  durations,
  timeSignature,
  musicKey,
  melody = [],
  onChange,
  playingIndex = -1,
  snap = 0.5,
  noteLength = 1,
}) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const ts = timeSignatureOf(timeSignature)
  const total = durations.reduce((a, b) => a + b, 0)
  const { low, high } = useMemo(() => rollRange(musicKey), [musicKey])
  const rows = high - low + 1

  const width = GUTTER + total * BEAT
  const height = rows * ROW

  const yFor = (midi) => (high - midi) * ROW
  const xFor = (beat) => GUTTER + beat * BEAT

  // Where each chord sits along the roll, so its band and label can be drawn.
  const spans = useMemo(() => {
    const out = []
    let at = 0
    progression.forEach((chord, i) => {
      out.push({ chord, index: i, start: at, end: at + durations[i] })
      at += durations[i]
    })
    return out
  }, [progression, durations])

  const notes = useMemo(() => normaliseMelody(melody), [melody])

  /** Pointer position as a snapped beat and a MIDI number. */
  const at = (event) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const scale = width / rect.width
    const x = (event.clientX - rect.left) * scale - GUTTER
    const y = (event.clientY - rect.top) * scale
    if (x < 0) return null
    const beat = Math.max(0, Math.min(total - snap, Math.round(x / BEAT / snap) * snap))
    const midi = high - Math.floor(y / ROW)
    if (midi < low || midi > high) return null
    return { beat: +beat.toFixed(4), midi }
  }

  /**
   * Add or remove a note.
   *
   * onChange is called with an updater rather than a finished array, so two
   * clicks that land in one React batch both survive — the second would
   * otherwise be computed from the array as it was before the first, and one of
   * the two notes would vanish.
   */
  const click = (event) => {
    const spot = at(event)
    if (!spot || !onChange) return
    const hit = (list) => list.find(
      (n) => n.midi === spot.midi && spot.beat >= n.at - 1e-6 && spot.beat < n.at + n.beats - 1e-6,
    )
    if (hit(notes)) {
      onChange((prev) => {
        const list = normaliseMelody(prev ?? [])
        const gone = hit(list)
        return gone ? list.filter((n) => n !== gone) : list
      })
      return
    }
    onChange((prev) => normaliseMelody([...(prev ?? []), { at: spot.beat, beats: noteLength, midi: spot.midi }]))
    // Hear it as you place it. Writing a line by clicking silently is guessing;
    // the chord underneath is what the note has to work against, so it sounds
    // too, quietly enough that the melody note stays on top.
    const under = chordAtBeat(progression, durations, spot.beat)
    playChord([spot.midi], { duration: 0.7, timbre: 'lead' })
    if (under.chord) {
      playChord(voiceChord(under.chord, { bottom: 48 }), { duration: 0.7, timbre: 'pad', gain: 0.06 })
    }
  }

  const hovered = hover ? chordAtBeat(progression, durations, hover.beat) : null
  const hoverInfo = hovered?.chord ? classifyNote(hover.midi, hovered.chord, musicKey) : null

  return (
    <div className="melody-roll">
      <div className="roll-scroll">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: `${width}px`, height: `${height}px` }}
          className="roll-svg"
          onClick={click}
          onPointerMove={(e) => setHover(at(e))}
          onPointerLeave={() => setHover(null)}
          role="group"
          aria-label="Melody"
        >
          {/* Rows. Black-key rows are shaded so the octave is readable without
              counting, the same cue a piano gives. */}
          {Array.from({ length: rows }, (_, r) => {
            const midi = high - r
            return (
              <rect
                key={midi}
                x={GUTTER} y={r * ROW} width={total * BEAT} height={ROW}
                className={`roll-row${BLACK.has(mod(midi, 12)) ? ' black' : ''}`}
              />
            )
          })}

          {/* Chord bands behind the notes: what is sounding, and for how long. */}
          {spans.map((span) => (
            <g key={span.index}>
              <rect
                x={xFor(span.start)} y={0}
                width={(span.end - span.start) * BEAT} height={height}
                className={`roll-span${span.index === playingIndex ? ' on' : ''}`}
              />
              <text x={xFor(span.start) + 5} y={12} className="roll-chord">
                {chordSymbol(span.chord)}
              </text>
            </g>
          ))}

          {/* Bar lines on top of the bands, beat lines underneath the notes. */}
          {Array.from({ length: Math.floor(total / snap) + 1 }, (_, i) => {
            const beat = i * snap
            if (beat > total) return null
            const isBar = Math.abs(beat % ts.beatsPerBar) < 1e-6
            const isPulse = Math.abs(beat % 1) < 1e-6
            return (
              <line
                key={beat}
                x1={xFor(beat)} y1={0} x2={xFor(beat)} y2={height}
                className={`roll-line${isBar ? ' bar' : isPulse ? ' pulse' : ''}`}
              />
            )
          })}

          {/* Octave labels in the gutter. Only the Cs, or it is a wall of text. */}
          {Array.from({ length: rows }, (_, r) => {
            const midi = high - r
            if (mod(midi, 12) !== 0) return null
            return (
              <text key={midi} x={GUTTER - 6} y={r * ROW + ROW - 3} className="roll-octave">
                {midiName(midi)}
              </text>
            )
          })}

          {notes.map((note, i) => {
            const under = chordAtBeat(progression, durations, note.at)
            const info = under.chord ? classifyNote(note.midi, under.chord, musicKey) : null
            return (
              <g key={`${note.at}-${note.midi}-${i}`} className={`roll-note ${info?.role ?? 'outside'}`}>
                <rect
                  x={xFor(note.at) + 1} y={yFor(note.midi) + 1}
                  width={Math.max(6, note.beats * BEAT - 2)} height={ROW - 2}
                  rx={2}
                />
                {note.beats * BEAT > 24 && info?.label && (
                  <text x={xFor(note.at) + 5} y={yFor(note.midi) + ROW - 4}>{info.label}</text>
                )}
              </g>
            )
          })}

          {hover && (
            <rect
              x={xFor(hover.beat)} y={yFor(hover.midi)}
              width={Math.max(6, noteLength * BEAT)} height={ROW}
              className="roll-ghost"
            />
          )}
        </svg>
      </div>

      {/* The readout is the feature. A roll that only draws pitches is a
          sequencer; this says what the note under the pointer would be doing. */}
      <div className={`roll-readout${hoverInfo ? ` ${hoverInfo.role}` : ''}`}>
        {hoverInfo ? (
          <>
            <strong>{midiName(hover.midi)}</strong>
            <span className="roll-role">{hoverInfo.label || hoverInfo.role}</span>
            <span className="roll-why">
              over {chordSymbol(hovered.chord)} — {hoverInfo.why}
            </span>
          </>
        ) : (
          <span className="roll-why">
            Click to place a note, click it again to remove it. Hover to see what it
            is doing against the chord underneath.
          </span>
        )}
      </div>
    </div>
  )
}
