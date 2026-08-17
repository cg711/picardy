import React, { useMemo, useState } from 'react'
import { spellFrom } from '../theory/notes.js'
import { makeChord, chordSymbol } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'

// [semitonesAboveTonic, genericDegree, qualityId, alterations]
const MAJOR_ROWS = [
  {
    title: 'Diatonic triads',
    cells: [
      [0, 1, 'maj'], [2, 2, 'min'], [4, 3, 'min'], [5, 4, 'maj'], [7, 5, 'maj'], [9, 6, 'min'], [11, 7, 'dim'],
    ],
  },
  {
    title: 'Diatonic sevenths',
    cells: [
      [0, 1, 'maj7'], [2, 2, 'm7'], [4, 3, 'm7'], [5, 4, 'maj7'], [7, 5, 'dom7'], [9, 6, 'm7'], [11, 7, 'm7b5'],
    ],
  },
  {
    title: 'Secondary dominants',
    cells: [
      [9, 6, 'dom7'], [11, 7, 'dom7'], [0, 1, 'dom7'], [2, 2, 'dom7'], [4, 3, 'dom7'],
    ],
  },
  {
    title: 'Modal mixture',
    cells: [
      [0, 1, 'min'], [2, 2, 'm7b5'], [3, 3, 'maj'], [5, 4, 'min'], [7, 5, 'min'], [8, 6, 'maj'], [10, 7, 'maj'], [10, 7, 'dom7'],
    ],
  },
  {
    title: 'Chromatic',
    cells: [
      [1, 2, 'maj'], [1, 2, 'dom7'], [8, 6, 'ger6'], [8, 6, 'fr6'], [1, 1, 'dim7'], [6, 4, 'dim7'], [3, 2, 'dim7'],
    ],
  },
  {
    title: 'Extensions on I / IV / V',
    cells: [
      [0, 1, 'add9'], [0, 1, 'six'], [0, 1, 'sixNine'], [5, 4, 'maj11'], [7, 5, 'sevenSus4'], [7, 5, 'dom9'], [7, 5, 'dom13'], [7, 5, 'sevenAlt'],
    ],
  },
]

const MINOR_ROWS = [
  {
    title: 'Diatonic triads',
    cells: [
      [0, 1, 'min'], [2, 2, 'dim'], [3, 3, 'maj'], [5, 4, 'min'], [7, 5, 'min'], [8, 6, 'maj'], [10, 7, 'maj'],
    ],
  },
  {
    title: 'Diatonic sevenths',
    cells: [
      [0, 1, 'm7'], [2, 2, 'm7b5'], [3, 3, 'maj7'], [5, 4, 'm7'], [7, 5, 'm7'], [8, 6, 'maj7'], [10, 7, 'dom7'],
    ],
  },
  {
    title: 'Harmonic / melodic minor',
    cells: [
      [7, 5, 'maj'], [7, 5, 'dom7'], [11, 7, 'dim7'], [0, 1, 'mMaj7'], [7, 5, 'dom7', ['b9']], [5, 4, 'maj'], [9, 6, 'min'],
    ],
  },
  {
    title: 'Secondary dominants',
    cells: [
      [0, 1, 'dom7'], [2, 2, 'dom7'], [5, 4, 'dom7'], [7, 5, 'dom7'], [10, 7, 'dom7'],
    ],
  },
  {
    title: 'Chromatic',
    cells: [
      [1, 2, 'maj'], [1, 2, 'dom7'], [8, 6, 'ger6'], [0, 1, 'maj'], [3, 3, 'dom7'], [6, 4, 'dim7'],
    ],
  },
]

export default function RomanPicker({ musicKey, onAdd }) {
  const [hover, setHover] = useState(null)
  const rows = musicKey.mode === 'minor' ? MINOR_ROWS : MAJOR_ROWS

  const built = useMemo(
    () =>
      rows.map((row) => ({
        title: row.title,
        cells: row.cells
          .map(([semi, gen, quality, alts = []]) => {
            const root = spellFrom(musicKey.tonic, gen, semi)
            const chord = makeChord(root, quality, alts)
            if (!chord) return null
            return { chord, roman: romanNumeral(chord, musicKey), symbol: chordSymbol(chord) }
          })
          .filter(Boolean),
      })),
    [musicKey, rows],
  )

  return (
    <div className="roman-picker">
      {built.map((row) => (
        <div className="rp-row" key={row.title}>
          <div className="rp-title">{row.title}</div>
          <div className="rp-cells">
            {row.cells.map((c, i) => (
              <button
                key={`${row.title}-${i}`}
                className="rp-cell"
                onClick={() => onAdd(c.chord)}
                onMouseEnter={() => setHover(c)}
                onMouseLeave={() => setHover(null)}
                title={`${c.roman} — ${c.symbol}`}
              >
                <span className="rp-roman">{c.roman}</span>
                <span className="rp-symbol">{c.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="rp-hint muted">{hover ? `${hover.roman} = ${hover.symbol}` : 'Click a numeral to append it to the progression.'}</div>
    </div>
  )
}
