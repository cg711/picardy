// Progression <-> URL hash, plus a small localStorage history.

import { parseChord, chordId } from '../theory/chords.js'
import { makeKey } from '../theory/keys.js'
import { noteName, parseNote } from '../theory/notes.js'
import { DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE } from '../theory/rhythm.js'

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

export function encodeState({ key, progression, inversions, durations, timeSignature, shapes, lyrics }) {
  const params = new URLSearchParams()
  params.set('k', `${noteName(key.tonic)}${key.mode === 'minor' ? 'm' : ''}`)
  params.set('p', progression.map(chordId).join(','))
  if (inversions?.some((i) => i)) params.set('i', inversions.join(','))
  // Only carry rhythm when it differs from the defaults, to keep links short.
  if (durations?.some((d) => d !== DEFAULT_DURATION)) params.set('d', durations.join(','))
  if (timeSignature && timeSignature !== DEFAULT_TIME_SIGNATURE) params.set('t', timeSignature)
  // Only carried when actually set, so a plain link stays short.
  if (shapes?.some(Boolean)) params.set('v', shapes.map((x) => x ?? '').join('~'))
  if (lyrics?.some((l) => l && l.trim())) params.set('w', lyrics.map((l) => l ?? '').join('~'))
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

  const durations = (params.get('d') || '')
    .split(',')
    .filter(Boolean)
  const timeSignature = params.get('t') || DEFAULT_TIME_SIGNATURE

  const shapes = (params.get('v') || '').split('~')
  const lyrics = (params.get('w') || '').split('~')

  return {
    key,
    progression,
    inversions,
    durations: progression.map((_, i) => durations[i] ?? DEFAULT_DURATION),
    timeSignature,
    shapes: progression.map((_, i) => shapes[i] || null),
    lyrics: progression.map((_, i) => lyrics[i] || ''),
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
