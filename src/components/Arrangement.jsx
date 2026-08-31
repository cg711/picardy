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

/**
 * The colour swatches.
 *
 * Laid out inside the chip rather than floating above it: the strip scrolls
 * horizontally, and `overflow-x: auto` forces `overflow-y` to compute to auto as
 * well, so an absolutely positioned dropdown would be clipped by the very
 * container it needs to escape. Growing the chip for a moment costs nothing.
 */
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
  onAddToSong,
  onSetRepeats,
  onMoveEntry,
  onRemoveEntry,
  onClearSong,
  onPlaySong,
  backingHref,
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

      <div className="song-strip prog-strip">
        {song.map((entry, i) => {
          const s = byId.get(entry.segmentId)
          if (!s) return null
          const hue = segmentHue(s)
          return (
            <React.Fragment key={`${entry.segmentId}-${i}`}>
            {/* Same insert slot as the chord strip: a section can go between two
                others rather than only on the end. */}
            <button
              className="insert-slot"
              onClick={() => onOpenAddSection(i)}
              title={`Insert a section before ${s.name}`}
              aria-label={`Insert a section before ${s.name}`}
            >
              <span aria-hidden="true">+</span>
            </button>
            <div
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
            </React.Fragment>
          )
        })}

        <button className="add-card" onClick={() => onOpenAddSection(song.length)} title="Add a section to the end of the song">
          <span className="add-card-plus" aria-hidden="true">+</span>
          <span className="add-card-label">Add section</span>
        </button>
      </div>

      {song.length > 0 && (
        <div className="song-actions">
          <button className="btn primary" onClick={playingSong ? onStopSong : onPlaySong}>
            {playingSong ? '■ Stop song' : '▶ Play song'}
          </button>
          {/* A real load rather than an in-app link: the player reads the whole
              arrangement out of the hash once, on mount. */}
          {backingHref && (
            <a className="btn" href={backingHref} title="Play the whole arrangement with a band behind it">
              Backing track
            </a>
          )}
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
          {/* The same chip as the song strip above, minus the position badge and
              the repeat count — the library holds sections, the song holds
              placements of them. Sharing .song-chip is the point: it is the same
              object seen in two places. */}
          <div className="song-strip section-strip">
            {segments.map((s) => {
              const hue = segmentHue(s)
              return (
                <div key={s.id} className="song-chip section-chip" style={chip(hue)}>
                  <div className="song-chip-top">
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
                      <button className="song-name seg-name" onClick={() => onLoad(s.id)} title="Load into the editor">
                        {s.name}
                      </button>
                    )}
                    <button className="chip-x" onClick={() => onDeleteSegment(s.id)} title="Delete section">×</button>
                  </div>

                  <div className="song-flow" title={s.chords.join(' – ')}>{chordFlow(s) || 'empty'}</div>
                  <div className="song-chip-meta">
                    {s.key} · {describeLength(s.durations, s.timeSignature)}
                  </div>

                  {/* The picker replaces the controls rather than joining them, so the
                      chip keeps its fixed height while you are choosing. */}
                  {picking === s.id ? (
                    <HuePicker current={hue} onPick={(h) => onSetHue(s.id, h)} onClose={() => setPicking(null)} />
                  ) : (
                  <div className="song-chip-controls">
                    <button
                      className="hue-swatch"
                      style={{ background: `hsl(${hue} 60% 52%)` }}
                      title="Colour"
                      aria-haspopup="menu"
                      aria-expanded={picking === s.id}
                      onClick={() => setPicking(picking === s.id ? null : s.id)}
                    />
                    <button
                      onClick={() => {
                        setRenaming(s.id)
                        setDraftName(s.name)
                      }}
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button className="add-to-song" onClick={() => onAddToSong(s.id)} title="Append to the song">
                      + song
                    </button>
                  </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export { segmentBeats }
