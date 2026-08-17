import React, { useState } from 'react'
import { SEGMENT_NAMES, segmentHue, segmentBeats, songBeats, formatDuration } from '../lib/song.js'
import { describeLength } from '../theory/rhythm.js'

const chip = (hue) => ({
  background: `hsl(${hue} 55% 15%)`,
  borderColor: `hsl(${hue} 50% 32%)`,
  color: `hsl(${hue} 80% 76%)`,
})

/**
 * Saved segments plus the song they are arranged into. Segments are the
 * library; the song is an ordered playlist of references to them.
 */
export default function Arrangement({
  segments,
  song,
  bpm,
  canSave,
  playingSongIndex,
  onSave,
  onLoad,
  onRename,
  onDeleteSegment,
  onAddToSong,
  onSetRepeats,
  onMoveEntry,
  onRemoveEntry,
  onClearSong,
  onPlaySong,
  onStopSong,
  playingSong,
  onExport,
  onExportMidi,
}) {
  const [name, setName] = useState('Verse')
  const [renaming, setRenaming] = useState(null)
  const [draftName, setDraftName] = useState('')

  const byId = new Map(segments.map((s) => [s.id, s]))
  const totalBeats = songBeats(song, segments)

  return (
    <div className="arrangement">
      <div className="save-row">
        <select value={name} onChange={(e) => setName(e.target.value)} aria-label="Section type">
          {SEGMENT_NAMES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button className="btn primary" onClick={() => onSave(name)} disabled={!canSave}>
          Save as section
        </button>
        <span className="muted small">
          {canSave ? 'Snapshots the chords, key and metre above' : 'Add some chords first'}
        </span>
      </div>

      {segments.length > 0 && (
        <>
          <div className="sub-head">
            <span className="lbl">Sections</span>
            <span className="muted small">click to load into the editor</span>
          </div>
          <ul className="segment-list">
            {segments.map((s) => (
              <li key={s.id} style={chip(segmentHue(s.name))}>
                {renaming === s.id ? (
                  <input
                    className="rename"
                    value={draftName}
                    autoFocus
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => {
                      onRename(s.id, draftName.trim() || s.name)
                      setRenaming(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <button className="seg-name" onClick={() => onLoad(s.id)} title="Load into the editor">
                    {s.name}
                  </button>
                )}
                <span className="seg-meta">
                  {s.key} · {s.chords.length} chord{s.chords.length === 1 ? '' : 's'} ·{' '}
                  {describeLength(s.durations, s.timeSignature)}
                </span>
                <div className="seg-actions">
                  <button onClick={() => onAddToSong(s.id)} title="Append to the song">+ song</button>
                  <button
                    onClick={() => {
                      setRenaming(s.id)
                      setDraftName(s.name)
                    }}
                    title="Rename"
                  >
                    ✎
                  </button>
                  <button className="danger" onClick={() => onDeleteSegment(s.id)} title="Delete section">×</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="sub-head">
        <span className="lbl">Song</span>
        {song.length > 0 && (
          <span className="muted small">
            {song.reduce((n, e) => n + Math.max(1, e.repeats ?? 1), 0)} sections ·{' '}
            {formatDuration(totalBeats, bpm)} at {bpm} bpm
          </span>
        )}
      </div>

      {song.length === 0 ? (
        <p className="muted pad-sm">
          {segments.length
            ? 'Add sections to the song with “+ song”, then play the whole thing.'
            : 'Save a section above to start building a song.'}
        </p>
      ) : (
        <>
          <ol className="song-list">
            {song.map((entry, i) => {
              const s = byId.get(entry.segmentId)
              if (!s) return null
              return (
                <li
                  key={`${entry.segmentId}-${i}`}
                  className={i === playingSongIndex ? 'playing' : ''}
                  style={chip(segmentHue(s.name))}
                >
                  <span className="song-pos">{i + 1}</span>
                  <span className="song-name">{s.name}</span>
                  <label className="song-repeats" title="Repeat count">
                    ×
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={entry.repeats ?? 1}
                      onChange={(e) => onSetRepeats(i, Math.max(1, Math.min(16, +e.target.value || 1)))}
                    />
                  </label>
                  <div className="seg-actions">
                    <button onClick={() => onMoveEntry(i, -1)} disabled={i === 0} title="Move up">↑</button>
                    <button onClick={() => onMoveEntry(i, 1)} disabled={i === song.length - 1} title="Move down">↓</button>
                    <button className="danger" onClick={() => onRemoveEntry(i)} title="Remove">×</button>
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="song-actions">
            <button className="btn primary" onClick={playingSong ? onStopSong : onPlaySong}>
              {playingSong ? '■ Stop song' : '▶ Play song'}
            </button>
            <button className="btn" onClick={onExport}>Export PDF chart</button>
            <button className="btn" onClick={onExportMidi} title="A .mid file you can drop into a DAW">Export MIDI</button>
            <button className="btn ghost" onClick={onClearSong}>Clear song</button>
          </div>
        </>
      )}
    </div>
  )
}

export { segmentBeats }
