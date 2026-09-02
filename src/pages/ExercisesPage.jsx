import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/**
 * Time attack: sixty seconds, as many right answers as you can.
 *
 * The wrong-answer penalty is what makes the mode worth playing. Without it the
 * best strategy is to hammer the number keys — four options is a 25% hit rate,
 * and at half a second a question that beats answering carefully. Costing time
 * for a wrong answer makes guessing lose to thinking without needing a rule
 * about how fast you are allowed to press.
 */
const ATTACK_SECONDS = 60
const WRONG_PENALTY_MS = 3000
/** Long enough to see which option was right, short enough not to feel like a wait. */
const ATTACK_ADVANCE_MS = 550

const pct = (right, asked) => (asked ? Math.round((right / asked) * 100) : 0)

export default function ExercisesPage() {
  const [levelId, setLevelId] = useState(() => readProgress().level ?? LEVELS[0].id)
  const [question, setQuestion] = useState(() => makeQuestion(levelId))
  const [chosen, setChosen] = useState(null)
  // Instrument questions are answered by clicking a note rather than an option,
  // so what was "picked" is a MIDI number and there is no index to compare.
  const [picked, setPicked] = useState(null)
  const [progress, setProgress] = useState(readProgress)

  // A run is null in practice mode. `endsAt` moves — a wrong answer takes time
  // off the clock — so the remaining time is derived from it rather than counted
  // down in a variable, which also means a backgrounded tab cannot drift.
  const [run, setRun] = useState(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const advanceTimer = useRef(null)

  const level = levelById(levelId)
  const stats = progress[levelId] ?? blankLevel()
  const onInstrument = question?.input === 'instrument'
  const answered = onInstrument ? picked !== null : chosen !== null
  const gotItRight = onInstrument ? checkNote(question, picked) : chosen === question?.answerIndex

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Leaving the page mid-drill should not leave a chord ringing.
  useEffect(() => () => stopPlayback(), [])

  // Leaving mid-run should not leave a queued question either.
  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const running = !!run && !run.over
  const remainingMs = run ? Math.max(0, run.endsAt - nowMs) : 0

  // One ticker, only while a run is live. Reading the clock rather than
  // decrementing means a slow or coalesced tick loses no time.
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNowMs(Date.now()), 100)
    return () => clearInterval(id)
  }, [running])

  // Browsers throttle timers in a hidden tab, so the interval above stops being
  // a clock the moment you switch away — it froze at 0.2s in testing and the run
  // never ended. Re-read the time on the way back, and treat the wall clock
  // rather than the last tick as the authority on whether a run is over, so
  // backgrounding the tab cannot buy answering time.
  useEffect(() => {
    if (!running) return undefined
    const sync = () => setNowMs(Date.now())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [running])

  const expired = useCallback(() => !!run && !run.over && Date.now() >= run.endsAt, [run])

  // Time up. Done in an effect rather than inside the ticker so that the run
  // ends exactly once however many renders notice the clock has run out.
  useEffect(() => {
    if (!running || remainingMs > 0) return
    clearTimeout(advanceTimer.current)
    stopPlayback()
    setRun((r) => (r && !r.over ? { ...r, over: true } : r))
    setProgress((prev) => {
      const before = prev[levelId] ?? blankLevel()
      const score = run?.correct ?? 0
      return writeProgress({
        ...prev,
        [levelId]: { ...before, attackBest: Math.max(before.attackBest ?? 0, score) },
      })
    })
  }, [running, remainingMs, levelId, run])

  const nextQuestion = useCallback((id = levelId) => {
    stopPlayback()
    setChosen(null)
    setPicked(null)
    // Read the tally straight from storage rather than from `progress`: the
    // answer that has just been recorded is still in flight in React state, and
    // the next question should be chosen knowing about it.
    setQuestion(makeQuestion(id, Math.random, { byType: (readProgress()[id] ?? blankLevel()).byType }))
  }, [levelId])

  const chooseLevel = (id) => {
    // A score belongs to the topic it was set on, so changing topic abandons the
    // run rather than carrying half of it across.
    clearTimeout(advanceTimer.current)
    setRun(null)
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

    // In a run the same answer also costs or earns time, and pulls the next
    // question up behind it — waiting for Enter would make reading the
    // explanation cost you the thing being measured.
    setRun((r) => {
      if (!r || r.over) return r
      return {
        ...r,
        correct: r.correct + (right ? 1 : 0),
        wrong: r.wrong + (right ? 0 : 1),
        endsAt: right ? r.endsAt : r.endsAt - WRONG_PENALTY_MS,
      }
    })
  }, [question])

  // Scheduled outside record so it reads the run state after that update, and
  // so a run that has just expired does not queue a question nobody will see.
  const queueNext = useCallback(() => {
    clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      setRun((r) => {
        if (r && !r.over && r.endsAt > Date.now()) nextQuestion()
        return r
      })
    }, ATTACK_ADVANCE_MS)
  }, [nextQuestion])

  const startRun = useCallback(() => {
    clearTimeout(advanceTimer.current)
    stopPlayback()
    setNowMs(Date.now())
    setRun({ endsAt: Date.now() + ATTACK_SECONDS * 1000, correct: 0, wrong: 0, over: false })
    nextQuestion()
  }, [nextQuestion])

  const endRun = useCallback(() => {
    clearTimeout(advanceTimer.current)
    setRun(null)
    nextQuestion()
  }, [nextQuestion])

  const answer = useCallback((index) => {
    if (answered || !question || run?.over) return
    // The displayed clock can be stale; the wall clock cannot.
    if (expired()) { setNowMs(Date.now()); return }
    setChosen(index)
    record(index === question.answerIndex)
    if (running) queueNext()
  }, [answered, question, record, running, run, queueNext, expired])

  const answerNote = useCallback((midi) => {
    if (answered || !question || run?.over) return
    if (expired()) { setNowMs(Date.now()); return }
    setPicked(midi)
    record(checkNote(question, midi))
    if (running) queueNext()
  }, [answered, question, record, running, run, queueNext, expired])

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
    // An entry is either bare MIDI or { midis, beats }: a cadence that plants a
    // key wants short chords and a long note after it, and one length for
    // everything would make that either rushed or interminable.
    const items = voices.map((v) => (Array.isArray(v) ? { midis: v, beats: 2 } : v))
    if (items.length === 1) {
      playChord(items[0].midis, { duration: 1.8 })
      return
    }
    playProgression(items, {
      bpm: question?.playBpm ?? 92,
      timbre: 'piano',
      pattern: 'block',
      strum: 0.008,
    })
  }, [voices, question])

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
      <div className="ex-blurb-row">
        <p className="ex-blurb">{level.blurb}</p>
        {!run && (
          <button className="btn ghost tiny ex-attack-start" onClick={startRun}>
            ⏱ Time attack · {ATTACK_SECONDS}s
          </button>
        )}
      </div>

      {run && (
        <div className={`ex-attack${run.over ? ' over' : ''}${!run.over && remainingMs <= 10000 ? ' urgent' : ''}`}>
          <div className="ex-attack-head">
            <span className="ex-attack-clock">{(remainingMs / 1000).toFixed(1)}s</span>
            <span className="ex-attack-tally">
              <b>{run.correct}</b> right
              {run.wrong > 0 && <> · {run.wrong} wrong</>}
              {stats.attackBest > 0 && <span className="muted"> · best {stats.attackBest}</span>}
            </span>
            <button className="btn ghost tiny" onClick={endRun}>
              {run.over ? 'Back to practice' : 'Stop'}
            </button>
          </div>
          {/* The bar is the clock read at a glance; a wrong answer visibly takes
              a bite out of it, which is the feedback the penalty needs. */}
          <div className="ex-attack-bar" aria-hidden="true">
            <span style={{ width: `${(remainingMs / (ATTACK_SECONDS * 1000)) * 100}%` }} />
          </div>
        </div>
      )}

      {run?.over && (
        <div className="panel ex-result" role="status">
          <div className="panel-head">
            <h2>Time</h2>
            {run.correct >= (stats.attackBest ?? 0) && run.correct > 0 && (
              <span className="ex-result-best">new best</span>
            )}
          </div>
          <div className="ex-result-body">
            <p className="ex-result-score"><b>{run.correct}</b> right in {ATTACK_SECONDS} seconds</p>
            <p className="muted small">
              {run.wrong === 0
                ? 'Nothing wrong — nothing lost to the penalty.'
                : `${run.wrong} wrong cost you ${(run.wrong * WRONG_PENALTY_MS) / 1000} seconds.`}
              {' '}Best on {level.label.toLowerCase()}: {Math.max(stats.attackBest ?? 0, run.correct)}.
            </p>
            <div className="ex-actions">
              <button className="btn primary" onClick={startRun} autoFocus>Again</button>
              <button className="btn ghost" onClick={endRun}>Back to practice</button>
            </div>
          </div>
        </div>
      )}

      {!run?.over && (
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
      )}

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
