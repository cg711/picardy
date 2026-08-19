import React, { useEffect } from 'react'
import { segmentHue, chordFlow } from '../lib/song.js'
import { describeLength } from '../theory/rhythm.js'

/**
 * Picking a saved section to append to the song.
 *
 * Same sidebar as adding a chord, one level up — the two are the same act at
 * different scales, so they should not look like different mechanisms. Sharing
 * the .add-sidebar class is the point rather than an accident.
 */
export default function AddSectionDialog({ open, onClose, segments, onAdd }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`add-sidebar${open ? ' open' : ''}`} role="dialog" aria-label="Add a section">
      <div className="add-dialog-head">
        <h2>Add a section</h2>
        <span className="muted small">
          {segments.length ? 'appends to the end of the song' : 'nothing saved yet'}
        </span>
        <button className="btn ghost tiny add-dialog-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="add-dialog-body">
        {segments.length === 0 ? (
          <p className="muted pad">
            Save the current progression as a section first — the button sits under the transport —
            and it will show up here to arrange.
          </p>
        ) : (
          <ul className="pick-list">
            {segments.map((s) => {
              const hue = segmentHue(s)
              return (
                <li key={s.id}>
                  <button
                    onClick={() => { onAdd(s.id); onClose() }}
                    style={{ borderColor: `hsl(${hue} 50% 32%)` }}
                  >
                    <span className="pick-dot" style={{ background: `hsl(${hue} 60% 52%)` }} />
                    <span className="pick-name">{s.name}</span>
                    <span className="pick-flow">{chordFlow(s) || 'empty'}</span>
                    <span className="pick-meta">
                      {s.key} · {describeLength(s.durations, s.timeSignature)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
