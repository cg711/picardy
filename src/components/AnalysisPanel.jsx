import React, { useMemo } from 'react'
import { analyseProgression, cadenceAt } from '../theory/analyze.js'
import { detectKey, keyName } from '../theory/keys.js'
import { pcOf } from '../theory/notes.js'

/**
 * Root motion between consecutive chords, named the way musicians name it:
 * by the shorter direction. A root rising five semitones is a fall of a fifth,
 * because that is the move the ear tracks around the circle.
 */
const MOTION = {
  0: 'same', 1: '↑ ½', 2: '↑ 2nd', 3: '↑ m3', 4: '↑ M3', 5: '↓ 5th',
  6: 'tritone', 7: '↑ 5th', 8: '↓ M3', 9: '↓ m3', 10: '↓ 2nd', 11: '↓ ½',
}

const FN_LABEL = { T: 'tonic', PD: 'predominant', D: 'dominant' }

const sameKey = (a, b) =>
  !!a && !!b && a.mode === b.mode && pcOf(a.tonic) === pcOf(b.tonic)

export default function AnalysisPanel({
  progression,
  musicKey,
  inversions,
  activeIndex,
  playingIndex,
  onSelect,
  onUseKey,
  // The single-chord readout, merged in below the whole-progression one. Passed
  // as children rather than rebuilt here: it is the same panel's second half,
  // not a second panel, and it needs half of App's state to render.
  children,
}) {
  // Read the progression in the key the user has set, so the numerals here
  // agree with the ones on the chips. What the chords *imply* is reported
  // separately below rather than silently overriding the setting.
  const analysis = useMemo(
    () => analyseProgression(progression, musicKey, inversions),
    [progression, musicKey, inversions],
  )

  const detected = useMemo(
    () => (progression.length > 1 ? detectKey(progression) : null),
    [progression],
  )

  // Cadences anywhere, not only at the end — an interior one marks where a
  // phrase closes, which is usually where the section wants to breathe.
  //
  // Half cadences are excluded in the interior: every chord landing on V
  // technically forms one, so marking them all would bury the informative
  // cadences under noise. The final move is always shown, half or not.
  const cadences = useMemo(() => {
    if (!musicKey) return []
    return progression.map((_, i) => {
      const c = cadenceAt(progression, i, musicKey)
      if (!c) return null
      if (c.id === 'half' && i !== progression.length - 1) return null
      return c
    })
  }, [progression, musicKey])

  const motions = useMemo(
    () =>
      progression.map((chord, i) =>
        i === 0 ? null : MOTION[(((pcOf(chord.root) - pcOf(progression[i - 1].root)) % 12) + 12) % 12],
      ),
    [progression],
  )

  if (!progression.length) {
    return (
      <div className="panel p-analysis">
        <div className="panel-head">
          <h2>Analysis</h2>
        </div>
        {children}
        <div className="analysis-body">
          <p className="empty-note">
            Add a couple of chords and Picardy will read them back to you — the key
            they imply, what each chord is doing, and how the phrase closes.
          </p>
        </div>
      </div>
    )
  }

  const focused = playingIndex >= 0 ? playingIndex : activeIndex
  // detectKey answers with one key, so on a progression that modulates it names
  // whichever key won overall — and offering to "read it all in G major" is
  // offering the exact reading the key areas were built to replace. The banner
  // is for a genuine disagreement about a single key, so it stands down when
  // the set key is one the music is actually in.
  const areas = analysis.areas ?? []
  const modulates = areas.length > 1
  const inSomeArea = areas.some((a) => sameKey(a.key, musicKey))
  const mismatch = detected && !sameKey(detected, musicKey) && !(modulates && inSomeArea)

  return (
    <div className="panel p-analysis">
      <div className="panel-head">
        <h2>Analysis</h2>
      </div>

      {/* The chord you are on, then the progression it sits in — narrowest
          first, because that is the one you are looking at while you edit. The
          key and the chord count belong to the progression, so they moved down
          with it rather than staying in a head that now covers both. */}
      {children}

      <div className="sub-head">
        <h3>Progression</h3>
        <span className="muted small">
          {/* Once there is more than one key area, "read in X" is not true of
              the whole progression and saying it anyway is how the old reading
              went wrong. */}
          {analysis.areas?.length > 1
            ? `read in ${analysis.areas.map((a) => keyName(a.key)).join(' → ')}`
            : `read in ${keyName(musicKey)}`}
          {progression.length === 1 ? ' · one chord' : ` · ${progression.length} chords`}
        </span>
      </div>

      <div className="analysis-body">
        {/* The set key drives the numerals, so when the chords point somewhere
            else that has to be said out loud — otherwise every numeral below is
            quietly measured from the wrong tonic. */}
        {mismatch && (
          <div className="key-mismatch">
            <span>
              These chords read more like <strong>{keyName(detected)}</strong>.
            </span>
            {onUseKey && (
              <button className="btn tiny" onClick={() => onUseKey(detected)}>
                Read in {keyName(detected)}
              </button>
            )}
          </div>
        )}

        {/* The function map. Colour carries the harmonic function, so the shape
            of the phrase — tension gathering and releasing — is visible before
            you read a word of it. */}
        <div className="fn-map" role="list">
          {analysis.chords.map((c, i) => (
            <React.Fragment key={i}>
              {/* Where the music changes key. The marker sits between the two
                  chords rather than on either, because the change belongs to
                  the join — and it replaces the root-motion label there, since
                  a step measured across a key change is not the interesting
                  thing about that join. */}
              {i > 0 && c.startsArea ? (
                <span className="fn-keychange" title={`Modulates to ${c.keyName}`}>
                  <span className="fn-keychange-arrow" aria-hidden="true">→</span>
                  {c.keyName}
                </span>
              ) : i > 0 && (
                <span className="fn-motion" aria-hidden="true">
                  {motions[i]}
                </span>
              )}
              <button
                role="listitem"
                className={`fn-cell fn-${c.fn}${i === focused ? ' on' : ''}${c.diatonic ? '' : ' chromatic'}`}
                onClick={() => onSelect(i)}
                title={`${c.symbol} — ${c.sixFour ? `${c.sixFour}, read as ${c.readAs}` : FN_LABEL[c.fn]}${c.diatonic ? '' : `, chromatic (${c.outside.join(', ')})`}`}
              >
                {/* A cadential 6/4 spells a tonic and works as a dominant, so
                    the cell shows both readings rather than picking one: the
                    literal numeral, and what it is doing underneath. */}
                <span className="fn-roman">{c.roman}</span>
                <span className="fn-sym">{c.symbol}</span>
                {c.readAs && <span className="fn-readas">{c.readAs}</span>}
                {cadences[i] && (
                  <span className="fn-cadence" title={cadences[i].label}>
                    {cadences[i].label.replace(/ cadence$/, '')}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="fn-legend">
          {['T', 'PD', 'D'].map((f) => (
            <span key={f} className={`fn-key fn-${f}`}>{FN_LABEL[f]}</span>
          ))}
          <span className="fn-key chromatic">chromatic</span>
        </div>

        {analysis.observations.length > 0 && (
          <ul className="observations">
            {analysis.observations.map((o, i) => (
              <li key={i} className={`obs obs-${o.kind}`}>{o.text}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
