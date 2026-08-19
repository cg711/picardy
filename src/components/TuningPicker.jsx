import React from 'react'
import {
  TUNINGS, CUSTOM_TUNING, MIN_STRINGS, MAX_STRINGS, MIN_STRING_MIDI, MAX_STRING_MIDI,
} from '../theory/guitar.js'
import { midiName } from '../theory/notes.js'

/** Presets in declaration order, bucketed by their group for the <optgroup>s. */
const GROUPS = Object.entries(TUNINGS).reduce((acc, [id, t]) => {
  const group = t.group ?? 'Other'
  ;(acc[group] ||= []).push([id, t])
  return acc
}, {})

/**
 * Choosing a tuning, and building one.
 *
 * The editor works in semitones per string rather than note names: retuning is
 * something you do by ear against a reference, and "down two more" is the actual
 * gesture. The note name is shown so you can still aim at a target.
 *
 * Strings run low to high, which is the order they are stored in and the order
 * the neck draws them — string 1 here is the thickest.
 */
export default function TuningPicker({
  tuningId,
  strings,
  customStrings,
  onSelect,
  onCustom,
  preferFlats = false,
}) {
  const isCustom = tuningId === CUSTOM_TUNING

  const setString = (i, midi) => {
    const next = [...customStrings]
    next[i] = Math.min(MAX_STRING_MIDI, Math.max(MIN_STRING_MIDI, midi))
    onCustom(next)
  }

  const addString = () => {
    if (customStrings.length >= MAX_STRINGS) return
    // A new string goes on the bottom, a fourth below the current lowest, which
    // is where an extra string lives on every instrument that has one.
    const lowest = customStrings[0] ?? 40
    onCustom([Math.max(MIN_STRING_MIDI, lowest - 5), ...customStrings])
  }

  const removeString = () => {
    if (customStrings.length <= MIN_STRINGS) return
    onCustom(customStrings.slice(1))
  }

  return (
    <div className="tuning-picker">
      <select
        value={tuningId}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Tuning"
        className="tuning-select"
      >
        {Object.entries(GROUPS).map(([group, list]) => (
          <optgroup key={group} label={group}>
            {list.map(([id, t]) => (
              <option key={id} value={id}>{t.name}</option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Your own">
          <option value={CUSTOM_TUNING}>Custom…</option>
        </optgroup>
      </select>

      {isCustom && (
        <div className="tuning-editor">
          <div className="tuning-strings">
            {customStrings.map((midi, i) => (
              <div className="tuning-string" key={i}>
                <span className="tuning-num">{customStrings.length - i}</span>
                <button
                  type="button"
                  onClick={() => setString(i, midi - 1)}
                  disabled={midi <= MIN_STRING_MIDI}
                  title="Down a semitone"
                  aria-label={`String ${customStrings.length - i} down a semitone`}
                >
                  −
                </button>
                <span className="tuning-note">{midiName(midi, preferFlats)}</span>
                <button
                  type="button"
                  onClick={() => setString(i, midi + 1)}
                  disabled={midi >= MAX_STRING_MIDI}
                  title="Up a semitone"
                  aria-label={`String ${customStrings.length - i} up a semitone`}
                >
                  +
                </button>
              </div>
            ))}
          </div>

          <div className="tuning-actions">
            <button
              className="btn ghost tiny"
              onClick={removeString}
              disabled={customStrings.length <= MIN_STRINGS}
              title="Remove the lowest string"
            >
              − string
            </button>
            <button
              className="btn ghost tiny"
              onClick={addString}
              disabled={customStrings.length >= MAX_STRINGS}
              title="Add a string below the lowest"
            >
              + string
            </button>
            <button
              className="btn ghost tiny"
              onClick={() => onCustom([...TUNINGS.standard.strings])}
              title="Back to EADGBE"
            >
              Reset
            </button>
            <span className="muted small tuning-readout">
              {customStrings.map((m) => midiName(m, preferFlats)).join(' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
