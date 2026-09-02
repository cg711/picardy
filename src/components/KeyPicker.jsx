import React from 'react'
import { KEY_CHOICES, makeKey, keySignatureAccidentals, keyName } from '../theory/keys.js'
import { noteName, prettyName, parseNote } from '../theory/notes.js'

export default function KeyPicker({ musicKey, onChange, onDetect, canDetect, onTranspose, canTranspose, numeralStyle = 'roman', onNumeralStyle }) {
  const sig = keySignatureAccidentals(musicKey)

  return (
    <div className="key-picker">
      <label>
        <span className="lbl">Key</span>
        <select
          value={noteName(musicKey.tonic)}
          onChange={(e) => onChange(makeKey(e.target.value, musicKey.mode))}
        >
          {KEY_CHOICES.map((k) => (
            <option key={k} value={k}>
              {prettyName(parseNote(k))}
            </option>
          ))}
        </select>
      </label>
      <div className="mode-toggle" role="group" aria-label="Mode">
        {['major', 'minor'].map((m) => (
          <button
            key={m}
            className={musicKey.mode === m ? 'on' : ''}
            onClick={() => onChange(makeKey(noteName(musicKey.tonic), m))}
          >
            {m}
          </button>
        ))}
      </div>
      <span className="key-sig muted" title="Key signature">
        {sig.length ? `${sig.length} ${sig[0].includes('#') ? '♯' : '♭'}` : 'no accidentals'}
      </span>

      {/* Transposition moves the music, not just the label the numerals are read against. */}
      <div className="transpose" role="group" aria-label="Transpose">
        <span className="lbl">Transpose</span>
        <button onClick={() => onTranspose(-1)} disabled={!canTranspose} title="Down a semitone">−</button>
        <button onClick={() => onTranspose(1)} disabled={!canTranspose} title="Up a semitone">+</button>
      </div>

      {/* Which notation the numerals are written in. It lives here because a
          numeral only means anything relative to the key sitting next to it,
          and both say the same thing about a chord — the difference is who is
          reading. */}
      <div className="numeral-style" role="group" aria-label="Numerals">
        {[['roman', 'I ii V'], ['nashville', '1 2m 5']].map(([value, text]) => (
          <button
            key={value}
            className={numeralStyle === value ? 'on' : ''}
            onClick={() => onNumeralStyle(value)}
            title={value === 'roman'
              ? 'Roman numerals, as textbooks and the lessons write them'
              : 'Nashville numbers, as session players read them'}
          >
            {text}
          </button>
        ))}
      </div>

      <button className="btn ghost tiny" onClick={onDetect} disabled={!canDetect} title="Infer the key from the chords entered">
        Detect from progression
      </button>
    </div>
  )
}
