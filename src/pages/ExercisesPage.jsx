import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LEVELS, TYPE_LABELS, levelById, makeQuestion } from '../theory/exercises.js'
import { chordSymbol, voiceChord } from '../theory/chords.js'
import { keyName } from '../theory/keys.js'
import { playChord, playProgression, stopPlayback } from '../audio/synth.js'
import { encodeState } from '../lib/share.js'
import { pageFor } from '../lib/routes.js'

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
  const [progress, setProgress] = useState(readProgress)

  const level = levelById(levelId)
  const stats = progress[levelId] ?? blankLevel()
  const answered = chosen !== null

  useEffect(() => {
    document.title = pageFor('exercises').title
    window.scrollTo(0, 0)
    return () => { document.title = pageFor('app').title }
  }, [])

  // Leaving the page mid-drill should not leave a chord ringing.
  useEffect(() => () => stopPlayback(), [])

  const nextQuestion = useCallback((id = levelId) => {
    stopPlayback()
    setChosen(null)
    setQuestion(makeQuestion(id))
  }, [levelId])

  const chooseLevel = (id) => {
    setLevelId(id)
    setProgress((prev) => writeProgress({ ...prev, level: id }))
    nextQuestion(id)
  }

  const answer = useCallback((index) => {
    if (chosen !== null || !question) return
    setChosen(index)
    const right = index === question.answerIndex

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
  }, [chosen, question])

  const hear = useCallback(() => {
    if (!question) return
    stopPlayback()
    if (question.chords.length === 1) {
      playChord(voiceChord(question.chords[0], { bottom: 52 }), { duration: 1.8 })
      return
    }
    playProgression(
      question.chords.map((c) => ({ midis: voiceChord(c, { bottom: 52 }), beats: 2 })),
      { bpm: 92, timbre: 'piano', pattern: 'block', strum: 0.008 },
    )
  }, [question])

  // Number keys answer, Enter moves on. Drilling with a mouse is slow enough
  // that people stop after five questions instead of fifty.
  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      if (!answered && /^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        if (index < (question?.options.length ?? 0)) {
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
  }, [answered, question, answer, nextQuestion, hear])

  const openInTool = useMemo(() => {
    if (!question) return '/'
    return `/#${encodeState({ key: question.key, progression: question.chords })}`
  }, [question])

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
          <kbd>Enter</kbd> for the next one.
        </p>
      </header>

      <div className="ex-levels" role="tablist" aria-label="Difficulty">
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
          <span className="muted">{keyName(question.key)}</span>
          <span className="ex-score">
            <b>{stats.streak}</b> streak
            {stats.asked > 0 && <> · {pct(stats.right, stats.asked)}% of {stats.asked}</>}
          </span>
        </div>

        <div className="ex-body">
          <p className="ex-prompt">{question.prompt}</p>

          <button className="btn ghost ex-hear" onClick={hear}>
            ▶ Hear {question.chords.length > 1 ? 'them' : 'it'}
            <span className="ex-hear-chords">{question.chords.map(chordSymbol).join(' – ')}</span>
          </button>

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
            <div className={`ex-explain${chosen === question.answerIndex ? ' right' : ' wrong'}`} role="status">
              <strong>{chosen === question.answerIndex ? 'Correct.' : 'Not quite.'}</strong>{' '}
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
              <a className="btn ghost" href={openInTool}>
                Open these chords in the tool
              </a>
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
