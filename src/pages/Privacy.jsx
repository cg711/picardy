import React from 'react'
import { SITE } from './site.js'
import { linkProps } from '../lib/router.js'

/**
 * Written to describe what the app actually does, which is the only reason it can
 * be this short: there is no backend to disclose. If that ever stops being true —
 * accounts, cloud sync, analytics — this page has to change *before* the feature
 * ships, not after.
 *
 * That rule was broken once already. Cloudflare Web Analytics was switched on in
 * the Cloudflare dashboard rather than added to this repository, so no commit
 * ever touched the code and this page went on claiming "no analytics" while a
 * beacon was live in production. Anything turned on from a hosting dashboard is
 * still a feature that ships; it just does not arrive through a pull request.
 */
export default function Privacy() {
  return (
    <>
      <p className="legal-lede">
        Picardy has no accounts, no database, and no server of its own. Nothing you write is stored
        by us. The one thing that does leave your browser is cookieless page-view analytics, and
        the section on that below says what it can see.
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
        Neither is sent to us, and there is no account to create and no database for you to be in.
      </p>

      <h2>Share links</h2>
      <p>
        A share link carries your progression after the <code>#</code>. Browsers do not transmit
        that part of a URL when they <em>request</em> a page, so it does not reach our host in the
        ordinary course of serving the site. Scripts running on the page can read it, which is why
        the analytics section below is worth reading. And <strong>anyone who has the link can read
        it</strong>: if you have written lyrics you would not want a stranger to see, don't share
        the link.
      </p>

      <h2>What the host sees</h2>
      <p>
        The site is a set of static files served by Cloudflare. Like any web server, theirs records
        ordinary request information — IP address, browser user agent, date and time, and which file
        was requested — and uses it to deliver the site and protect it from attack. We look at that
        only in aggregate, to know whether the site is up and roughly how much it is used.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        Picardy sets no cookies, and there is no advertising and no social media embeds.
      </p>
      <p>
        There <strong>is</strong> analytics. The site runs Cloudflare Web Analytics, which loads a
        small script from <code>static.cloudflareinsights.com</code> and reports page views and
        page-load timings to Cloudflare. It is cookieless, it does not build a profile of you, and it
        is not used to track you from one site to another. We use it only to see whether the site is
        working and roughly how much it is used.
      </p>
      <p>
        Because that script runs in your browser, it can see the address of the page you are on — and
        a Picardy progression is encoded <em>in</em> the address, after the <code>#</code>. We have
        not been able to confirm from the outside whether the fragment is included in what is
        reported, so treat it as though it might be: your work is not private from Cloudflare's
        measurement in the way it is private from us. It is still not stored by us, tied to an
        account, or readable by anyone who does not have the link.
      </p>
      <p>
        If that is not a trade you want to make, blocking <code>cloudflareinsights.com</code> — most
        content blockers do by default — stops the script loading and costs you nothing else. The
        rest of Picardy works identically without it.
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
        personal information a service holds about you. Picardy keeps no records of its own — no
        account, no database, nothing with your name on it — so there is nothing here for us to send
        or erase. What exists is the request logging and the aggregate analytics described above,
        both held by Cloudflare as our host and processor, and neither of which we can look up by
        person. To remove what is stored on your own device, clear this site's data in your browser
        settings — that permanently deletes your saved sections and songs.
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
