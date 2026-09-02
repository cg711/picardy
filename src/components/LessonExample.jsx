import React, { useEffect, useState } from 'react'
import { buildExample } from '../theory/lessons.js'
import { keyName } from '../theory/keys.js'
import { timeSignatureOf } from '../theory/rhythm.js'
import { playProgression, stopPlayback, resumeAudio } from '../audio/synth.js'
import { encodeState } from '../lib/share.js'
import { TOOL_PATH } from '../lib/routes.js'

/**
 * One example inside a lesson: the chords, what they are called, and a way to
 * hear them.
 *
 * The chord symbols and numerals here are computed, never typed — see the note
 * at the top of theory/lessons.js. The consequence worth stating is that this
 * component cannot show you something the studio would disagree with, because
 * it is asking the same functions the studio asks.
 *
 * "Open in the studio" hands over the real progression rather than a
 * description of it, so a reader who wants to take an example apart lands in
 * the tool with it already loaded.
 */
export default function LessonExample({ example }) {
  const [playing, setPlaying] = useState(false)
  const built = buildExample(example)

  // Leaving the page mid-example should not leave chords ringing.
  useEffect(() => () => stopPlayback(), [])

  if (!built) return null

  const toggle = () => {
    if (playing) {
      stopPlayback()
      setPlaying(false)
      return
    }
    resumeAudio()
    setPlaying(true)
    playProgression(
      built.progression.map((chord, i) => ({ chord, beats: built.durations[i] })),
      {
        bpm: built.bpm,
        pattern: built.style,
        // The scheduler wants the metre resolved, not its id — a bare '4/4'
        // string here reads as no time signature at all.
        timeSignature: timeSignatureOf(built.timeSignature),
        onDone: () => setPlaying(false),
      },
    )
  }

  const studioHref = `${TOOL_PATH}#${encodeState({
    key: built.key,
    progression: built.progression,
    inversions: built.inversions,
    durations: built.durations,
    timeSignature: built.timeSignature,
    bpm: built.bpm,
    style: built.style,
  })}`

  return (
    <figure className="lesson-example">
      <div className="lesson-example-head">
        <span className="lesson-example-caption">{example.caption}</span>
        <span className="muted small">{keyName(built.key)}</span>
      </div>

      {/* Wide examples — the twelve-bar blues is twelve chords — scroll inside
          their own box rather than widening the article. */}
      <div className="lesson-chords-scroll">
        <ol className="lesson-chords">
          {built.symbols.map((symbol, i) => (
            <li key={i} className="lesson-chord">
              <span className="lesson-chord-symbol">{symbol}</span>
              <span className="lesson-chord-roman">{built.numerals[i]}</span>
            </li>
          ))}
        </ol>
      </div>

      {built.cadence && (
        <p className="lesson-cadence">
          <span className="lesson-cadence-badge">{built.cadence}</span>
          <span className="muted small">{built.cadenceWhy}</span>
        </p>
      )}

      <div className="lesson-example-actions">
        <button type="button" className="btn ghost tiny" onClick={toggle} aria-pressed={playing}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        {/* A real href: this is a link to a progression, and should behave like
            one under ⌘-click. It carries a hash, so it is a full navigation
            rather than an in-app push — the studio reads its state from there. */}
        <a className="btn ghost tiny" href={studioHref}>Open in the studio →</a>
      </div>
    </figure>
  )
}
