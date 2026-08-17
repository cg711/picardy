import React, { useState } from 'react'

export default function ExportDialog({ defaultTitle, lefty, onCancel, onExport }) {
  const [title, setTitle] = useState(defaultTitle)
  const [instrument, setInstrument] = useState('guitar')

  const submit = (e) => {
    e.preventDefault()
    onExport({ title: title.trim() || 'Untitled', instrument })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Export PDF chart</h3>
        <p className="muted small">
          A lead sheet: chords in bars with roman numerals underneath, and a diagram for each
          distinct chord at the top.
        </p>

        <label className="field">
          <span className="lbl">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <fieldset className="field">
          <legend className="lbl">Chord diagrams</legend>
          <div className="radio-row">
            {[
              ['guitar', `Guitar${lefty ? ' (left-handed)' : ''}`],
              ['piano', 'Piano'],
              ['both', 'Both'],
              ['none', 'None — symbols only'],
            ].map(([value, label]) => (
              <label key={value} className={instrument === value ? 'on' : ''}>
                <input
                  type="radio"
                  name="instrument"
                  value={value}
                  checked={instrument === value}
                  onChange={() => setInstrument(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary">Download PDF</button>
        </div>
      </form>
    </div>
  )
}
