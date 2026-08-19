import React, { useEffect, useRef } from 'react'
import { chordSymbol, chordNotes, inversionLabel, inversionShort, bassOf } from '../theory/chords.js'
import { prettyName } from '../theory/notes.js'
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
  onAddAt,
  flavour = 'any',
  onFlavour,
  flavours = [],
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
    //
    // Query by class rather than indexing children: the strip interleaves insert
    // slots between the chips, so child index and chord index are not the same
    // number any more.
    const strip = stripRef.current
    const chip = strip?.querySelectorAll('.prog-chip')?.[focused]
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

  // Empty: two dotted placeholders standing where real chips will be, rather
  // than prose plus a row of buttons. The strip already teaches the shape of a
  // chord card, so an outline of one is the clearest possible "put one here".
  if (!progression.length) {
    return (
      <div className="progression">
        <div className="prog-strip">
          <button className="add-card empty-chord" onClick={() => onAddAt(0)} title="Add the first chord">
            <span className="add-card-plus" aria-hidden="true">+</span>
            <span className="add-card-label">Add chord</span>
          </button>

          <div className="add-card die-card">
            <button className="die-face" onClick={onSurprise} title="Generate a progression that ends on a cadence">
              <span className="die-glyph" aria-hidden="true">🎲</span>
              <span className="add-card-label">Surprise me</span>
            </button>
            <select
              className="die-style"
              value={flavour}
              onChange={(e) => onFlavour(e.target.value)}
              aria-label="Generator style"
              title="Which harmonic vocabulary the generator draws on"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="any">Any style</option>
              {flavours.map(([id, f]) => (
                <option key={id} value={id}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
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
          const bass = bassOf(chord, inv)
          return (
            <React.Fragment key={i}>
              {/* A slot at every gap, including before the first chord. They hold
                  their width at all times so the strip does not reflow on hover;
                  only the mark inside them fades in. */}
              <button
                className="insert-slot"
                onClick={() => onAddAt(i)}
                title={`Insert a chord before ${chordSymbol(chord)}`}
                aria-label={`Insert a chord before ${chordSymbol(chord)}`}
              >
                <span aria-hidden="true">+</span>
              </button>
            <div
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


              {/* Inversion picks straight from a list rather than cycling a
                  button: cycling hid both how many there are and which one you
                  are on, so an inversion set on a chip was invisible from the
                  chip. The bass note is what you actually hear change, so it is
                  what the row shows. */}
              {/* A slash chord's bass is fixed by its own symbol — D/F♯ is F♯ in
                  the bass — so the picker shows where that lands and stops
                  offering choices it cannot honour. */}
              <label className="chip-inversion" onClick={(e) => e.stopPropagation()}>
                <span className="lbl">Inv</span>
                <select
                  value={bass.isChordTone ? bass.index : -1}
                  disabled={bass.fromSymbol}
                  onChange={(e) => onInvert(i, Number(e.target.value))}
                  title={
                    bass.fromSymbol
                      ? `${inversionLabel(chord, inv)} — set by the chord symbol`
                      : inversionLabel(chord, inv)
                  }
                  aria-label="Inversion"
                >
                  {!bass.isChordTone && <option value={-1}>{prettyName(bass.note)} bass</option>}
                  {Array.from({ length: nTones }, (_, n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'root' : ['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`}
                      {' · '}
                      {prettyName(chordNotes(chord)[n % nTones].note)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="chip-controls" onClick={(e) => e.stopPropagation()}>
                <button title="Move left" onClick={() => onMove(i, -1)} disabled={i === 0}>‹</button>
                <span
                  className={`chip-inv-badge${bass.index > 0 || !bass.isChordTone ? ' on' : ''}`}
                  title={inversionLabel(chord, inv)}
                >
                  {inversionShort(chord, inv)}
                </span>
                <button title="Move right" onClick={() => onMove(i, 1)} disabled={i === progression.length - 1}>›</button>
              </div>
            </div>
            </React.Fragment>
          )
        })}

        {/* The add card: same footprint as a chord chip, so the strip reads as a
            row of cards with one empty slot waiting at the end. */}
        <button
          className="add-card"
          onClick={() => onAddAt(progression.length)}
          title="Add a chord to the end"
        >
          <span className="add-card-plus" aria-hidden="true">+</span>
          <span className="add-card-label">Add chord</span>
        </button>
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
