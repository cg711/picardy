import React, { useMemo, useState } from 'react'
import { parseChart } from '../lib/textimport.js'
import { analyseProgression } from '../theory/analyze.js'
import { chordSymbol } from '../theory/chords.js'

const PLACEHOLDER = `| Cmaj7 | Am7 | Dm7 G7 |
| Cmaj7 | A7 | Dm7 G7 |`

/** Paste a chart in, see what it is, load it into the editor. */
export default function ImportPanel({ timeSignature, onLoad }) {
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseChart(text, timeSignature), [text, timeSignature])
  const analysis = useMemo(
    () => (parsed.chords.length ? analyseProgression(parsed.chords) : null),
    [parsed.chords],
  )

  return (
    <div className="import-panel">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        rows={4}
        aria-label="Chord chart"
      />
      <p className="muted small">
        Bar lines set the metre — chords sharing a bar split it between them. Without bar lines,
        each line is treated as one bar.
      </p>

      {parsed.unknown.length > 0 && (
        <p className="parse-hint bad">
          Could not read: {parsed.unknown.join(', ')}
        </p>
      )}

      {analysis && (
        <div className="analysis">
          <div className="sub-head">
            <span className="lbl">{parsed.chords.length} chords · {analysis.keyName}</span>
            <button className="btn primary tiny" onClick={() => onLoad(parsed, analysis.key)}>
              Load into the editor
            </button>
          </div>

          <div className="analysis-chords">
            {analysis.chords.map((c) => (
              <span key={c.index} className={`an-chord ${c.diatonic ? '' : 'chromatic'}`}>
                <em>{c.roman}</em>
                {c.symbol}
              </span>
            ))}
          </div>

          <ul className="observations">
            {analysis.observations.map((o, i) => (
              <li key={i} className={`obs obs-${o.kind}`}>{o.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export { chordSymbol }
