// Standard MIDI file writer.
//
// Written byte by byte rather than pulling in a library: the format is small,
// and this way the export has no dependency and no surprises. Produces a
// Format 1 file — a conductor track carrying tempo, metre and section markers,
// plus one track of chords — which is what a DAW expects to import.

import { voiceChord } from '../theory/chords.js'
import { toBeats, timeSignatureOf } from '../theory/rhythm.js'
import { flattenSong } from './song.js'

const TICKS_PER_BEAT = 480

/** MIDI variable-length quantity: 7 bits per byte, high bit marks "more". */
function vlq(value) {
  const n = Math.max(0, Math.round(value))
  const bytes = [n & 0x7f]
  let rest = n >> 7
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return bytes
}

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff]
const u32 = (n) => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
const ascii = (s) => [...String(s).replace(/[^\x20-\x7E]/g, '')].map((c) => c.charCodeAt(0))

function chunk(type, data) {
  return [...ascii(type), ...u32(data.length), ...data]
}

function metaEvent(delta, type, payload) {
  return [...vlq(delta), 0xff, type, ...vlq(payload.length), ...payload]
}

const END_OF_TRACK = [0x00, 0xff, 0x2f, 0x00]

/**
 * Build a Format 1 MIDI file.
 *
 * @param events array of { midis, beats, marker? } in playback order
 * @returns Uint8Array
 */
export function buildMidi(events, { bpm = 84, timeSignature = '4/4', trackName = 'Picardy', velocity = 80 } = {}) {
  // --- conductor track -------------------------------------------------------
  const ts = timeSignatureOf(timeSignature)
  const [top, bottom] = timeSignature.split('/').map((n) => parseInt(n, 10))
  const microsPerBeat = Math.round(60000000 / bpm)

  const conductor = [
    ...metaEvent(0, 0x03, ascii(trackName)),
    ...metaEvent(0, 0x51, [(microsPerBeat >> 16) & 0xff, (microsPerBeat >> 8) & 0xff, microsPerBeat & 0xff]),
    // denominator is stored as a power of two: 4 -> 2, 8 -> 3
    ...metaEvent(0, 0x58, [top || 4, Math.round(Math.log2(bottom || 4)), 24, 8]),
  ]

  // Section markers land on the conductor track, so a DAW shows them on the ruler.
  let markerCursor = 0
  let lastMarkerTick = 0
  for (const event of events) {
    const tick = Math.round(markerCursor * TICKS_PER_BEAT)
    if (event.marker) {
      conductor.push(...metaEvent(tick - lastMarkerTick, 0x06, ascii(event.marker)))
      lastMarkerTick = tick
    }
    markerCursor += event.beats ?? 4
  }
  conductor.push(...END_OF_TRACK)

  // --- chord track -----------------------------------------------------------
  // Collect absolute-time note on/off pairs, then sort and delta-encode. Doing
  // it in absolute time first is what keeps overlapping notes correct.
  const absolute = []
  let cursor = 0
  for (const event of events) {
    const startTick = Math.round(cursor * TICKS_PER_BEAT)
    const beats = event.beats ?? 4
    // Leave a small gap so repeated notes retrigger instead of running together.
    const lengthTicks = Math.max(1, Math.round(beats * TICKS_PER_BEAT * 0.96))
    for (const midi of event.midis) {
      if (midi < 0 || midi > 127) continue
      absolute.push({ tick: startTick, type: 'on', midi })
      absolute.push({ tick: startTick + lengthTicks, type: 'off', midi })
    }
    cursor += beats
  }

  // Note-offs before note-ons at the same tick, so a repeat of the same pitch
  // does not silence the note that just started.
  absolute.sort((a, b) => a.tick - b.tick || (a.type === 'off' ? -1 : 1) - (b.type === 'off' ? -1 : 1))

  const track = [...metaEvent(0, 0x03, ascii('Chords'))]
  let last = 0
  for (const event of absolute) {
    track.push(...vlq(event.tick - last))
    track.push(event.type === 'on' ? 0x90 : 0x80, event.midi & 0x7f, event.type === 'on' ? velocity : 0x40)
    last = event.tick
  }
  track.push(...END_OF_TRACK)

  const header = chunk('MThd', [...u16(1), ...u16(2), ...u16(TICKS_PER_BEAT)])
  return new Uint8Array([...header, ...chunk('MTrk', conductor), ...chunk('MTrk', track)])
}

/** Playable events for a whole arrangement, with a marker at each section. */
export function songToEvents(song, segments, { bottom = 48 } = {}) {
  const flat = flattenSong(song, segments)
  let lastLabel = null
  return flat.map((item) => {
    const label = `${item.segmentName}${item.repeat ? ` (${item.repeat + 1})` : ''}`
    const marker = label !== lastLabel || item.indexInSegment === 0 ? label : null
    lastLabel = label
    return {
      midis: voiceChord(item.chord, { inversion: item.inversion, bottom }),
      beats: toBeats(item.durationId),
      marker: item.indexInSegment === 0 ? marker : null,
    }
  })
}

/** Playable events for the progression currently in the editor. */
export function progressionToEvents(progression, inversions, durations, { bottom = 48 } = {}) {
  return progression.map((chord, i) => ({
    midis: voiceChord(chord, { inversion: inversions[i] ?? 0, bottom }),
    beats: toBeats(durations[i]),
  }))
}

export function downloadMidi(bytes, filename) {
  const blob = new Blob([bytes], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.mid') ? filename : `${filename}.mid`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
