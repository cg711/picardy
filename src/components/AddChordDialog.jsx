import React, { useEffect, useRef } from 'react'
import ChordInput from './ChordInput.jsx'
import RomanPicker from './RomanPicker.jsx'
import ImportPanel from './ImportPanel.jsx'
import Suggestions from './Suggestions.jsx'
import { chordSymbol } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'

const TABS = [
  // First, and the default: the ranked list is the reason to open this at all.
  // The other four are for when you already know what you want.
  ['suggest', 'Suggestions'],
  ['text', 'Type'],
  ['roman', 'Numerals'],
  ['notes', 'From notes'],
  ['import', 'Paste chart'],
]

/**
 * Everything that puts a chord into the progression, in a sidebar that slides in
 * from the left — or down from the top on a phone, where there is no room beside
 * anything.
 *
 * Deliberately *not* a modal. One of the five ways in is "click notes on the
 * instruments", and a backdrop that swallows pointer events would make that tab
 * impossible to use. So there is no backdrop and the rest of the app stays live;
 * on a wide screen the sidebar takes the left edge and leaves the instruments
 * clear.
 *
 * It stays mounted and toggles a class rather than unmounting, because a
 * component that returns null cannot animate on the way out. `visibility:
 * hidden` while closed is what keeps its contents out of the tab order — the
 * reason that property is used rather than opacity.
 *
 * It also stays open after a chord is added. Adding is usually a run, not a
 * single act: take a suggestion, see it land, take the next one.
 */
export default function AddChordDialog({
  open,
  onClose,
  insertAt,
  progression,
  musicKey,
  inputMode,
  onInputMode,
  onAdd,
  suggestions,
  onPreview,
  timeSignature,
  onLoadChart,
  selection,
  onClearNotes,
  identified,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      // Escape closes — but let a tab's own input handle it first, so clearing a
      // half-typed chord symbol does not also dismiss the panel.
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const at = insertAt ?? progression.length
  const atEnd = at >= progression.length
  const before = progression[at - 1]
  const after = progression[at]

  return (
    <div
      className={`add-sidebar${open ? ' open' : ''}${inputMode === 'notes' ? ' picking-notes' : ''}`}
      ref={panelRef}
      role="dialog"
      aria-label="Add a chord"
    >
      <div className="add-dialog-head">
        <h2>Add a chord</h2>
        <span className="muted small">
          {atEnd
            ? progression.length
              ? `after ${chordSymbol(progression[progression.length - 1])}`
              : 'the opening chord'
            : `between ${before ? chordSymbol(before) : 'the start'} and ${chordSymbol(after)}`}
        </span>
        <button className="btn ghost tiny add-dialog-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="add-dialog-tabs tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={inputMode === id ? 'on' : ''} onClick={() => onInputMode(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="add-dialog-body">
        {inputMode === 'suggest' && (
          <Suggestions suggestions={suggestions} onAdd={onAdd} onPreview={onPreview} />
        )}
        {inputMode === 'text' && <ChordInput onAdd={onAdd} musicKey={musicKey} />}
        {inputMode === 'roman' && <RomanPicker musicKey={musicKey} onAdd={onAdd} />}
        {inputMode === 'import' && <ImportPanel timeSignature={timeSignature} onLoad={onLoadChart} />}
        {inputMode === 'notes' && (
          <div className="from-notes">
            <p className="muted">
              Click notes on the piano or the fretboard — they stay clickable while this panel is
              open. The lowest note is treated as the bass.
            </p>
            <div className="sel-notes">
              {[...selection].sort((a, b) => a - b).map((m) => (
                <span key={m} className="pill tiny">{m}</span>
              ))}
              {selection.size > 0 && (
                <button className="btn ghost tiny" onClick={onClearNotes}>Clear notes</button>
              )}
            </div>
            {identified.length > 0 ? (
              <ul className="ident-list">
                {identified.map((r) => (
                  <li key={r.symbol}>
                    <span className="ident-symbol">{r.symbol}</span>
                    <span className="ident-roman">{romanNumeral(r.chord, musicKey)}</span>
                    <span className="muted">
                      {[
                        r.missing ? `${r.missing} tone missing` : null,
                        r.extra ? `${r.extra} extra note` : null,
                      ].filter(Boolean).join(', ') || 'exact match'}
                    </span>
                    <button className="btn tiny primary" onClick={() => onAdd(r.chord)}>Add</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{selection.size < 2 ? 'Pick at least two notes.' : 'No chord matches those notes.'}</p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
