// Segments and song arrangement.
//
// A segment is a named chunk of music — a verse, a chorus — that owns its own
// key and metre, so a song can modulate between sections. A song is an ordered
// list of references to segments, each with a repeat count.

import { parseChord, chordId } from '../theory/chords.js'
import { makeKey } from '../theory/keys.js'
import { noteName } from '../theory/notes.js'
import { DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE, beatsOf } from '../theory/rhythm.js'

const SEGMENTS_KEY = 'picardy.segments.v1'
const SONG_KEY = 'picardy.song.v1'

export const SEGMENT_NAMES = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro']

/** Colour per section type, so the arrangement is readable at a glance. */
export function segmentHue(name) {
  const known = SEGMENT_NAMES.indexOf(name.replace(/\s*\d+$/, ''))
  if (known >= 0) return [200, 152, 42, 320, 268, 60, 12][known] ?? 200
  // Stable hue for a custom name.
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Snapshot the editor into a storable segment. Chords are stored as symbols. */
export function makeSegment({ name, key, progression, inversions, durations, timeSignature }) {
  return {
    id: uid(),
    name: name || 'Untitled',
    key: `${noteName(key.tonic)}${key.mode === 'minor' ? 'm' : ''}`,
    timeSignature: timeSignature || DEFAULT_TIME_SIGNATURE,
    chords: progression.map(chordId),
    inversions: progression.map((_, i) => inversions[i] ?? 0),
    durations: progression.map((_, i) => durations[i] ?? DEFAULT_DURATION),
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
    durations: progression.map((_, i) => segment.durations?.[i] ?? DEFAULT_DURATION),
    timeSignature: segment.timeSignature || DEFAULT_TIME_SIGNATURE,
  }
}

export function segmentBeats(segment) {
  return (segment.durations ?? []).reduce((sum, d) => sum + beatsOf(d), 0)
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
