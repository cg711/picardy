import React, { useEffect, useState } from 'react'
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

/**
 * One line's words as a single editable field.
 *
 * Writing a lyric a syllable at a time is not how anyone writes a lyric — you
 * write the line, then worry about which chord each word lands on. So the line
 * reads back here as one sentence, and editing it splits the words across that
 * line's chords again. It was behind a "paste words" button before, which put
 * the natural way of working one click further away than the fiddly one.
 */
function LineField({ line, fragments, compiled, onDistribute }) {
  const [draft, setDraft] = useState(compiled)
  const [editing, setEditing] = useState(false)

  // Follow the cells while they are the ones being edited, but never yank the
  // text out from under someone typing here.
  useEffect(() => {
    if (!editing) setDraft(compiled)
  }, [compiled, editing])

  const commit = () => {
    setEditing(false)
    if (draft !== compiled) onDistribute(draft)
  }

  return (
    <input
      className="line-field"
      value={draft}
      placeholder={fragments.length ? 'Type the whole line…' : 'Add chords to this line first'}
      disabled={!fragments.length}
      title={`Type the line here and it is split across its ${fragments.length} chord${fragments.length === 1 ? '' : 's'}`}
      aria-label={`Line ${line + 1}`}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(compiled); setEditing(false); e.currentTarget.blur() }
      }}
    />
  )
}

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
  onSetLineBreak,
  onRemove,
}) {
  // Lines that actually hold something: the highest line any chord sits on, and
  // the highest lead-in with words in it. Counting the lead-in *array* instead
  // left an empty line behind every time a break was folded away, because the
  // slot it needed stayed in the array after the line stopped existing.
  const lastChordLine = progression.reduce((m, _, i) => Math.max(m, lines[i] ?? 0), 0)
  const lastLeadIn = leadIns.reduce((m, text, i) => (text && text.trim() ? i : m), 0)
  const lineCount = Math.max(lastChordLine, lastLeadIn) + 1

  return (
    <div className="lyric-editor">
      <p className="muted small tl-hint">
        Type a line at the top of its card and the words are split across its chords —
        or write them a chord at a time in the boxes underneath. <kbd>↵</kbd> on a chord
        starts a new line there. For a chord change mid-word, split it across two boxes
        with no space: <kbd>wait</kbd> then <kbd>ing</kbd>.
      </p>

      {Array.from({ length: lineCount }, (_, line) => {
        const { leadIn, fragments } = lineFragments(progression, lyrics, lines, leadIns, line)
        const compiled = lineText({ leadIn, fragments })

        return (
          <div className="lyric-line" key={line}>
            <div className="lyric-line-head">
              <span className="tl-line-num">{line + 1}</span>
              <LineField
                line={line}
                fragments={fragments}
                compiled={compiled}
                onDistribute={(text) => {
                  // The lead-in only takes a share when there already is one.
                  // Most lines have no pickup, and splitting into it by default
                  // would push the first words of every line into a cell that
                  // does not belong to any chord.
                  const pickup = leadIn.trim().length > 0
                  const shares = distributeWords(text, fragments.length + (pickup ? 1 : 0))
                  if (pickup) onLeadIn(line, shares[0])
                  fragments.forEach((f, n) => onLyric(f.index, shares[n + (pickup ? 1 : 0)]))
                }}
              />
            </div>

            {/* The row reads like the chart it prints: chord over words, left to
                right, each pair in one column. Cells share the width rather than
                being sized by their contents, so the columns line up down the
                page instead of jittering with every keystroke. */}
            <div className="lyric-row">
              {/* Narrow while it is empty, since most lines have no pickup;
                  full width once it holds words, so they are readable. */}
              <label className={`lyric-cell lead-in${leadIn ? ' filled' : ''}`}>
                <span className="lyric-cell-chord muted">before</span>
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
                  No chords on this line yet — add one on the Chords tab, or move one down
                  from the line above.
                </span>
              ) : (
                fragments.map((f) => (
                  <label
                    key={f.index}
                    className={`lyric-cell ${f.index === activeIndex ? 'active' : ''} ${f.index === playingIndex ? 'playing' : ''}`}
                  >
                    <span className="lyric-cell-chord">
                      {/* A break belongs between two chords, so it is a toggle on
                          the chord that would begin the new line. The very first
                          chord has nothing above it to break from. */}
                      {f.index > 0 && (
                        <button
                          type="button"
                          className={`lyric-break${f.index === fragments[0].index && line > 0 ? ' on' : ''}`}
                          title={f.index === fragments[0].index && line > 0
                            ? 'Fold this line back into the one above'
                            : 'Start a new line at this chord'}
                          aria-pressed={f.index === fragments[0].index && line > 0}
                          onClick={() => onSetLineBreak(f.index, !(f.index === fragments[0].index && line > 0))}
                        >
                          ↵
                        </button>
                      )}
                      <button
                        type="button"
                        className="lyric-chord-name"
                        onClick={() => onSelect(f.index)}
                        title="Select this chord"
                      >
                        {chordSymbol(f.chord)}
                      </button>
                      <span className="lyric-chord-roman">{romanNumeral(f.chord, musicKey)}</span>
                      <button
                        type="button"
                        className="lyric-chord-x"
                        title={`Remove ${chordSymbol(f.chord)}`}
                        aria-label={`Remove ${chordSymbol(f.chord)}`}
                        onClick={() => onRemove(f.index)}
                      >
                        ×
                      </button>
                    </span>
                    <input
                      type="text"
                      value={f.text}
                      placeholder="…"
                      onChange={(e) => onLyric(f.index, e.target.value)}
                      aria-label={`Words under ${chordSymbol(f.chord)}`}
                    />
                  </label>
                ))
              )}
            </div>
          </div>
        )
      })}

    </div>
  )
}
