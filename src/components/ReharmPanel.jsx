import React from 'react'
import { chordSymbol } from '../theory/chords.js'

const CATEGORY_LABELS = {
  colour: 'Colour',
  tritoneSub: 'Tritone sub',
  tension: 'Tension',
  rootless: 'Rootless',
  mediantSwap: 'Third swap',
  mixture: 'Borrowed',
  secondary: 'Applied dominant',
  relatedII: 'Related ii',
  passing: 'Passing',
  bass: 'Bass line',
}

/** Substitutions for a chord already written, and chords to slip in before it. */
export default function ReharmPanel({ chord, options, onReplace, onInsert, onPreview }) {
  if (!chord) return null
  const { replace, insert } = options

  const row = (entry, action, label) => (
    <li key={entry.id}>
      <button className="rh-main" onClick={() => onPreview(entry.chord)} title="Hear it">
        <span className="rh-roman">{entry.roman}</span>
        <span className="rh-symbol">{chordSymbol(entry.chord)}</span>
        <span className="rh-cat">{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
      </button>
      <button className="btn tiny primary" onClick={() => action(entry.chord)}>{label}</button>
      <p className="rh-why">{entry.why}</p>
    </li>
  )

  return (
    <div className="reharm">
      <div className="sub-head">
        <span className="lbl">Instead of {chordSymbol(chord)}</span>
        <span className="muted small">same job, different colour</span>
      </div>
      {replace.length ? (
        <ul className="rh-list">{replace.map((e) => row(e, onReplace, 'swap'))}</ul>
      ) : (
        <p className="muted small pad-sm">No substitutions for this one.</p>
      )}

      <div className="sub-head">
        <span className="lbl">Slip in before it</span>
        <span className="muted small">approach chords</span>
      </div>
      {insert.length ? (
        <ul className="rh-list">{insert.map((e) => row(e, onInsert, 'insert'))}</ul>
      ) : (
        <p className="muted small pad-sm">Nothing obvious to insert here.</p>
      )}
    </div>
  )
}
