import React, { useMemo } from 'react'
import { mod, midiName, prettyName } from '../theory/notes.js'
import { chordNotes, degreeLabel } from '../theory/chords.js'
import { pcOf } from '../theory/notes.js'
import { toneColor } from '../lib/colors.js'

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const isWhite = (m) => WHITE_PCS.includes(mod(m, 12))

// Black-key offsets from the left edge of the preceding white key, in white-key widths.
const BLACK_OFFSET = { 1: 0.62, 3: 0.72, 6: 0.6, 8: 0.7, 10: 0.8 }

export default function Piano({
  chord,
  voicing = [],
  selection = new Set(),
  onToggleNote,
  low = 48,
  high = 84,
  showLabels = true,
  scalePcs = null,
  guideTonePcs = null,
  // midi -> 'ref' | 'right' | 'wrong'. Used by the exercises to say which key
  // the question is pointing at, separately from which one you clicked.
  marks = null,
  readout = true,
}) {
  // Laid out in real units with a uniform preserveAspectRatio: stretching the
  // viewBox to fill the panel would squash the chord-tone dots into ellipses.
  const layout = useMemo(() => {
    const whites = []
    for (let m = low; m <= high; m++) if (isWhite(m)) whites.push(m)
    const W = 26
    const whiteX = new Map(whites.map((m, i) => [m, i * W]))
    const blacks = []
    for (let m = low; m <= high; m++) {
      if (isWhite(m)) continue
      const prevWhite = m - 1
      const base = whiteX.get(prevWhite)
      if (base === undefined) continue
      blacks.push({ midi: m, x: base + W * BLACK_OFFSET[mod(m, 12)] })
    }
    return { whites, blacks, W, whiteX }
  }, [low, high])

  const toneByPc = useMemo(() => {
    const map = new Map()
    for (const e of chordNotes(chord ?? null)) {
      const pc = pcOf(e.note)
      if (!map.has(pc)) map.set(pc, e)
    }
    return map
  }, [chord])

  const voiced = useMemo(() => new Set(voicing), [voicing])
  const scaleSet = useMemo(() => new Set(scalePcs ?? []), [scalePcs])
  const guideSet = useMemo(() => new Set(guideTonePcs ?? []), [guideTonePcs])
  const bassMidi = voicing.length ? Math.min(...voicing) : null

  const { whites, blacks, W } = layout
  const HEIGHT = 150
  const BLACK_H = HEIGHT * 0.62
  const blackW = W * 0.58
  const WIDTH = whites.length * W

  const cellFor = (midi) => {
    const pc = mod(midi, 12)
    const entry = toneByPc.get(pc)
    return {
      entry,
      inVoicing: voiced.has(midi),
      selected: selection.has(midi),
      isBass: midi === bassMidi,
      // A scale note that is not part of the chord: shown as a small marker so
      // the chord tones still read as the primary layer.
      inScale: scaleSet.has(pc) && !entry,
      isGuide: guideSet.has(pc),
      mark: marks?.get(midi) ?? null,
    }
  }

  // Pointer rather than mouse: touch devices do not deliver mousedown reliably,
  // so the keys were dead on a phone. The keyboard does not scroll, so a plain
  // press is enough here — no tap-vs-swipe test like the fretboard needs.
  const handle = (midi) => (ev) => {
    if (ev.pointerType === 'mouse') ev.preventDefault()
    onToggleNote && onToggleNote(midi)
  }

  return (
    <div className="piano">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="piano-svg" role="group" aria-label="Piano keyboard">
        {whites.map((midi) => {
          const { entry, inVoicing, selected, isBass, inScale, isGuide, mark } = cellFor(midi)
          return (
            <g key={midi} data-midi={midi} onPointerDown={handle(midi)} className="key-group">
              <rect
                x={layout.whiteX.get(midi)}
                y={0}
                width={W}
                height={HEIGHT}
                rx={3}
                className={`key white ${inVoicing ? 'in-voicing' : ''} ${selected ? 'selected' : ''} ${inScale ? 'in-scale' : ''} ${mark ? `mark-${mark}` : ''}`}
              />
              {inScale && (
                <circle cx={layout.whiteX.get(midi) + W / 2} cy={HEIGHT - 22} r={3} className="scale-dot" />
              )}
              {entry && inVoicing && isGuide && (
                <circle cx={layout.whiteX.get(midi) + W / 2} cy={HEIGHT - 22} r={13} className="guide-ring" />
              )}
              {entry && (
                <circle
                  cx={layout.whiteX.get(midi) + W / 2}
                  cy={HEIGHT - 22}
                  r={inVoicing ? 9.5 : 6.5}
                  fill={inVoicing ? toneColor(entry) : 'transparent'}
                  stroke={toneColor(entry)}
                  strokeWidth={inVoicing ? 0 : 1.3}
                  opacity={inVoicing ? 1 : 0.5}
                  className={isBass ? 'bass-dot' : ''}
                />
              )}
              {entry && inVoicing && showLabels && (
                <text
                  x={layout.whiteX.get(midi) + W / 2}
                  y={HEIGHT - 18.5}
                  className="tone-label dark"
                  style={{ fontSize: 10 }}
                >
                  {degreeLabel(entry, chord)}
                </text>
              )}
            </g>
          )
        })}

        {blacks.map(({ midi, x }) => {
          const { entry, inVoicing, selected, isBass, inScale, isGuide, mark } = cellFor(midi)
          return (
            <g key={midi} data-midi={midi} onPointerDown={handle(midi)} className="key-group">
              <rect
                x={x}
                y={0}
                width={blackW}
                height={BLACK_H}
                rx={2.5}
                className={`key black ${inVoicing ? 'in-voicing' : ''} ${selected ? 'selected' : ''} ${inScale ? 'in-scale' : ''} ${mark ? `mark-${mark}` : ''}`}
              />
              {inScale && <circle cx={x + blackW / 2} cy={BLACK_H - 16} r={2.6} className="scale-dot on-black" />}
              {entry && inVoicing && isGuide && (
                <circle cx={x + blackW / 2} cy={BLACK_H - 16} r={11} className="guide-ring" />
              )}
              {entry && (
                <circle
                  cx={x + blackW / 2}
                  cy={BLACK_H - 16}
                  r={inVoicing ? 8 : 5.5}
                  fill={inVoicing ? toneColor(entry) : 'transparent'}
                  stroke={toneColor(entry)}
                  strokeWidth={inVoicing ? 0 : 1.3}
                  opacity={inVoicing ? 1 : 0.55}
                  className={isBass ? 'bass-dot' : ''}
                />
              )}
              {entry && inVoicing && showLabels && (
                <text
                  x={x + blackW / 2}
                  y={BLACK_H - 12.5}
                  className="tone-label dark"
                  style={{ fontSize: 9 }}
                >
                  {degreeLabel(entry, chord)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* The readout is about building a chord. In a drill the keyboard is the
          answer sheet, and a standing invitation to "build a chord" is the wrong
          instruction sitting under the question. */}
      {readout && (
      <div className="piano-readout">
        {voicing.length ? (
          <>
            <span className="muted">Voicing</span>
            {voicing.map((m, i) => {
              const entry = toneByPc.get(mod(m, 12))
              return (
                <span key={`${m}-${i}`} className="pill tiny" style={{ borderColor: toneColor(entry) }}>
                  {entry ? prettyName(entry.note) : midiName(m)}
                  <sub>{Math.floor(m / 12) - 1}</sub>
                  {entry && <em>{degreeLabel(entry, chord)}</em>}
                </span>
              )
            })}
          </>
        ) : (
          <span className="muted">Click keys to build a chord, or pick one from the suggestions.</span>
        )}
      </div>
      )}
    </div>
  )
}
