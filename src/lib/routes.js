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

export const PAGES = [
  { path: '/', route: 'home', label: 'Home', title: 'Picardy — chord progressions, explained' },
  { path: '/tool', route: 'app', label: 'Progression tool', title: 'Progression tool — Picardy' },
  { path: '/exercises', route: 'exercises', label: 'Exercises', title: 'Exercises — Picardy' },
  { path: '/privacy', route: 'privacy', label: 'Privacy', title: 'Privacy — Picardy' },
  { path: '/terms', route: 'terms', label: 'Terms', title: 'Terms — Picardy' },
]

/** Where the tool lives. Referenced by name so moving it is one edit, not twelve. */
export const TOOL_PATH = '/tool'

/** Anything unrecognised lands on the front page rather than a blank tool. */
export function routeFor(pathname) {
  // Trailing slashes are the same page; '/privacy/' and '/privacy' must not diverge.
  const clean = String(pathname ?? '/').replace(/\/+$/, '') || '/'
  return PAGES.find((p) => p.path === clean)?.route ?? 'home'
}

export function pageFor(route) {
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
