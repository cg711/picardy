// A small Web Audio polysynth. No samples, no dependencies.

import { midiToFreq } from '../theory/notes.js'

let ctx = null
let master = null
let reverb = null

function ensureContext() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.55
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 6
  master.connect(comp)
  comp.connect(ctx.destination)

  // Cheap plate-ish reverb from generated noise.
  reverb = ctx.createConvolver()
  reverb.buffer = makeImpulse(ctx, 1.7, 2.6)
  const wet = ctx.createGain()
  wet.gain.value = 0.22
  reverb.connect(wet)
  wet.connect(comp)
  return ctx
}

function makeImpulse(ac, seconds, decay) {
  const rate = ac.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = ac.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

export function resumeAudio() {
  ensureContext()
  if (ctx.state === 'suspended') ctx.resume()
}

export function setVolume(v) {
  ensureContext()
  master.gain.setTargetAtTime(v, ctx.currentTime, 0.02)
}

const TIMBRES = {
  piano: { osc: ['triangle', 'sine'], detune: 4, attack: 0.006, decay: 0.9, sustain: 0.28, release: 0.5, cutoff: 3200 },
  guitar: { osc: ['sawtooth', 'triangle'], detune: 7, attack: 0.004, decay: 1.4, sustain: 0.16, release: 0.7, cutoff: 2400 },
  pad: { osc: ['sawtooth', 'sawtooth'], detune: 11, attack: 0.12, decay: 0.6, sustain: 0.6, release: 1.2, cutoff: 1800 },
}

// Every sounding voice, so playback can actually be cut short. Oscillators are
// scheduled ahead of time, so clearing timers alone would leave them ringing.
let voices = []

function releaseVoices(fade = 0.06) {
  if (!ctx) return
  const now = ctx.currentTime
  for (const v of voices) {
    try {
      v.amp.gain.cancelScheduledValues(now)
      v.amp.gain.setValueAtTime(v.amp.gain.value, now)
      v.amp.gain.linearRampToValueAtTime(0.0001, now + fade)
      for (const o of v.oscs) o.stop(now + fade + 0.02)
    } catch {
      /* already stopped */
    }
  }
  voices = []
}

function playNote(midi, when, duration, timbre, gain = 0.16) {
  const t = TIMBRES[timbre] ?? TIMBRES.piano
  const freq = midiToFreq(midi)
  const amp = ctx.createGain()
  amp.gain.value = 0

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(t.cutoff, when)
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, t.cutoff * 0.35), when + duration)
  filter.Q.value = 0.6

  const oscs = t.osc.map((type, i) => {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = i === 0 ? -t.detune : t.detune
    o.connect(filter)
    return o
  })

  filter.connect(amp)
  amp.connect(master)
  if (reverb) amp.connect(reverb)

  // Higher notes quieter, so big voicings stay balanced.
  const g = gain * Math.pow(0.5, Math.max(0, midi - 60) / 24)
  amp.gain.setValueAtTime(0, when)
  amp.gain.linearRampToValueAtTime(g, when + t.attack)
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, g * t.sustain), when + t.attack + t.decay)
  amp.gain.setTargetAtTime(0.0001, when + duration, t.release / 3)

  const stop = when + duration + t.release + 0.1
  for (const o of oscs) {
    o.start(when)
    o.stop(stop)
  }

  const voice = { oscs, amp }
  voices.push(voice)
  oscs[0].onended = () => {
    voices = voices.filter((v) => v !== voice)
  }
  return stop
}

/** Play a chord immediately. `strum` staggers note onsets like a pick stroke. */
export function playChord(midis, { duration = 1.4, timbre = 'piano', strum = 0 } = {}) {
  ensureContext()
  resumeAudio()
  const now = ctx.currentTime + 0.02
  midis.forEach((m, i) => playNote(m, now + i * strum, duration, timbre))
}

let scheduled = []
let playbackTimer = null

export function stopPlayback() {
  scheduled.forEach((id) => clearTimeout(id))
  scheduled = []
  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
  releaseVoices()
}

