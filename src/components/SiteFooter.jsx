import React from 'react'
import { PAGES } from '../lib/routes.js'
import { linkProps } from '../lib/router.js'

/**
 * The legal links live here as well as in the menu on purpose: a policy people
 * cannot find is not much of a policy, and the footer is where everyone looks
 * for one first.
 */
export default function SiteFooter({ route }) {
  return (
    <footer className="foot">
      {route === 'app' && (
        <span className="muted">
          Suggestions are ranked by how often each move appears in common-practice and jazz
          repertoire, then reweighted against your actual progression — root motion, unresolved
          tendency tones, and voice leading.
        </span>
      )}
      <nav className="foot-links" aria-label="Site">
        {PAGES.filter((page) => page.route !== route).map((page) => (
          <a key={page.path} {...linkProps(page.path)}>
            {page.route === 'app' ? 'Progression Tool' : page.label}
          </a>
        ))}
      </nav>
    </footer>
  )
}
