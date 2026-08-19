import React, { useEffect } from 'react'
import Privacy from './Privacy.jsx'
import Terms from './Terms.jsx'
import { SITE, unfinished } from './site.js'
import { pageFor } from '../lib/routes.js'

const BODIES = { privacy: Privacy, terms: Terms }

export default function LegalPage({ route }) {
  const page = pageFor(route)
  const Body = BODIES[route] ?? Privacy

  // navigate() already scrolls up, but it runs before this page exists and the
  // browser's own scroll restoration lands after it — so arriving from halfway
  // down the app drops you halfway down the policy. Do it once the page is real.
  useEffect(() => { window.scrollTo(0, 0) }, [route])

  return (
    <main className="legal">
      <h1>{page.label === 'Privacy' ? 'Privacy policy' : 'Terms of service'}</h1>
      <DraftNotice />
      <Body />
      <p className="legal-meta">Last updated {SITE.updated}.</p>
    </main>
  )
}

/**
 * Shown until every field in site.js is filled in.
 *
 * A policy with "[your state]" still in it is worse than no policy, and the kind
 * of thing that ships because nobody re-read the page after wiring up the menu.
 * This makes that impossible to miss, and disappears on its own once the fields
 * are real.
 */
function DraftNotice() {
  const missing = unfinished()
  if (!missing.length) return null
  return (
    <div className="draft-notice" role="note">
      <strong>Draft — not ready to publish.</strong> This page describes how Picardy actually
      behaves, but it has not been reviewed by a lawyer, and {missing.length}{' '}
      {missing.length === 1 ? 'field is' : 'fields are'} still a placeholder:{' '}
      {missing.join(', ')}. Set {missing.length === 1 ? 'it' : 'them'} in{' '}
      <code>src/pages/site.js</code> and this notice disappears.
    </div>
  )
}
