import React, { useEffect } from 'react'
import { LESSONS, lessonById, lessonPath, LESSONS_PATH } from '../theory/lessons.js'
import { linkProps, usePathname } from '../lib/router.js'
import { lessonSlugFor, TOOL_PATH } from '../lib/routes.js'
import LessonExample from '../components/LessonExample.jsx'

/**
 * Free theory lessons, read from the same engine the studio runs on.
 *
 * The index and the reader are one component because they are one page in two
 * states, and splitting them would mean two places that know what a lesson is.
 */

/**
 * A paragraph, with *emphasis* honoured.
 *
 * Teaching prose wants to stress a word now and then, and the alternative to
 * these six lines was a markdown dependency or authors discovering that their
 * asterisks render as asterisks. Deliberately nothing else: no links, no bold,
 * no nesting — the moment a lesson needs those, it needs a real renderer, and
 * pretending otherwise is how a half-parser grows.
 */
function Prose({ text }) {
  return (
    <p>
      {text.split(/\*([^*]+)\*/).map((part, i) => (
        i % 2 ? <em key={i}>{part}</em> : part
      ))}
    </p>
  )
}

function LessonIndex() {
  return (
    <div className="page lessons-page">
      <section className="home-hero lessons-hero">
        <h2>Lessons</h2>
        <p className="lessons-lede">
          The theory behind the tool, in short articles. Every example is built by the same
          engine that powers the studio — the chord symbols, the roman numerals and the
          cadence names on these pages are computed, not typed, so they cannot disagree with
          what the app tells you. Play any of them, or open one in the studio and take it
          apart.
        </p>
      </section>

      <section className="home-section">
        <ol className="lesson-list">
          {LESSONS.map((lesson, i) => (
            <li key={lesson.id}>
              <a className="lesson-card" {...linkProps(lessonPath(lesson.id))}>
                <span className="lesson-card-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="lesson-card-body">
                  <span className="lesson-card-title">{lesson.title}</span>
                  <span className="lesson-card-blurb">{lesson.blurb}</span>
                </span>
                <span className="lesson-card-mins muted small">{lesson.minutes} min</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section home-closing">
        <h2>Then go and use it</h2>
        <p>
          Reading about a cadence gets you about a tenth of the way. Write one, hear it, and
          let the analysis panel tell you what you made.
        </p>
        <a className="btn primary hero-cta" {...linkProps(TOOL_PATH)}>Open the studio</a>
        <a className="btn ghost hero-cta" {...linkProps('/exercises')}>Drill it instead</a>
      </section>
    </div>
  )
}

function LessonReader({ lesson }) {
  const index = LESSONS.findIndex((l) => l.id === lesson.id)
  const prev = LESSONS[index - 1] ?? null
  const next = LESSONS[index + 1] ?? null

  return (
    <div className="page lesson-page">
      <article className="lesson-article">
        <nav className="lesson-crumb">
          <a {...linkProps(LESSONS_PATH)}>← All lessons</a>
          <span className="muted small">{lesson.minutes} min read</span>
        </nav>

        <header className="lesson-head">
          <h2>{lesson.title}</h2>
          <p className="lesson-blurb">{lesson.blurb}</p>
        </header>

        {lesson.sections.map((section, i) => (
          <section className="lesson-section" key={i}>
            {section.heading && <h3>{section.heading}</h3>}
            {section.body?.map((paragraph, n) => (
              <Prose key={n} text={paragraph} />
            ))}
            {section.points && (
              <ul className="lesson-points">
                {section.points.map((point, n) => <li key={n}>{point}</li>)}
              </ul>
            )}
            {section.example && <LessonExample example={section.example} />}
          </section>
        ))}

        <nav className="lesson-nav">
          {prev
            ? <a className="lesson-nav-link" {...linkProps(lessonPath(prev.id))}>
                <span className="muted small">Previous</span>
                <span>{prev.title}</span>
              </a>
            : <span />}
          {next
            ? <a className="lesson-nav-link next" {...linkProps(lessonPath(next.id))}>
                <span className="muted small">Next</span>
                <span>{next.title}</span>
              </a>
            : <span />}
        </nav>
      </article>
    </div>
  )
}

export default function LessonsPage() {
  // The reader is chosen by the URL, so it has to re-read on navigation — this
  // is why the router tracks the path rather than the route it resolves to.
  const path = usePathname()
  const lesson = lessonById(lessonSlugFor(path) ?? '')

  // A new article should start at the top, the way following a link does.
  useEffect(() => { window.scrollTo(0, 0) }, [path])

  return lesson ? <LessonReader lesson={lesson} /> : <LessonIndex />
}
