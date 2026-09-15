import React, { useState } from 'react'
import { DURATIONS, TIME_SIGNATURES } from '../theory/rhythm.js'
import { STYLES } from '../audio/styles.js'

const TIMBRES = { piano: 'Piano', guitar: 'Guitar', pad: 'Pad' }

export default function Transport({
  playing,
  onPlay,
  onStop,
  bpm,
  onBpm,
  timeSignature,
  onTimeSignature,
  newChordDuration,
  onNewChordDuration,
  timbre,
  onTimbre,
  volume,
  onVolume,
  pattern,
  onPattern,
  countIn,
  onCountIn,
  loop,
  trainer = false,
  onTrainer,
  onLoop,
  disabled,
  playLabel = '▶ Play progression',
  // Metre and the new-chord length both set *rhythm*, but they are not needed in
  // the same places. The lyric lane has nothing to do with rhythm at all, while
  // the melody roll draws its bar lines from the metre and so still wants it —
  // it just has no chords to give a default length to.
  hideMetre = false,
  hideNewChord = false,
}) {
  // Play, tempo and loop are what you reach for while writing; the rest is set
  // once and left. Folding those away is most of what makes the studio's
  // resting state quiet — and the summary on the toggle still says what they
  // are set to, so nothing is hidden that you would need to open it to learn.
  const [open, setOpen] = useState(false)
  const summary = [
    hideMetre ? null : timeSignature,
    TIMBRES[timbre] ?? timbre,
    STYLES[pattern]?.label,
  ].filter(Boolean).join(' · ')

  return (
    <div className="transport">
      <div className="transport-main">
        <button className="btn primary play" onClick={playing ? onStop : onPlay} disabled={disabled}>
          {playing ? '■ Stop' : playLabel}
        </button>
        <label className="ctl">
          <span className="lbl">Tempo</span>
          <input type="range" min="40" max="200" value={bpm} onChange={(e) => onBpm(+e.target.value)} />
          <span className="val">{bpm}</span>
        </label>
        <label className="check" title="Repeat until stopped">
          <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} />
          loop
        </label>
        <button
          type="button"
          className={`btn ghost transport-toggle${open ? ' on' : ''}`}
          aria-expanded={open}
          aria-controls="transport-more"
          onClick={() => setOpen((was) => !was)}
        >
          <span className="transport-toggle-label">Playback</span>
          <span className="transport-summary">{summary}</span>
          <span className="transport-caret" aria-hidden="true">▾</span>
        </button>
      </div>

      <div className="transport-more" id="transport-more" hidden={!open}>
        <label className="ctl" hidden={hideMetre}>
          <span className="lbl">Metre</span>
          <select value={timeSignature} onChange={(e) => onTimeSignature(e.target.value)}>
            {TIME_SIGNATURES.map((t) => (
              <option key={t.id} value={t.id}>{t.id}</option>
            ))}
          </select>
        </label>
        <label className="ctl" hidden={hideNewChord} title="Length given to each chord you add from here on">
          <span className="lbl">New chord</span>
          <select value={String(newChordDuration)} onChange={(e) => onNewChordDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.id} value={String(d.beats)}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="ctl">
          <span className="lbl">Sound</span>
          <select value={timbre} onChange={(e) => onTimbre(e.target.value)}>
            {Object.entries(TIMBRES).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <label className="ctl">
          <span className="lbl">Style</span>
          <select
            value={pattern}
            onChange={(e) => onPattern(e.target.value)}
            title="How the progression is played back — the chords alone, or with a band behind them"
          >
            {Object.entries(STYLES).map(([id, s]) => (
              <option key={id} value={id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="ctl">
          <span className="lbl">Volume</span>
          <input type="range" min="0" max="100" value={volume} onChange={(e) => onVolume(+e.target.value)} />
        </label>
        <label className="check" title="One bar of clicks before playback starts">
          <input type="checkbox" checked={countIn} onChange={(e) => onCountIn(e.target.checked)} />
          count-in
        </label>
        {/* A tempo ramp needs something to come round again, so ticking it
            turns loop on rather than sitting there inert next to an unticked
            box. */}
        <label className="check" title="Loop, and add 5 bpm each time round — the way you actually get a passage up to speed">
          <input
            type="checkbox"
            checked={trainer}
            onChange={(e) => {
              onTrainer(e.target.checked)
              if (e.target.checked && !loop) onLoop(true)
            }}
          />
          speed up
        </label>
      </div>
    </div>
  )
}
