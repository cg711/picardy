import React from 'react'
import { SITE } from './site.js'
import { linkProps } from '../lib/router.js'

/**
 * Written to describe what the app actually does, which is the only reason it can
 * be this short: there is no backend to disclose. If that ever stops being true —
 * accounts, cloud sync, analytics — this page has to change *before* the feature
 * ships, not after.
 */
export default function Privacy() {
  return (
    <>
      <p className="legal-lede">
        Picardy has no accounts, no database, and no server of its own. The music you write stays
        in your browser.
      </p>

      <h2>What Picardy stores</h2>
      <p>
        Everything you make — chords, progressions, sections, songs, lyrics, pinned guitar shapes,
        tunings, and preferences like handedness and tempo — is kept in two places, both on your
        own device:
      </p>
      <ul>
        <li>
          <strong>Your browser's local storage</strong>, so your work is still there when you come
          back.
        </li>
        <li>
          <strong>The address bar</strong>, in the part of the URL after the <code>#</code>. That is
          what makes the <em>Share link</em> button work.
        </li>
      </ul>
      <p>
        Neither is sent to us. There is no account to create and no database for you to be in.
      </p>

      <h2>Share links</h2>
      <p>
        A share link carries your progression after the <code>#</code>. Browsers do not transmit
        that part of a URL to the server when they request a page, so the contents of a share link
        never reach our host. But <strong>anyone who has the link can read it</strong>. If you have
        written lyrics you would not want a stranger to see, don't share the link.
      </p>

      <h2>What the host sees</h2>
      <p>
        The site is a set of static files served by Cloudflare. Like any web server, theirs records
        ordinary request information — IP address, browser user agent, date and time, and which file
        was requested — and uses it to deliver the site and protect it from attack. We look at that
        only in aggregate, to know whether the site is up and roughly how much it is used.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        Picardy sets no cookies. As of the date below there is no analytics, no advertising, no
        third-party tracking, and no social media embeds. If that changes, this page will be updated
        first, and it will say exactly what is collected.
      </p>

      <h2>Exports and audio</h2>
      <p>
        PDF charts and MIDI files are generated inside your browser and saved straight to your
        device — they are never uploaded. Playback is synthesised locally. Picardy never asks for
        microphone access.
      </p>

      <h2>Children</h2>
      <p>
        Picardy is not directed at children under 13, and does not knowingly collect personal
        information from anyone, them included.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to see, correct, export, or delete the
        personal information a service holds about you. Picardy holds none, so there is nothing for
        us to send or erase. To remove what is stored on your own device, clear this site's data in
        your browser settings — that permanently deletes your saved sections and songs.
      </p>
      <p>
        If you are in the UK or EU and believe your data has been mishandled, you also have the
        right to complain to your national data protection authority.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date below changes with it. Material changes will be called out
        on the page rather than slipped in.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about any of this: {SITE.contact}. The companion document is the{' '}
        <a {...linkProps('/terms')}>terms of service</a>.
      </p>
    </>
  )
}
