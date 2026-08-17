import React, { useMemo, useRef, useState } from 'react'
import { parseChord, chordSymbol, chordName } from '../theory/chords.js'
import { romanNumeral, keyName } from '../theory/keys.js'

// Ordered roughly by how often each suffix shows up in real music.
const SUFFIXES = [
  '', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', 'madd9', '6', 'm6', '9', 'm9', 'maj9',
  '11', 'm11', '13', 'm13', '6/9', '7sus4', 'dim', 'dim7', 'm7b5', 'aug', 'mMaj7',
  '7b9', '7#9', '7#11', '7b13', '7alt', 'maj9#11', '5',
]

const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export default function ChordInput({ onAdd, musicKey }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  const parsed = useMemo(() => parseChord(text), [text])

  const options = useMemo(() => {
    const t = text.trim()
    if (!t) return []
    const rootMatch = /^([A-Ga-g])((?:#|b|♯|♭)*)/.exec(t)
    if (!rootMatch) return []
    const root = rootMatch[1].toUpperCase() + rootMatch[2].replace(/♯/g, '#').replace(/♭/g, 'b')
    const rest = t.slice(rootMatch[0].length)
    const roots = rest.length ? [root] : ROOTS.filter((r) => r.startsWith(root))
    const out = []
    for (const r of roots) {
      for (const suf of SUFFIXES) {
        if (rest.length && !suf.toLowerCase().startsWith(rest.toLowerCase())) continue
        const sym = r + suf
        const chord = parseChord(sym)
        if (chord) out.push({ raw: sym, chord })
        if (out.length > 60) break
      }
    }
    return out.slice(0, 24)
  }, [text])

  const commit = (chord) => {
    if (!chord) return
    onAdd(chord)
    setText('')
    setOpen(false)
    setCursor(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && options[cursor]) commit(options[cursor].chord)
      else commit(parsed)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setCursor((c) => Math.min(options.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="chord-input">
      <div className="input-row">
        <input
          ref={inputRef}
          value={text}
          placeholder="Type a chord — Cmaj7, F#m7b5, Bb13, D/F#…"
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setCursor(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label="Chord symbol"
        />
        <button className="btn primary" disabled={!parsed} onClick={() => commit(parsed)}>
          Add
        </button>
      </div>

      {text.trim() && (
        <div className={`parse-hint ${parsed ? 'ok' : 'bad'}`}>
          {parsed
            ? `${chordSymbol(parsed)} — ${chordName(parsed)} · ${romanNumeral(parsed, musicKey)} in ${keyName(musicKey)}`
            : 'Not a chord symbol yet…'}
        </div>
      )}

      {open && options.length > 0 && (
        <ul className="autocomplete" role="listbox">
          {options.map((o, i) => (
            <li
              key={o.raw}
              role="option"
              aria-selected={i === cursor}
              className={i === cursor ? 'active' : ''}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(o.chord)
              }}
            >
              <span className="ac-symbol">{chordSymbol(o.chord)}</span>
              <span className="ac-roman">{romanNumeral(o.chord, musicKey)}</span>
              <span className="ac-name">{chordName(o.chord)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
