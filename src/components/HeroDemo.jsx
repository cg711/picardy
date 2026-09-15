import React, { useEffect, useMemo, useState } from 'react'
import { parseChord, voiceChord } from '../theory/chords.js'
import { makeKey } from '../theory/keys.js'
import { analyseProgression, cadenceAt } from '../theory/analyze.js'
import { playProgression, stopPlayback, resumeAudio } from '../audio/synth.js'
import { encodeState } from '../lib/share.js'
import { TOOL_PATH } from '../lib/routes.js'

/**
 * The product, on the front page, doing the thing it is for.
 *
 * A minor phrase that ends on a major tonic — the Picardy third the site is
 * named after. Everything shown is computed by the engine at render time, not
 * typed: the numerals, the functions, the cadence and the note about the C♯. If
 * the analysis ever changed, this would change with it rather than going stale.
 */
const SYMBOLS = ['Am', 'Dm', 'E7', 'A']
const KEY = makeKey('A', 'minor')
const BEATS = 4
const BPM = 76

export default function HeroDemo() {
  const progression = useMemo(() => SYMBOLS.map((s) => parseChord(s)), [])
  const analysis = useMemo(() => analyseProgression(progression, KEY), [progression])
  const [step, setStep] = useState(-1)
  const playing = step >= 0

  useEffect(() => () => stopPlayback(), [])

  const last = progression.length - 1
  const cadence = cadenceAt(progression, last, KEY)
  // The observation worth leading with is the surprising one: the chord outside
  // the key. Falls back to whatever the engine said first.
  const note = analysis.observations.find((o) => /outside the key/.test(o.text))
    ?? analysis.observations[0]

  const toggle = () => {
    if (playing) {
      stopPlayback()
      setStep(-1)
      return
    }
    resumeAudio()
    setStep(0)
    playProgression(
      progression.map((chord) => ({ midis: voiceChord(chord, { bottom: 48 }), beats: BEATS })),
      {
        bpm: BPM,
        onStep: (i) => setStep(i),
        onDone: () => setStep(-1),
      },
    )
  }

  const studioHref = `${TOOL_PATH}#${encodeState({
    key: KEY,
    progression,
    inversions: progression.map(() => 0),
    durations: progression.map(() => BEATS),
    bpm: BPM,
  })}`

  return (
    <figure className="hero-demo" aria-label="A live example: Am, Dm, E7, A">
      <div className="hero-demo-head">
        <span className="lbl">Try it · A minor</span>
        <button type="button" className="btn primary tiny hero-demo-play" onClick={toggle} aria-pressed={playing}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
      </div>

      <ol className="fn-map hero-demo-map">
        {analysis.chords.map((c, i) => (
          <li
            key={i}
            className={`fn-cell fn-${c.fn}${i === step ? ' on' : ''}${c.diatonic ? '' : ' chromatic'}`}
          >
            <span className="fn-roman">{c.shownRoman ?? c.roman}</span>
            <span className="fn-sym">{c.symbol}</span>
          </li>
        ))}
      </ol>

      {/* Under the cells rather than inside the last one: "perfect authentic"
          is wider than a chord cell, and on a phone it pushed the tonic off the
          end of the row. */}
      {cadence && (
        <p className="hero-demo-cadence">
          <span className="fn-cadence fn-T">{cadence.label.replace(/ cadence$/, '')}</span>
          <span className="muted">{analysis.chords[last - 1]?.roman} → {analysis.chords[last]?.roman}</span>
        </p>
      )}

      {note && <figcaption className="hero-demo-note">{note.text} That major ending is a Picardy third.</figcaption>}

      <a className="hero-demo-link" href={studioHref}>Open this in the studio →</a>
    </figure>
  )
}
