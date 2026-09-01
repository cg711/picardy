import React, { useEffect } from 'react'
import { chordSymbol } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'
import ReharmPanel from './ReharmPanel.jsx'

/**
 * Reharmonising one chord, in the same sidebar the chord picker uses.
 *
 * It was a tab inside the chord panel, which put it two clicks from the chord it
 * acts on and hid it behind whichever tab you happened to leave selected. It
 * belongs to a chord, so it opens from that chord — and the sidebar is where
 * this app already puts "a long list of options for the thing you just pointed
 * at", so it should not invent a second way of doing that.
 */
export default function ReharmDialog({
  open,
  chord,
  index,
  musicKey,
  options,
  onClose,
  onPreview,
  onReplace,
  onInsert,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      // Let a tab's own input clear itself first, as the chord picker does.
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={`add-sidebar${open ? ' open' : ''}`}
      role="dialog"
      aria-label="Reharmonise"
    >
      <div className="add-dialog-head">
        <h2>Reharmonise</h2>
        {/* The chord's place in the progression, not its bar: chords have their
            own lengths, so the two are different numbers. */}
        {chord && (
          <span className="muted small">
            chord {index + 1} · {chordSymbol(chord)}
            {musicKey ? ` · ${romanNumeral(chord, musicKey)}` : ''}
          </span>
        )}
        <button className="btn ghost tiny add-dialog-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="add-dialog-body">
        {chord ? (
          <ReharmPanel
            chord={chord}
            options={options}
            onPreview={onPreview}
            onReplace={onReplace}
            onInsert={onInsert}
          />
        ) : (
          <p className="muted pad-sm">Pick a chord in the progression first.</p>
        )}
      </div>
    </div>
  )
}
