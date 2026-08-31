import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chordSymbol, voiceChord, bassOf } from '../theory/chords.js'
import { keyName, romanNumeral } from '../theory/keys.js'
import { pcOf, noteName } from '../theory/notes.js'
import { groupIntoBars, toBeats, timeSignatureOf, DEFAULT_TIME_SIGNATURE } from '../theory/rhythm.js'
import { playProgression, stopPlayback } from '../audio/synth.js'
import { STYLES } from '../audio/styles.js'
import { decodeState, encodeState } from '../lib/share.js'
import { BACKINGS, BACKING_KEYS, buildBacking } from '../lib/backings.js'
import { linkProps } from '../lib/router.js'
import { TOOL_PATH } from '../lib/routes.js'

/**
 * The backing-track player.
 *
 * Deliberately not the studio with a different skin. Everything here serves one
 * job — following along while your hands are busy — so the chart is large, the
 * current bar is unmissable from across a room, and nothing is editable. A track
 * arrives either in the URL or from the shelf of standards below, and either way
 * it ends up as the same thing: chords, a key, and playback settings.
 */
export default function BackingPage() {
  // Held in state rather than re-read from the hash, so picking a preset can
  // swap the track without a reload. The hash is kept in step underneath, which
  // is what makes the link shareable whichever way the track was chosen.
  const [track, setTrack] = useState(() => decodeState(window.location.hash))
  const [presetKey, setPresetKey] = useState('C')

  const [bpm, setBpm] = useState(track?.bpm ?? 100)
  const [style, setStyle] = useState(() =>
    (track?.style && STYLES[track.style]) ? track.style : 'pop')
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

  const progression = track?.progression ?? []
  const inversions = track?.inversions ?? []
  const durations = track?.durations ?? []
  const musicKey = track?.key ?? null
  const timeSignature = track?.timeSignature ?? DEFAULT_TIME_SIGNATURE
  const ts = timeSignatureOf(timeSignature)
  const sections = track?.sections ?? []

  useEffect(() => () => { stopPlayback(); clearTimeout(copyTimer.current) }, [])

  /** Section name for each chord slot, so the chart and the readout agree. */
  const sectionAt = useMemo(() => {
    const names = new Array(progression.length).fill(null)
    for (let i = 0; i < sections.length; i++) {
      const end = sections[i + 1]?.at ?? progression.length
      for (let j = sections[i].at; j < end; j++) names[j] = sections[i].name
    }
    return names
  }, [sections, progression.length])

  /**
   * The key each chord should be read in.
   *
   * An arrangement can change key between sections, and a numeral measured from
   * the wrong tonic is worse than no numeral — a B♭maj7 is Imaj7 in the chorus
   * and ♭VIImaj7 back in the verse, and only one of those is what you are
   * looking at.
   */
  const keyAt = useMemo(() => {
    const keys = new Array(progression.length).fill(musicKey)
    for (let i = 0; i < sections.length; i++) {
      if (!sections[i].key) continue
      const end = sections[i + 1]?.at ?? progression.length
      for (let j = sections[i].at; j < end; j++) keys[j] = sections[i].key
    }
    return keys
  }, [sections, progression.length, musicKey])

  /**
   * Where each section starts, in beats — the band puts a fill in the bar before
   * each one, so an arrangement announces its own changes.
   */
  const sectionStartBeats = useMemo(() => {
    if (!sections.length) return []
    const starts = new Set(sections.map((sec) => sec.at))
    const out = []
    let beat = 0
    progression.forEach((_, i) => {
      if (starts.has(i)) out.push(beat)
      beat += toBeats(durations[i])
    })
    return out
  }, [sections, progression, durations])

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
        sectionStartBeats,
        settings: () => live.current,
        onStep: setIndex,
        onDone: () => { setPlaying(false); setIndex(-1) },
      },
    )
  }, [progression, inversions, durations, bpm, style, loop, countIn, ts, sectionStartBeats])

  const hash = useMemo(() => {
    if (!progression.length || !musicKey) return null
    return encodeState({
      key: musicKey,
      progression,
      inversions,
      durations,
      timeSignature,
      bpm,
      style,
      sections: sections.map((sec) => ({
        ...sec,
        key: sec.key ? `${noteName(sec.key.tonic)}${sec.key.mode === 'minor' ? 'm' : ''}` : null,
      })),
    })
  }, [progression, inversions, durations, musicKey, timeSignature, bpm, style, sections])

  const shareUrl = hash ? `${window.location.origin}${window.location.pathname}#${hash}` : null

  // Keep the address bar in step with whatever is loaded, so the link is always
  // the track you are hearing — including after picking one off the shelf.
  useEffect(() => {
    if (hash) window.history.replaceState(null, '', `#${hash}`)
  }, [hash])

  const choose = (preset) => {
    stop()
    const built = buildBacking(preset, presetKey)
    if (!built) return
    setBpm(built.bpm)
    setStyle(built.style)
    setTrack({ ...built, sections: [] })
  }

  const browse = () => {
    stop()
    setTrack(null)
    window.history.replaceState(null, '', window.location.pathname)
  }

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

  // Space is the transport, as it is in every other player. Deliberately not
  // Enter: Enter is what activates the link that brought you here, and that
  // keystroke can land on this page and start the track before you have asked
  // for it. Ignored while a control has focus so it still types and toggles.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== ' ') return
      const el = event.target
      if (el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) return
      event.preventDefault()
      playing ? stop() : start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, start, stop])

  if (!progression.length) {
    return (
      <main className="backing">
        <header className="bk-intro">
          <h1>Backing tracks</h1>
          <p>
            Pick something to play over. Every one is built from scale degrees, so
            it comes out spelled correctly in whichever key you choose — or write
            your own in the <a {...linkProps(TOOL_PATH)}>studio</a> and open it here.
          </p>
          <label className="ctl bk-keypick">
            <span className="lbl">Key</span>
            <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
              {BACKING_KEYS.map((k) => (
                <option key={k} value={k}>{k.replace('b', '♭')}</option>
              ))}
            </select>
          </label>
        </header>

        <div className="bk-shelf">
          {BACKINGS.map((preset) => {
            const built = buildBacking(preset, presetKey)
            // Built in the chosen key, so a card shows the chords you will
            // actually get rather than a fixed example in someone else's key.
            const shown = built.progression
              .filter((c, i, all) => i === 0 || chordSymbol(all[i - 1]) !== chordSymbol(c))
            return (
              <button key={preset.id} className="bk-preset" onClick={() => choose(preset)}>
                <h2>{preset.name}</h2>
                <p>{preset.blurb}</p>
                <span className="bk-preset-chords">
                  {shown.slice(0, 6).map(chordSymbol).join(' · ')}
                  {shown.length > 6 ? ' …' : ''}
                </span>
                <span className="bk-preset-meta">
                  {keyName(built.key)} · {STYLES[preset.style].label.replace('Band — ', '')} · {preset.bpm} bpm
                </span>
              </button>
            )
          })}
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
  const focus = index >= 0 ? index : 0

  return (
    <main className="backing">
      <div className="backing-head">
        <div className="bk-meta">
          {musicKey && <span className="bk-key">{keyName(musicKey)}</span>}
          <span>{timeSignature}</span>
          <span>{bars.length} bar{bars.length === 1 ? '' : 's'}</span>
          {sections.length > 0 && <span>{sections.length} section{sections.length === 1 ? '' : 's'}</span>}
        </div>
        <div className="bk-links">
          <button className="btn ghost tiny" onClick={browse}>Browse tracks</button>
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
          <span className="bk-label">
            {playing ? 'Now' : 'Starts on'}
            {sectionAt[focus] && <em className="bk-section">{sectionAt[focus]}</em>}
          </span>
          <strong>{chordSymbol(now ?? progression[0])}</strong>
          {keyAt[focus] && (
            <span className="bk-roman">
              {romanNumeral(now ?? progression[0], keyAt[focus], inversions[focus] ?? 0)}
            </span>
          )}
        </div>
        <div className="bk-next">
          <span className="bk-label">Next</span>
          <strong>{chordSymbol(next)}</strong>
        </div>
      </div>

      <div className="bk-chart">
        {bars.map((bar, b) => {
          // A heading wherever a section begins. Matched on the bar's first cell
          // rather than on any cell in it, so a section that starts mid-bar is
          // labelled once, at the bar you actually look at.
          const opens = sections.find((sec) => sec.at === bar[0].slot && !bar[0].tiedFromPrevious)
          return (
            <React.Fragment key={b}>
              {opens && <h2 className="bk-section-head">{opens.name}</h2>}
              <div className={`bk-bar${bar.some((c) => c.slot === index) ? ' on' : ''}`}>
                <span className="bk-barnum">{b + 1}</span>
                <div className="bk-barchords">
                  {bar.map((cell, c) => (
                    <span
                      key={c}
                      className={`bk-cell${cell.slot === index ? ' on' : ''}${cell.tiedFromPrevious ? ' tied' : ''}`}
                    >
                      {/* Read in the section's own key, not the track's. */}
                      {!cell.tiedFromPrevious && keyAt[cell.slot] && (
                        <em className="bk-cell-roman">
                          {romanNumeral(cell.chord, keyAt[cell.slot], inversions[cell.slot] ?? 0)}
                        </em>
                      )}
                      <b>{cell.tiedFromPrevious ? '–' : chordSymbol(cell.chord)}</b>
                    </span>
                  ))}
                </div>
              </div>
            </React.Fragment>
          )
        })}
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
