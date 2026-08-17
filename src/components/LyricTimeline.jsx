import React, { useRef, useState } from 'react'
import { chordSymbol } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'
import { toBeats, timeSignatureOf, snapBeat, fractionLabel, MIN_BEATS } from '../theory/rhythm.js'

const PX_PER_BEAT = 46

/**
 * Lyrics as plain text with a chord lane above each line.
 *
 * Chords live on a beat timeline drawn at a constant scale, so a bar is the
 * same width on every line. Dragging a chord ripples: it lengthens the chord
 * before it and everything after simply moves along, which is what makes it
 * feel like sliding a divider rather than editing two numbers.
 */
export default function LyricTimeline({
  progression,
  durations,
  lines,
  lyricLines,
  musicKey,
  timeSignature,
  activeIndex,
  playingIndex,
  onSelect,
  onLyricLines,
  onDragChord,
  onMoveChordToLine,
  onRemove,
}) {
  const [dragging, setDragging] = useState(null)

  const perBar = timeSignatureOf(timeSignature).beatsPerBar

  // Group chords by the lyric line they sit over, with their start beat.
  const byLine = new Map()
  let cursor = 0
  progression.forEach((chord, i) => {
    const line = lines[i] ?? 0
    if (!byLine.has(line)) byLine.set(line, { chords: [], beats: 0 })
    const bucket = byLine.get(line)
    bucket.chords.push({ chord, index: i, start: bucket.beats, beats: toBeats(durations[i]) })
    bucket.beats += toBeats(durations[i])
    cursor += toBeats(durations[i])
  })

  const lineCount = Math.max(lyricLines.length, ...[...byLine.keys()].map((n) => n + 1), 1)

  // --- dragging --------------------------------------------------------------
  //
  // Pointer capture rather than window listeners: capture is established
  // synchronously inside the pointerdown handler, so there is no window between
  // pressing and being able to drag. Listening on `window` after a state change
  // would miss any movement that happens before React re-renders.

  const dragRef = useRef(null)

  const onPointerDown = (event, entry) => {
    // The first chord of a line anchors it; there is nothing before it to take
    // time from, so it stays put.
    if (entry.start === 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      index: entry.index,
      originBeat: entry.start,
      pointerOrigin: event.clientX,
      applied: 0,
    }
    setDragging(entry.index)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const deltaBeats = (event.clientX - drag.pointerOrigin) / PX_PER_BEAT
    const raw = drag.originBeat + deltaBeats
    // Hold a modifier to bypass the grid entirely for fine placement.
    const target = event.altKey ? Math.max(0, raw) : snapBeat(raw, timeSignature)
    const wanted = target - drag.originBeat
    // Durations are cumulative, so only send what has not been applied yet.
    const step = wanted - drag.applied
    if (Math.abs(step) < 1e-6) return
    drag.applied = wanted
    onDragChord(drag.index, step)
  }

  const endDrag = (event) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(null)
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const setLine = (index, text) => {
    const next = [...lyricLines]
    while (next.length <= index) next.push('')
    next[index] = text
    onLyricLines(next)
  }

  return (
    <div className={`lyric-timeline ${dragging ? 'dragging' : ''}`}>
      <p className="muted small tl-hint">
        Type lyrics below each chord lane. Drag a chord to move it — it snaps to bars and beats
        when close, and holding <kbd>⌥</kbd> turns snapping off for mid-word placement.
      </p>

      {Array.from({ length: lineCount }, (_, line) => {
        const bucket = byLine.get(line) ?? { chords: [], beats: 0 }
        const width = Math.max(bucket.beats, perBar * 2) * PX_PER_BEAT
        const bars = Math.ceil(width / PX_PER_BEAT / perBar)

        return (
          <div className="tl-line" key={line}>
            <div className="tl-lane-wrap">
              <div className="tl-lane" style={{ width }}>
                {/* Bar and beat grid, so the snap targets are visible. */}
                {Array.from({ length: bars * perBar + 1 }, (_, b) => (
                  <span
                    key={b}
                    className={`tl-grid ${b % perBar === 0 ? 'bar' : ''}`}
                    style={{ left: b * PX_PER_BEAT }}
                  >
                    {b % perBar === 0 && <em>{b / perBar + 1}</em>}
                  </span>
                ))}

                {bucket.chords.map((entry) => (
                  <button
                    key={entry.index}
                    className={`tl-chord ${entry.index === activeIndex ? 'active' : ''} ${entry.index === playingIndex ? 'playing' : ''} ${entry.start === 0 ? 'anchored' : ''} ${dragging === entry.index ? 'grabbing' : ''}`}
                    style={{ left: entry.start * PX_PER_BEAT, width: Math.max(28, entry.beats * PX_PER_BEAT - 3) }}
                    onPointerDown={(e) => onPointerDown(e, entry)}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={() => onSelect(entry.index)}
                    title={`${chordSymbol(entry.chord)} · ${fractionLabel(entry.beats)}${entry.start === 0 ? ' · anchors the line' : ' · drag to move'}`}
                  >
                    <span className="tl-symbol">{chordSymbol(entry.chord)}</span>
                    <span className="tl-roman">{romanNumeral(entry.chord, musicKey)}</span>
                    <span
                      className="tl-remove"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(entry.index)
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>

              <textarea
                className="tl-lyric"
                style={{ width }}
                value={lyricLines[line] ?? ''}
                onChange={(e) => setLine(line, e.target.value)}
                placeholder={line === 0 ? 'Type the first line of lyrics…' : ''}
                rows={1}
                spellCheck={false}
                aria-label={`Lyrics, line ${line + 1}`}
              />
            </div>

            <div className="tl-line-actions">
              <span className="tl-line-num">{line + 1}</span>
              {bucket.chords.length > 0 && line > 0 && (
                <button
                  title="Move this line's first chord up to the previous line"
                  onClick={() => onMoveChordToLine(bucket.chords[0].index, line - 1)}
                >
                  ↑
                </button>
              )}
              {bucket.chords.length > 0 && (
                <button
                  title="Move this line's last chord down to the next line"
                  onClick={() => onMoveChordToLine(bucket.chords[bucket.chords.length - 1].index, line + 1)}
                >
                  ↓
                </button>
              )}
            </div>
          </div>
        )
      })}

      <button className="btn ghost tiny" onClick={() => onLyricLines([...lyricLines, ''])}>
        + add a line
      </button>
    </div>
  )
}
