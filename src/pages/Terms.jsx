import React from 'react'
import { SITE } from './site.js'
import { linkProps } from '../lib/router.js'

export default function Terms() {
  return (
    <>
      <p className="legal-lede">
        Picardy is a free music theory tool. These terms are short because the service is simple:
        nothing you write leaves your browser, and what you write is yours.
      </p>

      <h2>Using Picardy</h2>
      <p>By using the site you agree to these terms. If you don't agree to them, please don't use it.</p>

      <h2>What you make is yours</h2>
      <p>
        You own everything you create with Picardy — progressions, arrangements, lyrics, charts, and
        exports. We claim no ownership and no licence over any of it, and could not exercise one if
        we did: your work never reaches our servers.
      </p>
      <p>
        That includes work you make money from. Songs you write with the help of Picardy's
        suggestions are yours to record, publish, perform, and sell, with no attribution required
        and nothing owed.
      </p>

      <h2>Lyrics you did not write</h2>
      <p>
        If you paste in lyrics somebody else owns, that is between you and the copyright holder.
        Picardy keeps them on your device and does not publish, host, or transmit them.
      </p>

      <h2>What Picardy is not</h2>
      <p>
        The suggestions, roman numerals, chord-scale choices, and guitar shapes are produced by an
        algorithm working from one reading of common-practice and jazz convention. Music theory is
        genuinely contested, and the app will sometimes be wrong, unidiomatic, or simply odd. Treat
        it as a well-read practice partner rather than an authority, and check its work before
        relying on it for teaching, publishing, or examination.
      </p>
      <p>
        Guitar shapes are filtered for playability by a model of a hand, not by a hand. Some of them
        will be a stretch. Play within your comfort and don't hurt yourself chasing one.
      </p>

      <h2>No warranty</h2>
      <p>
        Picardy is provided "as is" and "as available", without warranties of any kind, express or
        implied, including any implied warranty of merchantability or fitness for a particular
        purpose. We don't promise the site will be available, uninterrupted, or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {SITE.operator} is not liable for any indirect,
        incidental, or consequential damages arising from your use of Picardy, including lost work.
        Because the service is free, total liability is limited to zero. Nothing here limits
        liability that cannot be limited by law.
      </p>
      <p>
        Worth saying plainly, since it is the likeliest thing to go wrong: your work lives in your
        browser. Clearing site data, browsing privately, or moving to another device will lose it.
        Export anything you care about.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don't try to disrupt the service or the people using it, don't use automated means to
        overload it, and don't present Picardy, its name, or its mark in a way that implies an
        endorsement or an authorship you don't have.
      </p>

      <h2>What we own</h2>
      <p>
        The Picardy name and mark, and the code and design of the site, belong to {SITE.operator}.
        Musical facts do not: scales, chord spellings, roman numeral analysis, and the common
        progressions the app suggests are nobody's property and are not claimed here.
      </p>

      <h2>Changes and availability</h2>
      <p>
        Picardy will change, and features may be added or removed. It is free at the time of
        writing; if that ever changes, anything you have already made stays yours and stays on your
        device. These terms may be updated, and the date below will change when they are.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {SITE.jurisdiction}, without regard to its conflict
        of law rules.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about any of this: {SITE.contact}. The companion document is the{' '}
        <a {...linkProps('/privacy')}>privacy policy</a>.
      </p>
    </>
  )
}
