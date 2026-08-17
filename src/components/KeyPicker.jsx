import React from 'react'
import { KEY_CHOICES, makeKey, keySignatureAccidentals, keyName } from '../theory/keys.js'
import { noteName, prettyName, parseNote } from '../theory/notes.js'
import { capoSuggestions, isOpenFriendly } from '../theory/transpose.js'

export default function KeyPicker({ musicKey, onChange, onDetect, canDetect, onTranspose, canTranspose }) {
  const sig = keySignatureAccidentals(musicKey)
  const capos = capoSuggestions(musicKey)
  const openFriendly = isOpenFriendly(musicKey)

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

      <button className="btn ghost tiny" onClick={onDetect} disabled={!canDetect} title="Infer the key from the chords entered">
        Detect from progression
      </button>

      {!openFriendly && capos.length > 0 && (
        <span className="capo muted" title="Play easier shapes and let the capo do the transposing">
          capo {capos[0].fret} → play in {keyName(capos[0].shapeKey).replace(' major', '').replace(' minor', 'm')}
        </span>
      )}
    </div>
  )
}
