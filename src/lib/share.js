// Progression <-> URL hash, plus a small localStorage history.

import { parseChord, chordId } from '../theory/chords.js'
import { makeKey } from '../theory/keys.js'
import { noteName, parseNote } from '../theory/notes.js'
import { DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE, toBeats } from '../theory/rhythm.js'

const STORAGE_KEY = 'picardy.history.v1'
const PREFS_KEY = 'picardy.prefs.v1'

// The app used to be called Chord Lab. Carry anything saved under the old keys
// over on first run so a rename doesn't quietly throw away saved progressions.
const LEGACY_KEYS = { [STORAGE_KEY]: 'chordlab.history.v1', [PREFS_KEY]: 'chordlab.prefs.v1' }

function readStore(key) {
  try {
    const current = localStorage.getItem(key)
    if (current !== null) return current
    const legacy = localStorage.getItem(LEGACY_KEYS[key])
    if (legacy === null) return null
    localStorage.setItem(key, legacy)
    localStorage.removeItem(LEGACY_KEYS[key])
    return legacy
  } catch {
    return null
  }
}

/** Display preferences that belong to the player, not to the progression. */
export function loadPrefs() {
  try {
    return JSON.parse(readStore(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function savePref(name, value) {
  const next = { ...loadPrefs(), [name]: value }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    /* storage blocked — the preference just won't persist */
  }
  return next
}

export function encodeState({ key, progression, inversions, durations, timeSignature, shapes, leadIns, lines, lyrics, bpm, style, sections, melody }) {
  const params = new URLSearchParams()
  params.set('k', `${noteName(key.tonic)}${key.mode === 'minor' ? 'm' : ''}`)
  params.set('p', progression.map(chordId).join(','))
  if (inversions?.some((i) => i)) params.set('i', inversions.join(','))
  // Only carry rhythm when it differs from the defaults, to keep links short.
  if (durations?.some((d) => toBeats(d) !== DEFAULT_DURATION)) {
    params.set('d', durations.map((d) => +toBeats(d).toFixed(3)).join(','))
  }
  if (timeSignature && timeSignature !== DEFAULT_TIME_SIGNATURE) params.set('t', timeSignature)
  // Only carried when actually set, so a plain link stays short.
  if (shapes?.some(Boolean)) params.set('v', shapes.map((x) => x ?? '').join('~'))
  // Words before the first chord of each line, and the words under each chord.
  if (leadIns?.some((l) => l && l.trim())) params.set('w', leadIns.map((l) => l ?? '').join('~'))
  if (lyrics?.some((l) => l && l.trim())) params.set('y', lyrics.map((l) => l ?? '').join('~'))
  if (lines?.some((n) => n)) params.set('n', lines.join(','))
  // Playback settings, so a backing-track link arrives at the right tempo and
  // feel. Only written when set, so an ordinary chord link stays as short as it
  // was and every link ever shared still decodes.
  if (bpm) params.set('b', String(Math.round(bpm)))
  if (style) params.set('s', style)
  // Where each section of an arrangement begins, as index:name. Names are
  // encoded individually because a section can be called anything, including
  // something with a colon or a tilde in it.
  // Where each section of an arrangement begins, as index:name:key. Names are
  // encoded individually because a section can be called anything, including
  // something with a colon or a tilde in it. The key travels because sections
  // can be in different ones, and a numeral read from the wrong tonic is worse
  // than no numeral at all.
  if (sections?.length) {
    params.set('g', sections
      .map((sec) => `${sec.at}:${encodeURIComponent(sec.name ?? '')}${sec.key ? `:${sec.key}` : ''}`)
      .join('~'))
  }

  // The melody, as beat:length:midi triples. Absent unless there is one, so a
  // chord-only link is exactly as short as it always was.
  if (melody?.length) {
    params.set('m', melody.map((n) => `${+n.at.toFixed(3)}:${+n.beats.toFixed(3)}:${n.midi}`).join('~'))
  }

  return params.toString()
}

export function decodeState(hash) {
  const raw = (hash || '').replace(/^#/, '')
  if (!raw) return null
  const params = new URLSearchParams(raw)
  const k = params.get('k')
  const p = params.get('p')
  if (!k) return null

  const minor = /m$/.test(k)
  const tonicStr = minor ? k.slice(0, -1) : k
  if (!parseNote(tonicStr)) return null
  const key = makeKey(tonicStr, minor ? 'minor' : 'major')
  if (!key) return null

  const progression = (p ? p.split(',') : [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseChord)
    .filter(Boolean)

  const inversions = (params.get('i') || '')
    .split(',')
    .map((n) => parseInt(n, 10) || 0)

  // Numbers now, but old links carry preset ids — toBeats accepts either.
  const durations = (params.get('d') || '')
    .split(',')
    .filter(Boolean)
    .map((d) => toBeats(Number.isNaN(Number(d)) ? d : Number(d)))
  const timeSignature = params.get('t') || DEFAULT_TIME_SIGNATURE

  const shapes = (params.get('v') || '').split('~')
  const leadIns = params.get('w') ? params.get('w').split('~') : ['']
  const lyrics = params.get('y') ? params.get('y').split('~') : []

  return {
    key,
    progression,
    inversions,
    durations: progression.map((_, i) => durations[i] ?? DEFAULT_DURATION),
    lines: (params.get('n') || '').split(',').map((n) => parseInt(n, 10) || 0),
    timeSignature,
    shapes: progression.map((_, i) => shapes[i] || null),
    leadIns,
    lyrics: progression.map((_, i) => lyrics[i] ?? ''),
    bpm: params.get('b') ? Math.min(300, Math.max(30, parseInt(params.get('b'), 10) || 0)) || null : null,
    style: params.get('s') || null,
    sections: (params.get('g') || '')
      .split('~')
      .filter(Boolean)
      .map((part) => {
        // index:name:key — the key is optional, so links written before sections
        // carried one still read.
        const bits = part.split(':')
        const at = parseInt(bits[0], 10)
        if (!Number.isFinite(at) || at < 0 || at >= progression.length) return null
        let name = ''
        try {
          name = decodeURIComponent(bits[1] ?? '')
        } catch {
          name = bits[1] ?? ''
        }
        const raw = bits[2] ?? ''
        const minor = /m$/.test(raw)
        const tonic = minor ? raw.slice(0, -1) : raw
        const sectionKey = tonic && parseNote(tonic) ? makeKey(tonic, minor ? 'minor' : 'major') : null
        return { at, name, key: sectionKey }
      })
      .filter(Boolean)
      .sort((a, b) => a.at - b.at),
    melody: (params.get('m') || '')
      .split('~')
      .filter(Boolean)
      .map((part) => {
        const [at, beats, midi] = part.split(':').map(Number)
        if (![at, beats, midi].every(Number.isFinite)) return null
        if (at < 0 || beats <= 0 || midi < 0 || midi > 127) return null
        return { at, beats, midi }
      })
      .filter(Boolean),
  }
}

export function writeHash(state) {
  const encoded = encodeState(state)
  const url = `${window.location.pathname}${window.location.search}#${encoded}`
  window.history.replaceState(null, '', url)
}

export function shareUrl(state) {
  return `${window.location.origin}${window.location.pathname}#${encodeState(state)}`
}

export function loadHistory() {
  try {
    const raw = readStore(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveToHistory({ key, progression }) {
  if (!progression.length) return loadHistory()
  const entry = {
    at: Date.now(),
    key: `${noteName(key.tonic)}${key.mode === 'minor' ? 'm' : ''}`,
    chords: progression.map(chordId),
  }
  // Building a progression one chord at a time would otherwise leave a trail of
  // every prefix; keep only the longest version of each chain.
  const chain = entry.chords.join(',')
  const existing = loadHistory().filter((h) => {
    if (h.key !== entry.key) return true
    return !chain.startsWith(h.chords.join(','))
  })
  const next = [entry, ...existing].slice(0, 20)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked — history is a convenience, not a requirement */
  }
  return next
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return []
}

export function historyToState(entry) {
  const minor = /m$/.test(entry.key)
  const tonicStr = minor ? entry.key.slice(0, -1) : entry.key
  return {
    key: makeKey(tonicStr, minor ? 'minor' : 'major'),
    progression: entry.chords.map(parseChord).filter(Boolean),
  }
}
