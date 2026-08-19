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
  { path: '/', route: 'app', label: 'Picardy', title: 'Picardy — chord progressions, explained' },
  { path: '/exercises', route: 'exercises', label: 'Exercises', title: 'Exercises — Picardy' },
  { path: '/privacy', route: 'privacy', label: 'Privacy', title: 'Privacy — Picardy' },
  { path: '/terms', route: 'terms', label: 'Terms', title: 'Terms — Picardy' },
]

/** Anything unrecognised falls back to the app, which is also what the host serves. */
export function routeFor(pathname) {
  // Trailing slashes are the same page; '/privacy/' and '/privacy' must not diverge.
  const clean = String(pathname ?? '/').replace(/\/+$/, '') || '/'
  return PAGES.find((p) => p.path === clean)?.route ?? 'app'
}

export function pageFor(route) {
  return PAGES.find((p) => p.route === route) ?? PAGES[0]
}
