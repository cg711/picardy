import React, { useEffect } from 'react'
import { linkProps } from '../lib/router.js'
import { TOOL_PATH, BACKING_PATH } from '../lib/routes.js'
import { LEVELS } from '../theory/exercises.js'

/**
 * The tools, as cards. Kept as data so the grid and the "what you can do" list
 * cannot drift apart — and so adding a third tool is one entry, not three edits.
 */
const TOOLS = [
  {
    path: TOOL_PATH,
    name: 'Studio',
    tagline: 'Write a progression. Find out what it is doing.',
    points: [
      'Ranked suggestions for the next chord, each with a roman numeral and a reason',
      'Analysis of what you have written — function, cadences, borrowed colour',
      'Guitar shapes and piano voicings for every chord, in twenty-two tunings',
      'Lyrics under their chords, a PDF lead sheet, and MIDI out',
    ],
    cta: 'Open the studio',
  },
  {
    path: BACKING_PATH,
    name: 'Backing tracks',
    tagline: 'A band behind your progression, to play over.',
    points: [
      'Drums, bass and comping in pop/rock, jazz swing, ballad or bossa nova',
      'A big chart that follows along, readable from where the instrument is',
      'Seamless looping, with fills where the sections change',
      'The whole track lives in the link, so sharing it is saving it',
    ],
    cta: 'Open a backing track',
  },
  {
    path: '/exercises',
    name: 'Exercises',
    tagline: 'Drills that grade themselves, generated fresh every time.',
    points: [
      'Roman numerals, harmonic function, chord spelling, cadences',
      'Intervals written and by ear; chords by ear',
      'Finding notes and intervals on a real keyboard and fretboard',
      'Every answer explained, and playable',
    ],
    cta: 'Start drilling',
  },
]

/**
 * What the engine is, in the three claims that are actually true of it. No
 * feature is listed here that the app does not already do — a landing page that
 * oversells is a bug report waiting to be filed.
 */
const PITCH = [
  {
    title: 'It explains, rather than just showing',
    body: `Most chord tools hand you a diagram or generate something and leave. Picardy names
      what each chord is doing in the key, why the next one is a good idea, and how the phrase
      closes — in plain English, on every screen.`,
  },
  {
    title: 'Spelling is taken seriously',
    body: `A chord is a root plus generic degrees, not a bag of pitch classes. That is why C7♯9
      spells D♯ and not E♭, why a German sixth on A♭ comes out with an F♯, and why transposing
      moves the music rather than just relabelling it.`,
  },
  {
    title: 'Nothing leaves your browser',
    body: `There is no account, no backend and no analytics on what you write. Progressions live
      in the URL and in local storage, which is also why a link is the whole share mechanism.`,
  },
]

export default function HomePage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <main className="home">
      <section className="home-hero">
        <h1>
          Chord progressions,
          <br />
          <span className="hero-accent">explained.</span>
        </h1>
        <p className="hero-sub">
          A fretboard and keyboard progression explorer. Enter chords, get ranked
          suggestions for what could come next — from plain diatonic moves through
          borrowed chords, applied dominants and tritone subs — each with a roman
          numeral, a reason, and a live view on both instruments.
        </p>
        <div className="hero-actions">
          <a className="btn primary hero-cta" {...linkProps(TOOL_PATH)}>Open the studio</a>
          <a className="btn ghost hero-cta" {...linkProps('/exercises')}>Try the exercises</a>
        </div>
        <p className="hero-note">
          Free, no account, nothing to install.
        </p>
      </section>

      <section className="home-section">
        <h2>The tools</h2>
        <div className="tool-grid">
          {TOOLS.map((tool) => (
            <a key={tool.path} className="tool-card" {...linkProps(tool.path)}>
              <h3>{tool.name}</h3>
              <p className="tool-tagline">{tool.tagline}</p>
              <ul>
                {tool.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <span className="tool-cta">{tool.cta} →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>Why it is built this way</h2>
        <div className="pitch-grid">
          {PITCH.map((item) => (
            <div key={item.title} className="pitch">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2>Practice topics</h2>
        <p className="section-lead">
          Six sets of drills, generated from the same engine the tool runs on — so the
          answers here and the analysis there can never disagree.
        </p>
        {/* Read from LEVELS rather than retyped: a topic added to the drill shows
            up on the front page by itself, and cannot be described wrongly. */}
        <ul className="topic-list">
          {LEVELS.map((level) => (
            <li key={level.id}>
              <a {...linkProps('/exercises')}>
                <strong>{level.label}</strong>
                <span>{level.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section home-closing">
        <h2>Named for the Picardy third</h2>
        <p>
          The major chord that ends a minor piece, where you expected the sad one. It is
          the whole idea in one device — the unexpected chord that turns out to work, and
          a reason why.
        </p>
        <a className="btn primary hero-cta" {...linkProps(TOOL_PATH)}>Start writing</a>
      </section>
    </main>
  )
}
