// Which paths exist, kept free of React so the check suite can import it.
//
// These are real paths rather than hash routes, because the hash is already the
// app's state channel — writeHash() owns everything after the '#'. A legal page
// also needs a URL you can hand to an app store, a payment provider, or a lawyer,
// and '/#privacy' is not that.
//
// Direct loads work because the host serves index.html for unknown paths:
// wrangler.jsonc sets not_found_handling to "single-page-application", and Vite's
// dev server does the same by default.

import { LESSONS, lessonById, lessonPath } from '../theory/lessons.js'

export const PAGES = [
  { path: '/', route: 'home', label: 'Home', title: 'Picardy — chord progressions, explained' },
  { path: '/tool', route: 'app', label: 'Studio', title: 'Studio — Picardy' },
  { path: '/backing', route: 'backing', label: 'Backing tracks', title: 'Backing tracks — Picardy' },
  { path: '/exercises', route: 'exercises', label: 'Exercises', title: 'Exercises — Picardy' },
  { path: '/lessons', route: 'lessons', label: 'Lessons', title: 'Lessons — Picardy' },
  { path: '/privacy', route: 'privacy', label: 'Privacy', title: 'Privacy — Picardy' },
  { path: '/terms', route: 'terms', label: 'Terms', title: 'Terms — Picardy' },
]

/** Where the tool lives. Referenced by name so moving it is one edit, not twelve. */
export const TOOL_PATH = '/tool'
export const BACKING_PATH = '/backing'

const clean = (pathname) => String(pathname ?? '/').replace(/\/+$/, '') || '/'

/**
 * The one page that takes an argument.
 *
 * Lessons are known at build time, so this stays a membership test against a
 * fixed list rather than a wildcard: an unknown slug is not a lesson, and falls
 * through to the same "we do not have that" handling as any other bad path.
 * Returns the slug, or null if this is not a lesson URL.
 */
export function lessonSlugFor(pathname) {
  const rest = clean(pathname).match(/^\/lessons\/([^/]+)$/)
  if (!rest) return null
  const slug = decodeURIComponent(rest[1])
  return LESSONS.some((lesson) => lesson.id === slug) ? slug : null
}

/** Anything unrecognised lands on the front page rather than a blank tool. */
export function routeFor(pathname) {
  // Trailing slashes are the same page; '/privacy/' and '/privacy' must not diverge.
  const path = clean(pathname)
  const exact = PAGES.find((p) => p.path === path)?.route
  if (exact) return exact
  // A real lesson gets the reader; a made-up one gets the index, which is more
  // use than the front page when someone has mistyped a slug they were given.
  if (lessonSlugFor(path)) return 'lesson'
  if (/^\/lessons\//.test(path)) return 'lessons'
  return 'home'
}

export function pageFor(route, pathname = null) {
  if (route === 'lesson') {
    const lesson = lessonById(lessonSlugFor(pathname ?? '') ?? '')
    if (lesson) return { path: lessonPath(lesson.id), route, label: lesson.title, title: `${lesson.title} — Picardy` }
  }
  return PAGES.find((p) => p.route === route) ?? PAGES[0]
}

/**
 * Every progression ever shared points at `/#k=…`, because that is where the
 * tool used to live. Moving it to /tool would break all of them, so a state
 * fragment arriving at the front door is forwarded rather than landed on.
 *
 * Returns the path to rewrite to, or null to stay put. Kept here, pure, so the
 * check suite can hold it to the promise.
 */
export function legacyToolPath(pathname, hash) {
  const clean = String(pathname ?? '/').replace(/\/+$/, '') || '/'
  if (clean !== '/') return null
  // `k` is the one parameter encodeState always writes, so it is what tells a
  // shared progression apart from an empty fragment or a stray anchor.
  const raw = String(hash ?? '').replace(/^#/, '')
  if (!raw) return null
  return new URLSearchParams(raw).has('k') ? TOOL_PATH : null
}
