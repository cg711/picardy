import React from 'react'
import { DURATIONS, TIME_SIGNATURES } from '../theory/rhythm.js'
import { STYLES } from '../audio/styles.js'

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
  onLoop,
  disabled,
  playLabel = '▶ Play progression',
  // Metre and the new-chord length both set *rhythm*, and the lyric lane no
  // longer has anything to do with rhythm — so on that tab they are noise.
  hideChordDefaults = false,
}) {
  return (
    <div className="transport">
      <button className="btn primary play" onClick={playing ? onStop : onPlay} disabled={disabled}>
        {playing ? '■ Stop' : playLabel}
      </button>
      <label className="ctl">
        <span className="lbl">Tempo</span>
        <input type="range" min="40" max="200" value={bpm} onChange={(e) => onBpm(+e.target.value)} />
        <span className="val">{bpm}</span>
      </label>
      <label className="ctl" hidden={hideChordDefaults}>
        <span className="lbl">Metre</span>
        <select value={timeSignature} onChange={(e) => onTimeSignature(e.target.value)}>
          {TIME_SIGNATURES.map((t) => (
            <option key={t.id} value={t.id}>{t.id}</option>
          ))}
        </select>
      </label>
      <label className="ctl" hidden={hideChordDefaults} title="Length given to each chord you add from here on">
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
          <option value="piano">Piano</option>
          <option value="guitar">Guitar</option>
          <option value="pad">Pad</option>
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
      <label className="check" title="Repeat until stopped">
        <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} />
        loop
      </label>
    </div>
  )
}
