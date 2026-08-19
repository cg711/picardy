import React, { useState } from 'react'
import {
  SEGMENT_NAMES, SEGMENT_HUES, segmentHue, segmentBeats, songBeats, formatDuration, chordFlow,
} from '../lib/song.js'
import { describeLength } from '../theory/rhythm.js'

const chip = (hue) => ({
  background: `hsl(${hue} 55% 15%)`,
  borderColor: `hsl(${hue} 50% 32%)`,
  color: `hsl(${hue} 80% 76%)`,
})

/**
 * Saving the current progression as a section, on its own.
 *
 * Split out of the panel below it because it acts on the progression rather than
 * on the library — so it stays visible whichever editor tab you are on, instead
 * of hiding behind the one that lists what you already saved.
 */
export function SaveSectionRow({ canSave, onSave, savedNote }) {
  // Free text with the usual names as suggestions, rather than a fixed list:
  // naming a part "Chorus 2 (half-time)" is a normal thing to want, and the
  // datalist keeps the common cases one keystroke away.
  const [name, setName] = useState('Verse')

  const save = () => {
    if (!canSave) return
    onSave(name)
  }

  return (
    <div className="save-row">
      <input
        type="text"
        className="section-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save() }}
        list="section-name-options"
        aria-label="Section name"
        placeholder="Section name"
      />
      <datalist id="section-name-options">
        {SEGMENT_NAMES.map((n) => <option key={n} value={n} />)}
      </datalist>
      <button className="btn primary" onClick={save} disabled={!canSave}>
        Save progression as section
      </button>
      {savedNote ? (
        <span className="saved-note" role="status">✓ Saved “{savedNote}”</span>
      ) : (
        <span className="muted small">
          {canSave ? 'Snapshots the chords, key and metre' : 'Add some chords first'}
        </span>
      )}
    </div>
  )
}

/** The colour swatches, revealed from a chip. */
function HuePicker({ current, onPick, onClose }) {
  return (
    <div className="hue-picker" role="menu">
      {SEGMENT_HUES.map((h) => (
        <button
          key={h}
          role="menuitem"
          className={`hue-dot${h === current ? ' on' : ''}`}
          style={{ background: `hsl(${h} 60% 52%)` }}
          aria-label={`Colour ${h}`}
          onClick={() => { onPick(h); onClose() }}
        />
      ))}
    </div>
  )
}

/**
 * The song, and the library it draws from.
 *
 * The song is a strip of chips in the same shape as the chord strip — same card
 * footprint, same insert-at-the-end card, same sidebar behind it — because it is
 * the same act one level up: arranging things in a row, in order.
 */
export default function Arrangement({
  segments,
  song,
  bpm,
  playingSongIndex,
  onLoad,
  onRename,
  onDeleteSegment,
  onSetRepeats,
  onMoveEntry,
  onRemoveEntry,
  onClearSong,
  onPlaySong,
  onStopSong,
  onOpenAddSection,
  onSetHue,
  playingSong,
  onExport,
  onExportMidi,
}) {
  const [renaming, setRenaming] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [picking, setPicking] = useState(null)

  const byId = new Map(segments.map((s) => [s.id, s]))
  const totalBeats = songBeats(song, segments)

  if (!segments.length && !song.length) {
    return (
      <div className="arrangement">
        <p className="muted pad-sm">
          Nothing saved yet. Use <strong>Save progression as section</strong> below to snapshot the
          current progression, then arrange those sections into a song here.
        </p>
      </div>
    )
  }

  return (
    <div className="arrangement">
      <div className="sub-head">
        <h3>Song</h3>
        {song.length > 0 && (
          <span className="muted small">
            {song.reduce((n, e) => n + Math.max(1, e.repeats ?? 1), 0)} sections ·{' '}
            {formatDuration(totalBeats, bpm)} at {bpm} bpm
          </span>
        )}
      </div>

      <div className="song-strip">
        {song.map((entry, i) => {
          const s = byId.get(entry.segmentId)
          if (!s) return null
          const hue = segmentHue(s)
          return (
            <div
              key={`${entry.segmentId}-${i}`}
              className={`song-chip${i === playingSongIndex ? ' playing' : ''}`}
              style={chip(hue)}
            >
              <span className="song-pos">{i + 1}</span>
              <div className="song-chip-top">
                <span className="song-name">{s.name}</span>
                <button className="chip-x" title="Remove from song" onClick={() => onRemoveEntry(i)}>×</button>
              </div>
              {/* What the section actually is, so a chip is recognisable without
                  loading it. */}
              <div className="song-flow" title={s.chords.join(' – ')}>{chordFlow(s)}</div>
              <div className="song-chip-meta">
                {s.key} · {describeLength(s.durations, s.timeSignature)}
              </div>
              <div className="song-chip-controls">
                <button title="Move earlier" onClick={() => onMoveEntry(i, -1)} disabled={i === 0}>‹</button>
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
                <button title="Move later" onClick={() => onMoveEntry(i, 1)} disabled={i === song.length - 1}>›</button>
              </div>
            </div>
          )
        })}

        <button className="add-card" onClick={onOpenAddSection} title="Add a section to the song">
          <span className="add-card-plus" aria-hidden="true">+</span>
          <span className="add-card-label">Add section</span>
        </button>
      </div>

      {song.length > 0 && (
        <div className="song-actions">
          <button className="btn primary" onClick={playingSong ? onStopSong : onPlaySong}>
            {playingSong ? '■ Stop song' : '▶ Play song'}
          </button>
          <button className="btn" onClick={onExport}>Export PDF chart</button>
          <button className="btn" onClick={onExportMidi} title="A .mid file you can drop into a DAW">Export MIDI</button>
          <button className="btn ghost" onClick={onClearSong}>Clear song</button>
        </div>
      )}

      {segments.length > 0 && (
        <>
          <div className="sub-head">
            <h3>Sections</h3>
            <span className="muted small">click a name to load it into the editor</span>
          </div>
          <ul className="segment-list">
            {segments.map((s) => {
              const hue = segmentHue(s)
              return (
                <li key={s.id} style={chip(hue)}>
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
                  <span className="seg-meta">{chordFlow(s, 3) || 'empty'}</span>
                  <div className="seg-actions">
                    <div className="hue-wrap">
                      <button
                        className="hue-swatch"
                        style={{ background: `hsl(${hue} 60% 52%)` }}
                        title="Colour"
                        aria-haspopup="menu"
                        aria-expanded={picking === s.id}
                        onClick={() => setPicking(picking === s.id ? null : s.id)}
                      />
                      {picking === s.id && (
                        <HuePicker current={hue} onPick={(h) => onSetHue(s.id, h)} onClose={() => setPicking(null)} />
                      )}
                    </div>
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
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

export { segmentBeats }
