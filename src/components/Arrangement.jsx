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
  onSetRepeats,
  onMoveEntry,
  onReorder,
  onRemoveEntry,
  onClearSong,
  onPlaySong,
  onStopSong,
  onOpenAddSection,
  onSetHue,
  playingSong,
}) {
  const [renaming, setRenaming] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [picking, setPicking] = useState(null)
  // Which row is being dragged, and which one the pointer is currently over.
  const [dragging, setDragging] = useState(null)
  const [dropAt, setDropAt] = useState(null)

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

      <div className="song-rows">
        {song.map((entry, i) => {
          const s = byId.get(entry.segmentId)
          if (!s) return null
          const hue = segmentHue(s)
          return (
            <div
              key={`${entry.segmentId}-${i}`}
              className={`list-row song-row${i === playingSongIndex ? ' playing' : ''}${
                dragging === i ? ' dragging' : ''
              }${dropAt === i && dragging !== null && dragging !== i
                ? (dragging < i ? ' drop-after' : ' drop-before') : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDropAt(i) }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging !== null && dragging !== i) onReorder(dragging, i)
                setDragging(null)
                setDropAt(null)
              }}
            >
              {/* Only the handle starts a drag, so the repeat field and the
                  buttons in the row still behave like controls. */}
              <button
                className="drag-handle"
                draggable
                aria-label={`Reorder ${s.name}`}
                title="Drag to reorder"
                onDragStart={(e) => {
                  setDragging(i)
                  e.dataTransfer.effectAllowed = 'move'
                  // Firefox will not start a drag without data on the transfer.
                  e.dataTransfer.setData('text/plain', String(i))
                }}
                onDragEnd={() => { setDragging(null); setDropAt(null) }}
              >
                ⠿
              </button>
              <span className="song-pos">{i + 1}</span>

              <div className="row-what">
                <strong style={{ color: `hsl(${hue} 70% 68%)` }}>{s.name}</strong>
                <span className="row-meta">{s.key} · {describeLength(s.durations, s.timeSignature)}</span>
                <span className="row-flow" title={s.chords.join(' – ')}>{chordFlow(s)}</span>
              </div>

              <div className="row-actions">
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
                {/* Kept alongside the handle: dragging is not available on touch,
                    and these are also the only way through this list by keyboard. */}
                <button className="btn ghost tiny" title="Move earlier" onClick={() => onMoveEntry(i, -1)} disabled={i === 0}>‹</button>
                <button className="btn ghost tiny" title="Move later" onClick={() => onMoveEntry(i, 1)} disabled={i === song.length - 1}>›</button>
                <button className="btn ghost tiny" title="Insert a section before this one" onClick={() => onOpenAddSection(i)}>+</button>
                <button className="btn ghost tiny" title="Remove from song" onClick={() => onRemoveEntry(i)}>×</button>
              </div>
            </div>
          )
        })}

        <button
          className="add-row"
          onClick={() => onOpenAddSection(song.length)}
          title="Add a section to the end of the song"
        >
          <span className="add-card-plus" aria-hidden="true">+</span>
          <span>Add section</span>
        </button>
      </div>

      {song.length > 0 && (
        <div className="song-actions">
          <button className="btn primary" onClick={playingSong ? onStopSong : onPlaySong}>
            {playingSong ? '■ Stop song' : '▶ Play song'}
          </button>
          <button className="btn ghost" onClick={onClearSong}>Clear song</button>
          {/* Exporting used to live here. It is a tab of its own now, because
              every export could only ever act on the whole song from this row —
              and a backing track of just the chorus is what people ask for. */}
        </div>
      )}

      {segments.length > 0 && (
        <>
          <div className="sub-head">
            <h3>Sections</h3>
            <span className="muted small">✎ opens a section for editing · click its name to rename</span>
          </div>
          {/* The same row as the song above, minus the position and the repeat
              count — the library holds sections, the song holds placements of
              them. Sharing the shape is the point: it is one object seen twice. */}
          <div className="song-rows">
            {segments.map((s) => {
              const hue = segmentHue(s)
              return (
                <div key={s.id} className="list-row song-row">
                  <div className="row-what">
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
                      <button
                        className="seg-name"
                        style={{ color: `hsl(${hue} 70% 68%)` }}
                        onClick={() => { setRenaming(s.id); setDraftName(s.name) }}
                        title="Rename this section"
                      >
                        {s.name}
                      </button>
                    )}
                    <span className="row-meta">{s.key} · {describeLength(s.durations, s.timeSignature)}</span>
                    <span className="row-flow" title={s.chords.join(' – ')}>{chordFlow(s) || 'empty'}</span>
                  </div>

                  {picking === s.id ? (
                    <HuePicker current={hue} onPick={(h) => onSetHue(s.id, h)} onClose={() => setPicking(null)} />
                  ) : (
                    <div className="row-actions">
                      <button
                        className="hue-swatch"
                        style={{ background: `hsl(${hue} 60% 52%)` }}
                        title="Colour"
                        aria-haspopup="menu"
                        aria-expanded={picking === s.id}
                        onClick={() => setPicking(picking === s.id ? null : s.id)}
                      />
                      {/* The pencil edits the section — its chords, lyrics and
                          melody — which is what a pencil on a section should
                          mean. The name is renamed by clicking the name. */}
                      <button
                        className="btn ghost tiny"
                        onClick={() => onLoad(s.id)}
                        title="Edit this section: load its chords, lyrics and melody into the editor"
                      >
                        ✎
                      </button>
                      <button className="btn ghost tiny" onClick={() => onDeleteSegment(s.id)} title="Delete section">×</button>
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
