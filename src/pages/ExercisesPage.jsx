import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LEVELS, TYPE_LABELS, levelById, makeQuestion, checkNote,
  GUITAR_TUNING, GUITAR_MAX_FRET, PIANO_LOW, PIANO_HIGH,
} from '../theory/exercises.js'
import { chordSymbol, voiceChord } from '../theory/chords.js'
import { keyName } from '../theory/keys.js'
import { playChord, playProgression, stopPlayback } from '../audio/synth.js'
import { encodeState } from '../lib/share.js'
import { TOOL_PATH } from '../lib/routes.js'
import Piano from '../components/Piano.jsx'
import Fretboard from '../components/Fretboard.jsx'

const STORE_KEY = 'picardy.exercises.v1'

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

function writeProgress(next) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    /* storage blocked — the drill still works, it just won't be remembered */
  }
  return next
}

const blankLevel = () => ({ asked: 0, right: 0, streak: 0, best: 0, byType: {} })

const pct = (right, asked) => (asked ? Math.round((right / asked) * 100) : 0)

export default function ExercisesPage() {
  const [levelId, setLevelId] = useState(() => readProgress().level ?? LEVELS[0].id)
  const [question, setQuestion] = useState(() => makeQuestion(levelId))
  const [chosen, setChosen] = useState(null)
  // Instrument questions are answered by clicking a note rather than an option,
  // so what was "picked" is a MIDI number and there is no index to compare.
  const [picked, setPicked] = useState(null)
  const [progress, setProgress] = useState(readProgress)

  const level = levelById(levelId)
  const stats = progress[levelId] ?? blankLevel()
  const onInstrument = question?.input === 'instrument'
  const answered = onInstrument ? picked !== null : chosen !== null
  const gotItRight = onInstrument ? checkNote(question, picked) : chosen === question?.answerIndex

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Leaving the page mid-drill should not leave a chord ringing.
  useEffect(() => () => stopPlayback(), [])

  const nextQuestion = useCallback((id = levelId) => {
    stopPlayback()
    setChosen(null)
    setPicked(null)
    setQuestion(makeQuestion(id))
  }, [levelId])

  const chooseLevel = (id) => {
    setLevelId(id)
    setProgress((prev) => writeProgress({ ...prev, level: id }))
    nextQuestion(id)
  }

  // Scoring is the same whichever way the answer arrived, so both entry points
  // funnel through here rather than each keeping their own copy of the tally.
  const record = useCallback((right) => {
    setProgress((prev) => {
      const before = prev[question.level] ?? blankLevel()
      const type = before.byType[question.type] ?? { asked: 0, right: 0 }
      const streak = right ? before.streak + 1 : 0
      return writeProgress({
        ...prev,
        level: question.level,
        [question.level]: {
          asked: before.asked + 1,
          right: before.right + (right ? 1 : 0),
          streak,
          best: Math.max(before.best, streak),
          byType: {
            ...before.byType,
            [question.type]: { asked: type.asked + 1, right: type.right + (right ? 1 : 0) },
          },
        },
      })
    })
  }, [question])

  const answer = useCallback((index) => {
    if (answered || !question) return
    setChosen(index)
    record(index === question.answerIndex)
  }, [answered, question, record])

  const answerNote = useCallback((midi) => {
    if (answered || !question) return
    setPicked(midi)
    record(checkNote(question, midi))
  }, [answered, question, record])

  /**
   * What this question sounds like: explicit MIDI if it has any, else its chords.
   *
   * Some questions hold back part of the sound until they are over — a
   * find-the-note drill that plays the note you are looking for has answered
   * itself.
   */
  const voices = useMemo(() => {
    if (!question) return []
    if (answered && question.playAnswer) return question.playAnswer
    if (question.play) return question.play
    return (question.chords ?? []).map((c) => voiceChord(c, { bottom: 52 }))
  }, [question, answered])

  const hear = useCallback(() => {
    if (!voices.length) return
    stopPlayback()
    if (voices.length === 1) {
      playChord(voices[0], { duration: 1.8 })
      return
    }
    playProgression(
      voices.map((midis) => ({ midis, beats: 2 })),
      { bpm: 92, timbre: 'piano', pattern: 'block', strum: 0.008 },
    )
  }, [voices])

  // Ear questions play themselves on arrival — the whole question is the sound,
  // and pressing play every single time is friction with no purpose. Before the
  // first click the audio context is still suspended and this is a silent no-op,
  // which is why the play button stays.
  useEffect(() => {
    if (question?.autoPlay) hear()
  }, [question, hear])

  // Number keys answer, Enter moves on. Drilling with a mouse is slow enough
  // that people stop after five questions instead of fifty.
  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      if (!answered && !onInstrument && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        if (index < (question?.options?.length ?? 0)) {
          event.preventDefault()
          answer(index)
        }
      } else if (answered && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        nextQuestion()
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        hear()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, onInstrument, question, answer, nextQuestion, hear])

  // Only offered when the question is made of chords in a key. An interval or a
  // single note has nothing for the progression editor to open.
  const openInTool = useMemo(() => {
    if (!question?.chords?.length || !question.key) return null
    return `${TOOL_PATH}#${encodeState({ key: question.key, progression: question.chords })}`
  }, [question])

  /**
   * Reference note, the pick, and — once it is over — every note that would have
   * been accepted.
   *
   * "Find any B♭" has a dozen right answers, so showing one of them and calling
   * it the answer would teach the wrong lesson. All of them light up.
   */
  const marks = useMemo(() => {
    const m = new Map()
    if (!question) return m
    if (question.reference != null) m.set(question.reference, 'ref')
    if (answered) {
      if (question.answerMidi != null) m.set(question.answerMidi, 'right')
      for (const pc of question.answerPcs ?? []) {
        const { low, high } = question.instrument === 'piano'
          ? { low: PIANO_LOW, high: PIANO_HIGH }
          : { low: GUITAR_TUNING[0], high: GUITAR_TUNING[GUITAR_TUNING.length - 1] + GUITAR_MAX_FRET }
        for (let n = low; n <= high; n++) if (((n % 12) + 12) % 12 === pc) m.set(n, 'right')
      }
      if (picked != null) m.set(picked, checkNote(question, picked) ? 'right' : 'wrong')
    }
    return m
  }, [question, answered, picked])

  if (!question) {
    return (
      <main className="exercises">
        <p className="empty-note">Could not build a question. Reload to try again.</p>
      </main>
    )
  }

  const weak = Object.entries(stats.byType)
    .filter(([, t]) => t.asked >= 4)
    .sort((a, b) => pct(a[1].right, a[1].asked) - pct(b[1].right, b[1].asked))

  return (
    <main className="exercises">
      <header className="ex-intro">
        <h1>Exercises</h1>
        <p>
          Every question is generated from the same engine the tool runs on, so the
          answers here and the analysis there can never disagree — and there is no
          end to them. Answer with the number keys, <kbd>P</kbd> to hear it,{' '}
          <kbd>Enter</kbd> for the next one — or answer on the instrument, where
          there is one.
        </p>
      </header>

      <div className="ex-levels" role="tablist" aria-label="Topic">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={l.id === levelId}
            className={l.id === levelId ? 'on' : ''}
            onClick={() => chooseLevel(l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="ex-blurb">{level.blurb}</p>

      <div className="panel ex-card">
        <div className="panel-head">
          <h2>{question.typeLabel}</h2>
          {question.key && <span className="muted">{keyName(question.key)}</span>}
          <span className="ex-score">
            <b>{stats.streak}</b> streak
            {stats.asked > 0 && <> · {pct(stats.right, stats.asked)}% of {stats.asked}</>}
          </span>
        </div>

        <div className="ex-body">
          <p className="ex-prompt">{question.prompt}</p>

          {question.hint && <p className="ex-hint">{question.hint}</p>}

          {voices.length > 0 && (
            <button className={`btn ghost ex-hear${question.secret ? ' loud' : ''}`} onClick={hear}>
              ▶ {question.secret ? 'Play again' : `Hear ${voices.length > 1 ? 'them' : 'it'}`}
              {/* Naming the chords next to the button would answer a listening
                  question before it was asked. */}
              {!question.secret && question.chords?.length > 0 && (
                <span className="ex-hear-chords">{question.chords.map(chordSymbol).join(' – ')}</span>
              )}
            </button>
          )}

          {question.instrument === 'piano' && (
            <div className="ex-instrument">
              <Piano
                chord={null}
                low={PIANO_LOW}
                high={PIANO_HIGH}
                marks={marks}
                showLabels={false}
                readout={false}
                onToggleNote={onInstrument ? answerNote : undefined}
              />
            </div>
          )}

          {question.instrument === 'guitar' && (
            <div className="ex-instrument">
              <Fretboard
                chord={null}
                tuning={GUITAR_TUNING}
                maxFret={GUITAR_MAX_FRET}
                marks={marks}
                onToggleNote={onInstrument ? answerNote : undefined}
              />
            </div>
          )}

          {onInstrument && (
            <ul className="ex-legend">
              {question.reference != null && <li className="mark-ref">the note in the question</li>}
              {answered && <li className={gotItRight ? 'mark-right' : 'mark-wrong'}>what you picked</li>}
              {answered && !gotItRight && <li className="mark-right">where it was</li>}
              {!answered && <li className="plain">click a {question.instrument === 'guitar' ? 'fret' : 'key'} to answer</li>}
            </ul>
          )}

          <ol className="ex-options">
            {question.options.map((option, i) => {
              // After answering, the right answer is always marked — including
              // when it was not the one picked. A drill that only says "wrong"
              // teaches nothing.
              const state = !answered
                ? ''
                : i === question.answerIndex
                  ? ' right'
                  : i === chosen
                    ? ' wrong'
                    : ' dim'
              return (
                <li key={option}>
                  <button
                    className={`ex-option${state}`}
                    onClick={() => answer(i)}
                    disabled={answered}
                  >
                    <span className="ex-key" aria-hidden="true">{i + 1}</span>
                    <span className="ex-label">{option}</span>
                    {answered && i === question.answerIndex && <span className="ex-mark">✓</span>}
                    {answered && i === chosen && i !== question.answerIndex && <span className="ex-mark">✕</span>}
                  </button>
                </li>
              )
            })}
          </ol>

          {answered && (
            <div className={`ex-explain${gotItRight ? ' right' : ' wrong'}`} role="status">
              <strong>{gotItRight ? 'Correct.' : 'Not quite.'}</strong>{' '}
              {question.explain}
            </div>
          )}

          {answered && (
            <div className="ex-actions">
              <button className="btn primary" onClick={() => nextQuestion()} autoFocus>
                Next question
              </button>
              {/* A real navigation rather than an in-app link: the app reads its
                  state from the hash once, on load, so this has to be a load. */}
              {openInTool && (
                <a className="btn ghost" href={openInTool}>
                  Open these chords in the tool
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {weak.length > 0 && (
        <div className="panel ex-stats">
          <div className="panel-head">
            <h2>How you are doing</h2>
            <span className="muted">best streak {stats.best}</span>
          </div>
          <ul className="ex-bars">
            {weak.map(([type, t]) => (
              <li key={type}>
                <span className="ex-bar-label">{TYPE_LABELS[type]}</span>
                <span className="ex-bar" aria-hidden="true">
                  <span style={{ width: `${pct(t.right, t.asked)}%` }} />
                </span>
                <span className="ex-bar-num">{pct(t.right, t.asked)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
