import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chordSymbol, voiceChord, bassOf } from '../theory/chords.js'
import { keyName, romanNumeral } from '../theory/keys.js'
import { pcOf } from '../theory/notes.js'
import { groupIntoBars, toBeats, timeSignatureOf, DEFAULT_TIME_SIGNATURE } from '../theory/rhythm.js'
import { playProgression, stopPlayback } from '../audio/synth.js'
import { STYLES } from '../audio/styles.js'
import { decodeState, encodeState } from '../lib/share.js'
import { linkProps } from '../lib/router.js'
import { TOOL_PATH } from '../lib/routes.js'

/**
 * The backing-track player.
 *
 * Deliberately not the studio with a different skin. Everything here serves one
 * job — following along while your hands are busy — so the chart is large, the
 * current bar is unmissable from across a room, and nothing is editable. The
 * whole track arrives in the URL, which is also how it is saved and shared.
 */
export default function BackingPage() {
  // Read once: the hash is the document here, not a live binding, and re-reading
  // it while the transport is running would restart the track under the player.
  const initial = useMemo(() => decodeState(window.location.hash), [])

  const [bpm, setBpm] = useState(initial?.bpm ?? 100)
  const [style, setStyle] = useState(() =>
    (initial?.style && STYLES[initial.style]) ? initial.style : 'pop')
  const [loop, setLoop] = useState(true)
  const [countIn, setCountIn] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(-1)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)

  // The scheduler asks for these at the top of every pass, so nudging the tempo
  // mid-track takes effect next time round rather than being ignored.
  const live = useRef({ bpm, pattern: style })
  live.current = { bpm, pattern: style }

  const progression = initial?.progression ?? []
  const inversions = initial?.inversions ?? []
  const durations = initial?.durations ?? []
  const musicKey = initial?.key ?? null
  const timeSignature = initial?.timeSignature ?? DEFAULT_TIME_SIGNATURE
  const ts = timeSignatureOf(timeSignature)

  useEffect(() => () => { stopPlayback(); clearTimeout(copyTimer.current) }, [])

  // Bars, exactly as the chart engine lays them out for the PDF — so what you
  // read here and what you print cannot disagree.
  const bars = useMemo(() => {
    if (!progression.length) return []
    return groupIntoBars(
      progression.map((chord, i) => ({ chord, durationId: durations[i], slot: i })),
      timeSignature,
    )
  }, [progression, durations, timeSignature])

  const stop = useCallback(() => {
    stopPlayback()
    setPlaying(false)
    setIndex(-1)
  }, [])

  const start = useCallback(() => {
    if (!progression.length) return
    setPlaying(true)
    setIndex(-1)
    playProgression(
      progression.map((chord, i) => ({
        midis: voiceChord(chord, { inversion: inversions[i] ?? 0, bottom: 48 }),
        beats: toBeats(durations[i]),
        bassPc: pcOf(bassOf(chord, inversions[i] ?? 0).note),
      })),
      {
        bpm,
        pattern: style,
        loop,
        countIn: countIn ? ts.beatsPerBar : 0,
        beatsPerBar: ts.beatsPerBar,
        timeSignature: ts,
        settings: () => live.current,
        onStep: setIndex,
        onDone: () => { setPlaying(false); setIndex(-1) },
      },
    )
  }, [progression, inversions, durations, bpm, style, loop, countIn, ts])

  const hash = useMemo(() => {
    if (!progression.length || !musicKey) return null
    return encodeState({
      key: musicKey, progression, inversions, durations, timeSignature, bpm, style,
    })
  }, [progression, inversions, durations, musicKey, timeSignature, bpm, style])

  const shareUrl = hash ? `${window.location.origin}${window.location.pathname}#${hash}` : null

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', shareUrl)
    }
  }

  // Space is the transport, as it is in every other player. Ignored while a
  // control has focus so it still types and toggles normally.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      const el = event.target
      if (el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return
      event.preventDefault()
      playing ? stop() : start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, start, stop])

  if (!progression.length) {
    return (
      <main className="backing">
        <div className="backing-empty">
          <h1>Backing tracks</h1>
          <p>
            This link has no chords in it. Write a progression in the studio, then
            use <strong>Open as backing track</strong> to bring it here — the whole
            track travels in the URL, so the link is the save button.
          </p>
          <a className="btn primary hero-cta" {...linkProps(TOOL_PATH)}>Open the studio</a>
        </div>
      </main>
    )
  }

  const now = index >= 0 ? progression[index] : null
  // Idle, "next" is the second chord — showing the first as both what you start
  // on and what comes next is just the same chord twice.
  const next = index >= 0
    ? progression[index + 1] ?? progression[0]
    : progression[1] ?? progression[0]

  return (
    <main className="backing">
      <div className="backing-head">
        <div className="bk-meta">
          {musicKey && <span className="bk-key">{keyName(musicKey)}</span>}
          <span>{timeSignature}</span>
          <span>{bars.length} bar{bars.length === 1 ? '' : 's'}</span>
        </div>
        <div className="bk-links">
          <button className="btn ghost tiny" onClick={copyLink} disabled={!shareUrl}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          {/* A real load rather than an in-app link: the studio reads its state
              from the hash once, on mount. */}
          <a className="btn ghost tiny" href={hash ? `${TOOL_PATH}#${hash}` : TOOL_PATH}>
            Edit in the studio
          </a>
        </div>
      </div>

      {/* The readout: what is sounding, and what is coming. Big enough to read
          from wherever the instrument is, which is the entire point. */}
      <div className={`bk-now${playing ? ' live' : ''}`}>
        <div className="bk-current">
          <span className="bk-label">{playing ? 'Now' : 'Starts on'}</span>
          <strong>{chordSymbol(now ?? progression[0])}</strong>
          {musicKey && (
            <span className="bk-roman">
              {romanNumeral(now ?? progression[0], musicKey, inversions[index >= 0 ? index : 0] ?? 0)}
            </span>
          )}
        </div>
        <div className="bk-next">
          <span className="bk-label">Next</span>
          <strong>{chordSymbol(next)}</strong>
        </div>
      </div>

      <div className="bk-chart">
        {bars.map((bar, b) => (
          <div key={b} className={`bk-bar${bar.some((c) => c.slot === index) ? ' on' : ''}`}>
            <span className="bk-barnum">{b + 1}</span>
            <div className="bk-barchords">
              {bar.map((cell, c) => (
                <span
                  key={c}
                  className={`bk-cell${cell.slot === index ? ' on' : ''}${cell.tiedFromPrevious ? ' tied' : ''}`}
                >
                  {cell.tiedFromPrevious ? '–' : chordSymbol(cell.chord)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bk-transport">
        <button className={`btn ${playing ? 'ghost' : 'primary'} bk-play`} onClick={playing ? stop : start}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>

        <label className="ctl">
          <span className="lbl">Style</span>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            {Object.entries(STYLES).map(([id, s]) => (
              <option key={id} value={id}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="ctl bk-tempo">
          <span className="lbl">Tempo</span>
          <input
            type="range" min="40" max="220" value={bpm}
            onChange={(e) => setBpm(+e.target.value)}
          />
          <output>{bpm}</output>
        </label>

        <label className="check">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          <span>loop</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />
          <span>count-in</span>
        </label>
      </div>

      <p className="bk-hint">
        Tempo and style take effect on the next time round, so you can nudge them
        without losing your place. <kbd>Space</kbd> starts and stops.
      </p>
    </main>
  )
}
