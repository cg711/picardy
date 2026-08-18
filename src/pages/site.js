// The handful of facts the legal pages need that only you can supply.
//
// Fill these in before you publish. While any of them is still a placeholder the
// legal pages render a visible banner saying so, and `npm run check` prints a
// warning — an unfinished policy should not be able to go out quietly.

export const SITE = {
  /** Whoever is legally responsible: your own name until an entity exists. */
  operator: '[your name or LLC]',
  contact: '[your contact email]',
  /** Used only in the governing-law clause. */
  jurisdiction: '[your state]',
  /** Bump this whenever either document changes in substance. */
  updated: '17 August 2026',
}

const PLACEHOLDER = /\[.+\]/

/** Which fields are still placeholders, in the order they appear above. */
export function unfinished() {
  return Object.entries(SITE)
    .filter(([, value]) => PLACEHOLDER.test(value))
    .map(([field]) => field)
}
