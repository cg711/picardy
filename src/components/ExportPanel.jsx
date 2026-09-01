import React from 'react'
import { chordSymbol } from '../theory/chords.js'
import { keyName } from '../theory/keys.js'
import { readSegment, segmentBeats, songBeats, formatDuration, chordFlow, segmentHue } from '../lib/song.js'
import { timeSignatureOf } from '../theory/rhythm.js'

/**
 * Everything that leaves the app, in one place.
 *
 * The three exports used to be scattered — a link in the top bar, two buttons
 * under the arrangement — and all three could only ever act on the whole song.
 * Gathering them here makes the missing option obvious: a row per thing you
 * might want to take away, and the same three actions on each of them. A backing
 * track of just the chorus is the one people actually ask for.
 */
export default function ExportPanel({
  song,
  segments,
  songTitle,
  onSongTitle,
  progression,
  timeSignature,
  musicKey,
  bpm,
  includeMelody,
  onIncludeMelody,
  hasMelody,
  backingHrefFor,
  onExportPdf,
  onExportMidi,
}) {
  const byId = new Map(segments.map((s) => [s.id, s]))

  // Sections in the order they first appear. A section used three times is one
  // thing you can export, not three — the file would be identical.
  const used = []
  const seen = new Set()
  for (const entry of song) {
    const segment = byId.get(entry.segmentId)
    if (!segment || seen.has(segment.id)) continue
    seen.add(segment.id)
    used.push(segment)
  }

  const hasSong = song.length > 0
  const totalBeats = hasSong ? songBeats(song, segments) : 0

  const Row = ({ scope, title, meta, flow, hue, wide }) => (
    <div className={`list-row${wide ? ' whole' : ''}`}>
      <div className="row-what">
        <strong style={hue != null ? { color: `hsl(${hue} 70% 68%)` } : undefined}>{title}</strong>
        <span className="row-meta">{meta}</span>
        {flow && <span className="row-flow">{flow}</span>}
      </div>
      <div className="row-actions">
        {/* A real load, not an in-app link: the player reads the whole track out
            of the hash once, on mount. */}
        <a className="btn ghost tiny" href={backingHrefFor(scope)}>Backing track</a>
        <button className="btn ghost tiny" onClick={() => onExportPdf(scope)}>PDF chart</button>
        <button className="btn ghost tiny" onClick={() => onExportMidi(scope)}>MIDI</button>
      </div>
    </div>
  )

  return (
    <div className="export-panel">
      <label className="field ex-title">
        <span className="lbl">Title</span>
        <input
          value={songTitle}
          onChange={(e) => onSongTitle(e.target.value)}
          placeholder="Untitled"
        />
      </label>

      {hasSong ? (
        <>
          <Row
            wide
            scope={{ kind: 'song' }}
            title={songTitle || 'Untitled'}
            meta={`${song.length} section${song.length === 1 ? '' : 's'} · ${Math.ceil(totalBeats / timeSignatureOf(timeSignature).beatsPerBar)} bars · ${formatDuration(totalBeats, bpm)}`}
          />

          <div className="sub-head">
            <h3>Sections</h3>
            <span className="muted small">take any one of them on its own</span>
          </div>

          {used.map((segment) => {
            const live = readSegment(segment)
            const beats = segmentBeats(segment)
            return (
              <Row
                key={segment.id}
                scope={{ kind: 'section', id: segment.id }}
                title={segment.name}
                hue={segmentHue(segment)}
                meta={`${live.key ? keyName(live.key) : ''} · ${Math.ceil(beats / timeSignatureOf(live.timeSignature).beatsPerBar)} bars · ${formatDuration(beats, bpm)}`}
                flow={chordFlow(segment)}
              />
            )
          })}
        </>
      ) : progression.length ? (
        <Row
          wide
          scope={{ kind: 'progression' }}
          title={songTitle || 'Current progression'}
          meta={`${musicKey ? keyName(musicKey) : ''} · ${progression.length} chord${progression.length === 1 ? '' : 's'}`}
          flow={progression.slice(0, 4).map(chordSymbol).join(' – ')}
        />
      ) : (
        <p className="empty-note">
          Nothing to export yet. Write a progression on the Chords tab, or build an
          arrangement on Song structure, and it will appear here.
        </p>
      )}

      {hasMelody && (
        <label className="check ex-melody" title="Carry the melody into the PDF chart and the MIDI file">
          <input
            type="checkbox"
            checked={includeMelody}
            onChange={(e) => onIncludeMelody(e.target.checked)}
          />
          <span>Include the melody in the chart and the MIDI</span>
        </label>
      )}
    </div>
  )
}
