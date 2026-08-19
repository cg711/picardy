import React, { useState } from 'react'
import { chordSymbol } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'
import { lineFragments, lineText, distributeWords } from '../lib/lyrics.js'

/**
 * Lyrics written under the chords they are sung on.
 *
 * Each chord owns a box holding its own words, so the association is stored
 * rather than positioned: this chord goes with these syllables. Nothing here
 * records an x, a width or a fraction, which is what stops the editor and the
 * printed chart from ever disagreeing — they are rendering the same pairs, not
 * two reconstructions of the same geometry.
 *
 * A chord change mid-word is just two boxes: "wait" under one chord and "ing"
 * under the next, with no space between them.
 */
export default function LyricTimeline({
  progression,
  lines,
  lyrics,
  leadIns,
  musicKey,
  activeIndex,
  playingIndex,
  onSelect,
  onLyric,
  onLeadIn,
  onAddLine,
  onMoveChordToLine,
  onRemove,
}) {
  const [pasting, setPasting] = useState(null)
  const [pasteText, setPasteText] = useState('')

  const lineCount = Math.max(leadIns.length, ...lines.map((n) => (n ?? 0) + 1), 1)

  const applyPaste = (line, fragments) => {
    const shares = distributeWords(pasteText, fragments.length)
    fragments.forEach((f, n) => onLyric(f.index, shares[n]))
    setPasting(null)
    setPasteText('')
  }

  return (
    <div className="lyric-editor">
      <p className="muted small tl-hint">
        Type each chord's words in the box beneath it — they are joined in order to make the line.
        For a chord change mid-word, split it across two boxes with no space: <kbd>wait</kbd> then
        <kbd>ing</kbd>.
      </p>

      {Array.from({ length: lineCount }, (_, line) => {
        const { leadIn, fragments } = lineFragments(progression, lyrics, lines, leadIns, line)
        const preview = lineText({ leadIn, fragments })

        return (
          <div className="lyric-line" key={line}>
            <div className="lyric-line-head">
              <span className="tl-line-num">line {line + 1}</span>
              {fragments.length > 0 && (
                <button
                  className="btn ghost tiny"
                  onClick={() => { setPasting(pasting === line ? null : line); setPasteText('') }}
                  title="Paste a whole line and split it across this line's chords"
                >
                  Paste words
                </button>
              )}
              {fragments.length > 0 && line > 0 && (
                <button
                  className="btn ghost tiny"
                  title="Move this line's first chord up to the previous line"
                  onClick={() => onMoveChordToLine(fragments[0].index, line - 1)}
                >
                  ↑
                </button>
              )}
              {fragments.length > 0 && (
                <button
                  className="btn ghost tiny"
                  title="Move this line's last chord down to the next line"
                  onClick={() => onMoveChordToLine(fragments[fragments.length - 1].index, line + 1)}
                >
                  ↓
                </button>
              )}
              {preview.trim() && <span className="lyric-preview" title="How the line reads">{preview}</span>}
            </div>

            {pasting === line && (
              <div className="lyric-paste">
                <input
                  type="text"
                  autoFocus
                  value={pasteText}
                  placeholder="Paste or type the whole line…"
                  onChange={(e) => setPasteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPaste(line, fragments)
                    if (e.key === 'Escape') { setPasting(null); setPasteText('') }
                  }}
                />
                <button className="btn tiny primary" onClick={() => applyPaste(line, fragments)}>
                  Split across {fragments.length} chord{fragments.length === 1 ? '' : 's'}
                </button>
              </div>
            )}

            <div className="lyric-row">
              {/* Anything sung before the first chord of the line. */}
              <label className="lyric-cell lead-in">
                <span className="lyric-cell-chord muted">(lead-in)</span>
                <input
                  type="text"
                  value={leadIn}
                  placeholder="…"
                  onChange={(e) => onLeadIn(line, e.target.value)}
                  aria-label={`Words before the first chord of line ${line + 1}`}
                />
              </label>

              {fragments.length === 0 ? (
                <span className="lyric-empty muted">
                  No chords on this line yet — add one on the Chords tab, or move one down from
                  above.
                </span>
              ) : (
                fragments.map((f) => (
                  <label
                    key={f.index}
                    className={`lyric-cell ${f.index === activeIndex ? 'active' : ''} ${f.index === playingIndex ? 'playing' : ''}`}
                  >
                    <span className="lyric-cell-chord">
                      <button
                        type="button"
                        className="lyric-chord-name"
                        onClick={() => onSelect(f.index)}
                        title="Select this chord"
                      >
                        {chordSymbol(f.chord)}
                      </button>
                      <span className="lyric-chord-roman">{romanNumeral(f.chord, musicKey)}</span>
                      <span
                        className="lyric-chord-x"
                        role="button"
                        title="Remove this chord"
                        onClick={() => onRemove(f.index)}
                      >
                        ×
                      </span>
                    </span>
                    <input
                      type="text"
                      value={f.text}
                      placeholder="words…"
                      onChange={(e) => onLyric(f.index, e.target.value)}
                      // Grow with the words so the box is the size of what it holds.
                      size={Math.max(6, (f.text || '').length + 1)}
                      aria-label={`Words under ${chordSymbol(f.chord)}`}
                    />
                  </label>
                ))
              )}
            </div>
          </div>
        )
      })}

      <button className="btn ghost tiny" onClick={onAddLine}>+ add a line</button>
    </div>
  )
}