/**
 * Play a sequence of chords, each with its own length.
 *
 * @param items array of { midis, beats } — beats are quarter-note beats, so a
 *              whole note in 4/4 is 4. onStep(i) fires as item i sounds.
 */
export const PATTERNS = {
  block: { label: 'Block chords' },
  strum: { label: 'Strum' },
  arpeggio: { label: 'Arpeggio' },
  bassComp: { label: 'Bass + comp' },
}

/** A click, for the count-in. */
function playClick(when, accent) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = accent ? 1600 : 1100
  amp.gain.setValueAtTime(0, when)
  amp.gain.linearRampToValueAtTime(accent ? 0.13 : 0.08, when + 0.002)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
  osc.connect(amp)
  amp.connect(master)
  osc.start(when)
  osc.stop(when + 0.09)
  voices.push({ oscs: [osc], amp })
}

/**
 * Lay one chord out over its own length according to the pattern. Returns the
 * note events as { midi, at, duration } offsets in seconds from the chord start.
 */
function renderPattern(midis, seconds, pattern, strum) {
  if (!midis.length) return []
  const sustain = seconds * (seconds < 0.4 ? 0.98 : 0.92)

  if (pattern === 'strum') {
    return midis.map((m, i) => ({ midi: m, at: i * Math.max(strum, 0.022), duration: sustain }))
  }

  if (pattern === 'arpeggio') {
    // Walk up the chord and back down, filling the chord's length.
    const up = [...midis]
    const shape = up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up
    const steps = Math.max(2, Math.round(seconds / 0.25))
    return Array.from({ length: steps }, (_, i) => ({
      midi: shape[i % shape.length],
      at: (i / steps) * seconds,
      duration: Math.max(0.12, (seconds / steps) * 1.6),
    }))
  }

  if (pattern === 'bassComp') {
    // Root on the beat, the rest of the chord answering off it.
    const [bass, ...upper] = midis
    const events = [{ midi: bass, at: 0, duration: Math.min(sustain, seconds * 0.45) }]
    const hits = Math.max(1, Math.round(seconds / 0.5))
    for (let i = 1; i < hits; i++) {
      const at = (i / hits) * seconds
      upper.forEach((m, j) => events.push({ midi: m, at: at + j * 0.008, duration: seconds / hits * 0.8 }))
    }
    return events
  }

  return midis.map((m, i) => ({ midi: m, at: i * strum, duration: sustain }))
}

export function playProgression(items, {
  bpm = 84,
  timbre = 'piano',
  strum = 0.012,
  pattern = 'block',
  countIn = 0,
  beatsPerBar = 4,
  loop = false,
  onStep,
  onDone,
} = {}) {
  ensureContext()
  resumeAudio()
  stopPlayback()
  const secondsPerBeat = 60 / bpm
  let start = ctx.currentTime + 0.08

  if (countIn > 0) {
    for (let i = 0; i < countIn; i++) {
      playClick(start + i * secondsPerBeat, i % beatsPerBar === 0)
    }
    start += countIn * secondsPerBeat
  }

  let cursor = start
  items.forEach((item, i) => {
    const seconds = Math.max(0.05, (item.beats ?? 4) * secondsPerBeat)
    const when = cursor
    for (const note of renderPattern(item.midis, seconds, pattern, strum)) {
      playNote(note.midi, when + note.at, note.duration, timbre)
    }
    scheduled.push(setTimeout(() => onStep && onStep(i), Math.max(0, (when - ctx.currentTime) * 1000)))
    cursor += seconds
  })

  const endsIn = Math.max(0, (cursor - ctx.currentTime) * 1000)
  playbackTimer = setTimeout(() => {
    if (loop) {
      // Re-arm rather than scheduling the whole loop up front, so tempo and
      // pattern changes take effect on the next pass and Stop always works.
      playProgression(items, { bpm, timbre, strum, pattern, countIn: 0, beatsPerBar, loop, onStep, onDone })
    } else {
      onDone && onDone()
    }
  }, endsIn)
}

export function isAudioReady() {
  return !!ctx && ctx.state === 'running'
}
