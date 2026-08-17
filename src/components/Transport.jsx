import React from 'react'
import { DURATIONS, TIME_SIGNATURES } from '../theory/rhythm.js'
import { PATTERNS } from '../audio/synth.js'

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
      <label className="ctl">
        <span className="lbl">Metre</span>
        <select value={timeSignature} onChange={(e) => onTimeSignature(e.target.value)}>
          {TIME_SIGNATURES.map((t) => (
            <option key={t.id} value={t.id}>{t.id}</option>
          ))}
        </select>
      </label>
      <label className="ctl" title="Length given to each chord you add from here on">
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
        <span className="lbl">Feel</span>
        <select value={pattern} onChange={(e) => onPattern(e.target.value)}>
          {Object.entries(PATTERNS).map(([id, p]) => (
            <option key={id} value={id}>{p.label}</option>
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
