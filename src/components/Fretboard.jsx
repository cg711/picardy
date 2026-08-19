import React, { useEffect, useMemo, useRef } from 'react'
import { mod } from '../theory/notes.js'
import { degreeLabel } from '../theory/chords.js'
import { fretboardMap, FRET_COUNT, voicingLabel } from '../theory/guitar.js'
import { toneColor } from '../lib/colors.js'

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE_INLAYS = [12, 24]

export default function Fretboard({
  chord,
  tuning,
  shape = null,
  showAllTones = true,
  selection = new Set(),
  onToggleNote,
  maxFret = FRET_COUNT,
  lefty = false,
  scalePcs = null,
  guideTonePcs = null,
}) {
  const grid = useMemo(() => fretboardMap(chord, tuning, maxFret), [chord, tuning, maxFret])

  const nStrings = tuning.length
  const NUT_X = 34
  const FRET_W = 46
  const STRING_GAP = 26
  const TOP = 22
  const width = NUT_X + FRET_W * maxFret + 26
  const height = TOP + STRING_GAP * (nStrings - 1) + 40

  // String 0 is the lowest-pitched; draw it at the bottom like a real neck.
  // A left-handed neck is the same drawing mirrored left-to-right: the nut moves
  // to the right and the frets ascend leftward, while the strings keep their
  // vertical order. Mirroring coordinates rather than applying an SVG transform
  // keeps the fret numbers and interval labels the right way round.
  const mx = (x) => (lefty ? width - x : x)
  const rectX = (x, w) => (lefty ? width - x - w : x)
  const yFor = (s) => TOP + STRING_GAP * (nStrings - 1 - s)
  const xFor = (f) => mx(f === 0 ? NUT_X - 17 : NUT_X + FRET_W * (f - 1) + FRET_W / 2)

  /**
   * Tap-to-select that survives touch.
   *
   * mousedown is not delivered reliably on touch devices, so picking notes did
   * not work on a phone at all. Pointer events cover mouse, touch and pen — but
   * firing on pointerdown alone would select a note every time you swiped the
   * neck sideways, and the neck is wider than the screen so swiping it is the
   * normal way to move around. Hence: remember where the press started, and only
   * count it as a tap if the finger came up in roughly the same place.
   */
  const pressRef = useRef(null)
  const tap = (midi) => ({
    onPointerDown: (e) => {
      // Stops the text-selection drag on mouse; left alone on touch so the
      // browser can still scroll the neck.
      if (e.pointerType === 'mouse') e.preventDefault()
      pressRef.current = { x: e.clientX, y: e.clientY, midi }
    },
    onPointerUp: (e) => {
      const press = pressRef.current
      pressRef.current = null
      if (!press || press.midi !== midi) return
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) return
      onToggleNote && onToggleNote(midi)
    },
  })

  const inShape = (s, f) => shape && shape.frets[s] === f
  const shapeMuted = (s) => shape && shape.frets[s] === null
  const scaleSet = new Set(scalePcs ?? [])
  const guideSet = new Set(guideTonePcs ?? [])
  // Scale notes that are not chord tones, drawn small so the chord still leads.
  const scaleOnly = (stringIndex, fret) => {
    if (!scaleSet.size) return false
    const pc = mod(tuning[stringIndex] + fret, 12)
    return scaleSet.has(pc) && !grid[stringIndex][fret]
  }

  // The neck is wider than the panel and scrolls. Keep the nut end in view:
  // that is the left edge normally, and the right edge for a lefty.
  const wrapRef = useRef(null)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    el.scrollLeft = lefty ? el.scrollWidth - el.clientWidth : 0
  }, [lefty])

  return (
    <div className="fretboard-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="fretboard" role="group" aria-label="Guitar fretboard">
        <rect x={rectX(NUT_X, FRET_W * maxFret)} y={TOP - 13} width={FRET_W * maxFret} height={STRING_GAP * (nStrings - 1) + 26} className="board" rx="3" />
        <rect x={rectX(NUT_X - 5, 5)} y={TOP - 13} width={5} height={STRING_GAP * (nStrings - 1) + 26} className="nut" />

        {Array.from({ length: maxFret }, (_, i) => i + 1).map((f) => (
          <line
            key={`fw${f}`}
            x1={mx(NUT_X + FRET_W * f)}
            x2={mx(NUT_X + FRET_W * f)}
            y1={TOP - 13}
            y2={TOP + STRING_GAP * (nStrings - 1) + 13}
            className="fretwire"
          />
        ))}

        {INLAYS.filter((f) => f <= maxFret).map((f) => (
          <circle key={`in${f}`} cx={mx(NUT_X + FRET_W * (f - 0.5))} cy={TOP + (STRING_GAP * (nStrings - 1)) / 2} r="5" className="inlay" />
        ))}
        {DOUBLE_INLAYS.filter((f) => f <= maxFret).map((f) => (
          <g key={`din${f}`}>
            <circle cx={mx(NUT_X + FRET_W * (f - 0.5))} cy={TOP + STRING_GAP * 1.1} r="5" className="inlay" />
            <circle cx={mx(NUT_X + FRET_W * (f - 0.5))} cy={TOP + STRING_GAP * (nStrings - 2.1)} r="5" className="inlay" />
          </g>
        ))}

        {tuning.map((open, s) => (
          <line
            key={`s${s}`}
            x1={mx(NUT_X - 5)}
            x2={mx(NUT_X + FRET_W * maxFret)}
            y1={yFor(s)}
            y2={yFor(s)}
            className="string"
            strokeWidth={0.9 + (nStrings - 1 - s) * 0.35}
          />
        ))}

        {/* Open-string / muted markers left of the nut */}
        {tuning.map((open, s) => {
          const entry = grid[s][0]
          const active = inShape(s, 0)
          const muted = shapeMuted(s)
          return (
            <text key={`om${s}`} x={mx(NUT_X - 24)} y={yFor(s) + 4} className={`open-mark ${active ? 'active' : ''}`}>
              {muted ? '×' : entry ? (active ? '○' : '·') : ''}
            </text>
          )
        })}

        {scaleSet.size > 0 && grid.map((row, s) =>
          row.map((_, f) => {
            if (!scaleOnly(s, f)) return null
            return (
              <circle
                key={`sc${s}-${f}`}
                cx={xFor(f)}
                cy={yFor(s)}
                r={2.6}
                className="scale-dot"
              />
            )
          }),
        )}

        {/*
          A hit target at every position on the neck.

          The dots below are drawn from fretboardMap, which only returns entries
          for chord *tones* — so hanging the click handler off them meant you
          could only pick notes already in the chord, and with no chord selected
          the neck had no hit targets at all. That is precisely backwards for the
          "from notes" input, whose whole job is spelling a chord you have not
          entered yet. These sit underneath, so a chord-tone dot still handles its
          own click and nothing here changes what the neck looks like.
        */}
        <g className="fret-hits">
          {tuning.map((open, s) =>
            Array.from({ length: maxFret + 1 }, (_, f) => {
              const midi = open + f
              return (
                <circle
                  key={`h${s}-${f}`}
                  cx={xFor(f)}
                  cy={yFor(s)}
                  r={13}
                  {...tap(midi)}
                >
                  <title>{`String ${nStrings - s}, fret ${f}`}</title>
                </circle>
              )
            }),
          )}
        </g>

        {/* A note picked by hand that is not a chord tone still has to show, or
            clicking the neck looks like it did nothing. */}
        {tuning.map((open, s) =>
          Array.from({ length: maxFret + 1 }, (_, f) => {
            const midi = open + f
            if (!selection.has(midi) || grid[s][f]) return null
            return (
              <g key={`p${s}-${f}`} className="picked-note" pointerEvents="none">
                <circle cx={xFor(f)} cy={yFor(s)} r={f === 0 ? 10 : 11} />
                <circle cx={xFor(f)} cy={yFor(s)} r={14} className="sel-ring" />
              </g>
            )
          }),
        )}

        {grid.map((row, s) =>
          row.map((entry, f) => {
            if (!entry) return null
            if (f === 0) return null
            const active = inShape(s, f)
            if (!active && !showAllTones) return null
            const midi = entry.midi
            const selected = selection.has(midi)
            return (
              <g
                key={`n${s}-${f}`}
                className="fret-dot"
                {...tap(midi)}
              >
                <circle
                  cx={xFor(f)}
                  cy={yFor(s)}
                  r={active ? 11 : 8}
                  fill={active ? toneColor(entry) : 'transparent'}
                  stroke={toneColor(entry)}
                  strokeWidth={active ? 0 : 1.2}
                  opacity={active ? 1 : 0.42}
                />
                {selected && <circle cx={xFor(f)} cy={yFor(s)} r={14} className="sel-ring" />}
                {active && guideSet.has(mod(entry.midi, 12)) && (
                  <circle cx={xFor(f)} cy={yFor(s)} r={14} className="guide-ring" />
                )}
                {active && (
                  <text x={xFor(f)} y={yFor(s) + 3.5} className="tone-label dark small">
                    {degreeLabel(entry, chord)}
                  </text>
                )}
              </g>
            )
          }),
        )}

        {/* Open strings that belong to the chord */}
        {grid.map((row, s) => {
          const entry = row[0]
          if (!entry) return null
          const active = inShape(s, 0)
          if (!active && !showAllTones) return null
          return (
            <g key={`o${s}`} className="fret-dot" {...tap(entry.midi)}>
              <circle
                cx={xFor(0)}
                cy={yFor(s)}
                r={active ? 10 : 7}
                fill={active ? toneColor(entry) : 'transparent'}
                stroke={toneColor(entry)}
                strokeWidth={active ? 0 : 1.2}
                opacity={active ? 1 : 0.42}
              />
              {active && <text x={xFor(0)} y={yFor(s) + 3.5} className="tone-label dark small">{degreeLabel(entry, chord)}</text>}
            </g>
          )
        })}

        {Array.from({ length: maxFret }, (_, i) => i + 1).map((f) => (
          <text key={`fn${f}`} x={mx(NUT_X + FRET_W * (f - 0.5))} y={height - 12} className="fret-num">
            {f}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** Compact vertical chord box used in the voicing picker. */
export function ChordBox({ shape, chord, tuning, active, onClick, label, lefty = false }) {
  const frets = shape.frets
  const fretted = frets.filter((f) => f !== null && f > 0)
  const base = fretted.length ? Math.max(1, Math.min(...fretted)) : 1
  const showNut = base === 1 && (!fretted.length || Math.max(...fretted) <= 4)
  const start = showNut ? 1 : base
  const rows = 4
  const W = 74
  const H = 92
  const left = 12
  const top = 16
  const colW = (W - left - 8) / (frets.length - 1)
  const rowH = (H - top - 12) / rows

  return (
    <button className={`chord-box ${active ? 'active' : ''}`} onClick={onClick} title={label}>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {!showNut && (
          <text
            x={lefty ? left + colW * (frets.length - 1) + 9 : left - 9}
            y={top + rowH * 0.75}
            className="box-pos"
          >
            {start}
          </text>
        )}
        <line x1={left} x2={left + colW * (frets.length - 1)} y1={top} y2={top} className={showNut ? 'box-nut' : 'box-fret'} />
        {Array.from({ length: rows }, (_, i) => i + 1).map((r) => (
          <line key={r} x1={left} x2={left + colW * (frets.length - 1)} y1={top + rowH * r} y2={top + rowH * r} className="box-fret" />
        ))}
        {frets.map((_, s) => (
          <line key={s} x1={left + colW * s} x2={left + colW * s} y1={top} y2={top + rowH * rows} className="box-string" />
        ))}
        {frets.map((f, s) => {
          // Right-handed boxes read low E on the left; left-handed ones mirror
          // it. This has to agree with the neck diagram above, where a lefty
          // nut sits on the right.
          const column = lefty ? frets.length - 1 - s : s
          const x = left + colW * column
          if (f === null) return <text key={s} x={x} y={top - 4} className="box-mark">×</text>
          if (f === 0) return <text key={s} x={x} y={top - 4} className="box-mark">○</text>
          const rowIdx = f - start
          if (rowIdx < 0 || rowIdx >= rows) return null
          return <circle key={s} cx={x} cy={top + rowH * (rowIdx + 0.5)} r={rowH * 0.32} className="box-dot" />
        })}
      </svg>
      <span className="box-label">{voicingLabel(shape)}</span>
    </button>
  )
}

