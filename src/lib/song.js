// Segments and song arrangement.
//
// A segment is a named chunk of music — a verse, a chorus — that owns its own
// key and metre, so a song can modulate between sections. A song is an ordered
// list of references to segments, each with a repeat count.

import { parseChord, chordId } from '../theory/chords.js'
import { makeKey } from '../theory/keys.js'
import { noteName } from '../theory/notes.js'
import { DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE, toBeats } from '../theory/rhythm.js'

const SEGMENTS_KEY = 'picardy.segments.v1'
const SONG_KEY = 'picardy.song.v1'

export const SEGMENT_NAMES = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro']

/**
 * Colour per section, so the arrangement is readable at a glance.
 *
 * A stored `hue` wins: the derived colour is only a starting point, and once
 * somebody has deliberately picked one it should survive a rename.
 */
export function segmentHue(segment) {
  if (segment && typeof segment === 'object') {
    if (Number.isFinite(segment.hue)) return segment.hue
    return hueFromName(segment.name ?? '')
  }
  return hueFromName(String(segment ?? ''))
}

function hueFromName(name) {
  const known = SEGMENT_NAMES.indexOf(name.replace(/\s*\d+$/, ''))
  if (known >= 0) return [200, 152, 42, 320, 268, 60, 12][known] ?? 200
  // Stable hue for a custom name.
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

/** The palette offered in the chip's colour picker. */
export const SEGMENT_HUES = [200, 152, 42, 320, 268, 60, 12, 96, 240, 176]

/**
 * A short "C – Am – F" for a chip, so a section is recognisable without opening
 * it. Long sections are elided in the middle: the first chords and the last one
 * are what identify a part, and the middle is what makes it too long to read.
 */
export function chordFlow(segment, max = 4) {
  const chords = segment?.chords ?? []
  if (!chords.length) return ''
  if (chords.length <= max) return chords.join(' – ')
  return `${chords.slice(0, max - 1).join(' – ')} … ${chords[chords.length - 1]}`
}

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Snapshot the editor into a storable segment. Chords are stored as symbols. */
export function makeSegment({ name, key, progression, inversions, durations, timeSignature, shapes, lines, leadIns, lyrics, melody }) {
  return {
    id: uid(),
    name: name || 'Untitled',
    key: `${noteName(key.tonic)}${key.mode === 'minor' ? 'm' : ''}`,
    timeSignature: timeSignature || DEFAULT_TIME_SIGNATURE,
    chords: progression.map(chordId),
    inversions: progression.map((_, i) => inversions[i] ?? 0),
    durations: progression.map((_, i) => toBeats(durations[i])),
    shapes: progression.map((_, i) => shapes?.[i] ?? null),
    // Which lyric line each chord sits over, plus the lines themselves.
    lines: progression.map((_, i) => lines?.[i] ?? 0),
    // The words sung under each chord, and the words before the first chord of
    // each line. Alignment is this association — there is no position to store.
    lyrics: progression.map((_, i) => lyrics?.[i] ?? ''),
    leadIns: [...(leadIns ?? [])],
    // The melody line, in beats from the start of the section. Stored on the
    // section rather than beside it, so it travels into the arrangement, the
    // chart and the MIDI along with the chords it was written against.
    melody: (melody ?? []).map((n) => ({ at: n.at, beats: n.beats, midi: n.midi })),
    at: Date.now(),
  }
}

/** Rehydrate a stored segment into live chord objects and a key. */
export function readSegment(segment) {
  const minor = /m$/.test(segment.key)
  const tonic = minor ? segment.key.slice(0, -1) : segment.key
  const progression = segment.chords.map(parseChord).filter(Boolean)
  return {
    key: makeKey(tonic, minor ? 'minor' : 'major'),
    progression,
    inversions: progression.map((_, i) => segment.inversions?.[i] ?? 0),
    durations: progression.map((_, i) => toBeats(segment.durations?.[i])),
    shapes: progression.map((_, i) => segment.shapes?.[i] ?? null),
    lines: progression.map((_, i) => segment.lines?.[i] ?? 0),
    lyrics: progression.map((_, i) => segment.lyrics?.[i] ?? ''),
    // Sections saved before lyrics moved onto the chords keep their words: the
    // old whole-line text becomes the line's lead-in, which reads the same even
    // though nothing sits under a chord yet.
    leadIns: [...(segment.leadIns ?? segment.lyricLines ?? [])],
    // Sections saved before melodies existed simply have none.
    melody: [...(segment.melody ?? [])],
    timeSignature: segment.timeSignature || DEFAULT_TIME_SIGNATURE,
  }
}

/**
 * The melody of a whole arrangement, in beats from the start.
 *
 * Each occurrence of a section contributes its own copy, offset by where that
 * occurrence begins — a section used twice has its line played twice, which is
 * the whole point of repeats.
 */
export function flattenMelody(song, segments) {
  const byId = new Map(segments.map((s) => [s.id, s]))
  const out = []
  let beat = 0
  for (const entry of song) {
    const segment = byId.get(entry.segmentId)
    if (!segment) continue
    const live = readSegment(segment)
    const length = live.durations.reduce((a, b) => a + b, 0)
    const repeats = Math.max(1, entry.repeats ?? 1)
    for (let r = 0; r < repeats; r++) {
      for (const note of live.melody ?? []) {
        out.push({ at: beat + note.at, beats: note.beats, midi: note.midi })
      }
      beat += length
    }
  }
  return out
}

export function segmentBeats(segment) {
  return (segment.durations ?? []).reduce((sum, d) => sum + toBeats(d), 0)
}

/**
 * Flatten a song into one playable list.
 * @returns array of { chord, key, inversion, durationId, segmentId, segmentName, repeat, indexInSegment }
 */
export function flattenSong(song, segments) {
  const byId = new Map(segments.map((s) => [s.id, s]))
  const out = []
  song.forEach((entry, entryIndex) => {
    const segment = byId.get(entry.segmentId)
    if (!segment) return // a segment deleted out from under the arrangement
    const live = readSegment(segment)
    const repeats = Math.max(1, entry.repeats ?? 1)
    for (let r = 0; r < repeats; r++) {
      live.progression.forEach((chord, i) => {
        out.push({
          chord,
          key: live.key,
          inversion: live.inversions[i],
          durationId: live.durations[i],
          shape: live.shapes[i],
          line: live.lines[i],
          timeSignature: live.timeSignature,
          entryIndex,
          segmentId: segment.id,
          segmentName: segment.name,
          repeat: r,
          indexInSegment: i,
        })
      })
    }
  })
  return out
}

export function songBeats(song, segments) {
  const byId = new Map(segments.map((s) => [s.id, s]))
  return song.reduce((sum, entry) => {
    const segment = byId.get(entry.segmentId)
    if (!segment) return sum
    return sum + segmentBeats(segment) * Math.max(1, entry.repeats ?? 1)
  }, 0)
}

/** Rough duration in mm:ss at a given tempo. */
export function formatDuration(beats, bpm) {
  const seconds = (beats * 60) / bpm
  const m = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// --- persistence ------------------------------------------------------------

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked — the arrangement just won't persist */
  }
  return value
}

export const loadSegments = () => read(SEGMENTS_KEY, [])
export const saveSegments = (segments) => write(SEGMENTS_KEY, segments)
export const loadSong = () => read(SONG_KEY, [])
export const saveSong = (song) => write(SONG_KEY, song)

/** Give a repeated section a distinct name: Verse, Verse 2, Verse 3… */
export function uniqueName(base, segments) {
  const taken = new Set(segments.map((s) => s.name))
  if (!taken.has(base)) return base
  for (let n = 2; n < 99; n++) {
    const candidate = `${base} ${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base} ${Date.now()}`
}
