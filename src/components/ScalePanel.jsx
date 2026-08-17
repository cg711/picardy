import React from 'react'
import { prettyName } from '../theory/notes.js'
import { chordSymbol } from '../theory/chords.js'

/**
 * What to play over the current chord: the fitting scales, ranked, plus the
 * guide tones and the notes held in common with whatever comes next.
 */
export default function ScalePanel({
  chord,
  scales,
  activeScaleId,
  onSelectScale,
  showScale,
  onToggleShow,
  guideTones,
  commonWithNext,
  nextChord,
}) {
  if (!chord) return null
  const active = scales.find((s) => s.id === activeScaleId) ?? scales[0]

  return (
    <div className="scale-panel">
      <div className="scale-head">
        <label className="check">
          <input type="checkbox" checked={showScale} onChange={(e) => onToggleShow(e.target.checked)} />
          show scale on the instruments
        </label>
      </div>

      {!scales.length ? (
        <p className="muted small">No standard scale contains every note of this chord.</p>
      ) : (
        <>
          <div className="scale-chips">
            {scales.map((s) => (
              <button
                key={s.id}
                className={`scale-chip ${s.id === active.id ? 'on' : ''}`}
                onClick={() => onSelectScale(s.id)}
                title={`${s.insideKey} of ${s.total} notes are in the key`}
              >
                {s.name}
                {s.insideKey === s.total && <em>in key</em>}
              </button>
            ))}
          </div>

          <div className="scale-notes">
            {active.notes.map((n, i) => (
              <span key={i} className="scale-note">{prettyName(n)}</span>
            ))}
          </div>

          <p className="scale-why">{active.why}</p>
        </>
      )}

      <div className="tone-rows">
        <div className="tone-row">
          <span className="lbl">Guide tones</span>
          {guideTones.length ? (
            guideTones.map((e, i) => (
              <span key={i} className="pill tiny guide">{prettyName(e.note)}<em>{e.degree}</em></span>
            ))
          ) : (
            <span className="muted small">none</span>
          )}
          <span className="muted small">the notes that spell the chord — land on these</span>
        </div>

        {nextChord && (
          <div className="tone-row">
            <span className="lbl">Common with {chordSymbol(nextChord)}</span>
            {commonWithNext.length ? (
              commonWithNext.map((e, i) => (
                <span key={i} className="pill tiny">{prettyName(e.note)}</span>
              ))
            ) : (
              <span className="muted small">nothing shared — every voice has to move</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
