import React, { useRef, useState } from 'react'
import { chordSymbol } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'

/**
 * Lyrics as plain text with a chord lane above each line.
 *
 * This lane aligns chords to *syllables*, and nothing else. It deliberately does
 * not touch beat lengths: how long a chord lasts is a rhythmic decision made on
 * the Chords tab, while where it sits over a word is a typographic one, and
 * tying them together meant nudging a chord over a syllable silently rewrote the
 * rhythm.
 *
 * So the chords on a line divide that line's full width between them. Each keeps
 * a relative weight (`spans`), and dragging the boundary *between* two chords
 * moves width from one to the other — their total never changes, so the row
 * always stays exactly full and no other line is disturbed.
 */
export default function LyricTimeline({
  progression,
  lines,
  spans,
  lyricLines,
  musicKey,
  activeIndex,
  playingIndex,
  onSelect,
  onLyricLines,
  onResize,
  onMoveChordToLine,
  onRemove,
}) {
  const [dragging, setDragging] = useState(null)
  const dragRef = useRef(null)

  // Group chords by the lyric line they sit over.
  const byLine = new Map()
  progression.forEach((chord, i) => {
    const line = lines[i] ?? 0
    if (!byLine.has(line)) byLine.set(line, [])
    byLine.get(line).push({ chord, index: i, span: spans[i] > 0 ? spans[i] : 1 })
  })

  const lineCount = Math.max(lyricLines.length, ...[...byLine.keys()].map((n) => n + 1), 1)

  /**
   * Drag a boundary. Pointer capture is established synchronously in the
   * pointerdown handler, so no movement is missed between pressing and the state
   * update landing.
   */
  const startResize = (event, left, right, laneEl) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      leftIndex: left.index,
      rightIndex: right.index,
      leftSpan: left.span,
      rightSpan: right.span,
      originX: event.clientX,
      laneWidth: laneEl?.getBoundingClientRect().width || 1,
      total: 0,
    }
    // The pair's combined weight is fixed; only the split between them moves.
    dragRef.current.total = left.span + right.span
    setDragging(`${left.index}-${right.index}`)
  }

  const moveResize = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const laneSpanTotal = drag.total
    // Convert pixels to weight using this lane's own scale.
    const deltaWeight = ((event.clientX - drag.originX) / drag.laneWidth) * laneSpanTotal
    const MIN = 0.15
    let nextLeft = drag.leftSpan + deltaWeight
    nextLeft = Math.max(MIN, Math.min(drag.total - MIN, nextLeft))
    onResize(drag.leftIndex, nextLeft, drag.rightIndex, drag.total - nextLeft)
  }

  const endResize = (event) => {
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
        Type lyrics below each chord lane. Chords fill the line — drag the divider between two of
        them to move a chord onto the syllable it lands on. This only changes alignment; chord
        lengths stay as set on the Chords tab.
      </p>

      {Array.from({ length: lineCount }, (_, line) => {
        const chords = byLine.get(line) ?? []
        const total = chords.reduce((sum, c) => sum + c.span, 0) || 1

        return (
          <div className="tl-line" key={line}>
            <div className="tl-lane-wrap">
              <div className="tl-lane" ref={(el) => { if (el) el.dataset.line = line }}>
                {chords.length === 0 && <span className="tl-empty">no chords on this line</span>}

                {chords.map((entry, n) => {
                  const next = chords[n + 1]
                  return (
                    <div
                      key={entry.index}
                      className={`tl-chord ${entry.index === activeIndex ? 'active' : ''} ${entry.index === playingIndex ? 'playing' : ''}`}
                      style={{ flexGrow: entry.span, flexBasis: 0, minWidth: 0 }}
                    >
                      <button
                        className="tl-chord-face"
                        onClick={() => onSelect(entry.index)}
                        title={`${chordSymbol(entry.chord)} — click to select`}
                      >
                        <span className="tl-symbol">{chordSymbol(entry.chord)}</span>
                        <span className="tl-roman">{romanNumeral(entry.chord, musicKey)}</span>
                      </button>
                      <span
                        className="tl-remove"
                        role="button"
                        title="Remove this chord"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemove(entry.index)
                        }}
                      >
                        ×
                      </span>

                      {/* The interior boundary. Belongs to the chord on its left,
                          and moves width between that chord and the next. */}
                      {next && (
                        <span
                          className={`tl-divider ${dragging === `${entry.index}-${next.index}` ? 'grabbing' : ''}`}
                          title="Drag to align with a syllable"
                          onPointerDown={(e) => startResize(e, entry, next, e.currentTarget.closest('.tl-lane'))}
                          onPointerMove={moveResize}
                          onPointerUp={endResize}
                          onPointerCancel={endResize}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <textarea
                className="tl-lyric"
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
              {chords.length > 0 && line > 0 && (
                <button
                  title="Move this line's first chord up to the previous line"
                  onClick={() => onMoveChordToLine(chords[0].index, line - 1)}
                >
                  ↑
                </button>
              )}
              {chords.length > 0 && (
                <button
                  title="Move this line's last chord down to the next line"
                  onClick={() => onMoveChordToLine(chords[chords.length - 1].index, line + 1)}
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
