import React, { useEffect, useRef } from 'react'
import { chordSymbol, chordNotes, inversionLabel } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'
import { analyzeChord } from '../theory/suggest.js'
import { DURATIONS, durationOf, toBeats, describeLength, barsAreComplete, timeSignatureOf, presetFor } from '../theory/rhythm.js'

export default function ProgressionBar({
  progression,
  inversions,
  durations,
  timeSignature,
  musicKey,
  activeIndex,
  playingIndex,
  onSelect,
  onRemove,
  onInvert,
  onDuration,
  onClear,
  onMove,
  onSurprise,
  onSmooth,
  shapes = [],
  tuningId = 'standard',
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hideWhenEmpty = false,
}) {
  // These have to sit above the empty-state return: hooks must run in the same
  // order on every render, and clearing the progression would otherwise change
  // how many are called.
  const stripRef = useRef(null)
  const focused = playingIndex >= 0 ? playingIndex : activeIndex
  useEffect(() => {
    // Keep the chord being played (or edited) in view — on a long progression
    // the strip would otherwise leave it scrolled off the end.
    const strip = stripRef.current
    const chip = strip?.children?.[focused]
    if (!strip || !chip) return
    const left = chip.offsetLeft - strip.offsetLeft
    const right = left + chip.offsetWidth
    if (left < strip.scrollLeft) strip.scrollTo({ left: left - 12, behavior: 'smooth' })
    else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: right - strip.clientWidth + 12, behavior: 'smooth' })
    }
  }, [focused])

  // In the lyric view the chips are hidden, so the empty-state prompt would be
  // a second, contradictory one.
  if (!progression.length && hideWhenEmpty) return null

  if (!progression.length) {
    return (
      <div className="progression empty">
        <p className="muted">
          Nothing yet. Type a chord, click a roman numeral, or pick notes on an instrument — then the suggestion list
          will start reading the context.
        </p>
        <button className="btn primary" onClick={onSurprise}>
          🎲 Surprise me — generate one
        </button>
      </div>
    )
  }

  const complete = barsAreComplete(durations, timeSignature)
  const ts = timeSignatureOf(timeSignature)

  // Bar numbers, so you can see where each chord falls in the metre.
  let beatCursor = 0
  const barOf = progression.map((_, i) => {
    const bar = Math.floor(beatCursor / ts.beatsPerBar) + 1
    const beat = beatCursor % ts.beatsPerBar
    beatCursor += toBeats(durations[i])
    return { bar, startsBar: Math.abs(beat) < 1e-9 }
  })

  return (
    <div className="progression">
      <div className="prog-strip" ref={stripRef}>
        {progression.map((chord, i) => {
          const a = analyzeChord(chord, musicKey)
          const inv = inversions[i] ?? 0
          const nTones = chordNotes(chord).length
          const dur = durationOf(durations[i])
          return (
            <div
              key={i}
              className={`prog-chip ${i === activeIndex ? 'active' : ''} ${i === playingIndex ? 'playing' : ''} ${a.diatonic ? '' : 'chromatic'} ${barOf[i].startsBar ? 'bar-start' : ''}`}
              onClick={() => onSelect(i)}
            >
              {barOf[i].startsBar && <span className="bar-num">bar {barOf[i].bar}</span>}
              <div className="chip-top">
                <span className="chip-roman">{romanNumeral(chord, musicKey, inv)}</span>
                {String(shapes[i] ?? '').startsWith(`${tuningId}:`) && (
                  <span className="pinned-shape" title="A guitar shape is pinned to this chord">▦</span>
                )}
                <button
                  className="chip-x"
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(i)
                  }}
                >
                  ×
                </button>
              </div>
              <div className="chip-symbol">{chordSymbol(chord)}</div>
              <div className="chip-meta">{a.fnLabel}{a.diatonic ? '' : ' · chromatic'}</div>

              <label className="chip-duration" onClick={(e) => e.stopPropagation()}>
                {/* Relative length at a glance — a full bar's worth fills the track. */}
                <span className="dur-meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (dur.beats / ts.beatsPerBar) * 100)}%` }} />
                </span>
                <select
                  value={presetFor(durations[i]) ? String(toBeats(durations[i])) : 'custom'}
                  onChange={(e) => onDuration(i, Number(e.target.value))}
                  title={`Length: ${dur.label} (${+toBeats(durations[i]).toFixed(2)} beat${toBeats(durations[i]) === 1 ? '' : 's'})`}
                  aria-label="Chord length"
                >
                  {/* A length dragged on the lyric timeline may not match any
                      preset; show it rather than silently snapping the picker. */}
                  {!presetFor(durations[i]) && <option value="custom">{dur.label}</option>}
                  {DURATIONS.map((d) => (
                    <option key={d.id} value={String(d.beats)}>{d.label}</option>
                  ))}
                </select>
              </label>


              <div className="chip-controls" onClick={(e) => e.stopPropagation()}>
                <button title="Move left" onClick={() => onMove(i, -1)} disabled={i === 0}>‹</button>
                <button
                  className="inv-btn"
                  title={inversionLabel(chord, inv)}
                  onClick={() => onInvert(i, (inv + 1) % nTones)}
                >
                  {inv === 0 ? 'root' : `inv ${inv}`}
                </button>
                <button title="Move right" onClick={() => onMove(i, 1)} disabled={i === progression.length - 1}>›</button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="prog-actions">
        <div className="undo-pair">
          <button className="btn ghost" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">↶</button>
          <button className="btn ghost" onClick={onRedo} disabled={!canRedo} title="Redo (⇧⌘Z)">↷</button>
        </div>
        <button className="btn ghost" onClick={onClear}>Clear</button>
        <button
          className="btn ghost"
          onClick={onSmooth}
          disabled={progression.length < 2}
          title="Choose inversions that keep the voices as close together as possible"
        >
          Smooth voicing
        </button>
        <span className={`length-note ${complete ? '' : 'partial'}`}>
          {describeLength(durations, timeSignature)} of {timeSignature}
          {complete ? '' : ' — last bar is incomplete'}
        </span>
      </div>
    </div>
  )
}
