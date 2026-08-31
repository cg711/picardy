// A small Web Audio polysynth. No samples, no dependencies.

import { midiToFreq } from '../theory/notes.js'
import { playDrum } from './drums.js'
import { barFor, styleOf } from './styles.js'
export { STYLES, isBand } from './styles.js'

let ctx = null
let master = null
let reverb = null
// Drums get their own bus with far less reverb — a kit soaked in the same plate
// as the pad turns the backbeat to mush.
let drumBus = null

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

  drumBus = ctx.createGain()
  drumBus.gain.value = 0.9
  drumBus.connect(master)
  const drumSend = ctx.createGain()
  drumSend.gain.value = 0.06
  drumBus.connect(drumSend)
  drumSend.connect(reverb)
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
  // Almost no detune and a low cutoff: a bass that beats against itself muddies
  // everything above it, and the harmonics that survive are the ones that let
  // you hear the root on a laptop speaker.
  bass: { osc: ['triangle', 'sine'], detune: 1, attack: 0.008, decay: 0.5, sustain: 0.45, release: 0.25, cutoff: 900 },
  // A melody has to sit on top of a whole band, so this is brighter and more
  // present than the comping voices rather than louder.
  lead: { osc: ['square', 'triangle'], detune: 3, attack: 0.01, decay: 0.35, sustain: 0.55, release: 0.3, cutoff: 4200 },
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
export function playChord(midis, { duration = 1.4, timbre = 'piano', strum = 0, gain = 0.16 } = {}) {
  ensureContext()
  resumeAudio()
  const now = ctx.currentTime + 0.02
  midis.forEach((m, i) => playNote(m, now + i * strum, duration, timbre, gain))
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
// The four chord-only patterns now live in styles.js alongside the band styles,
// so the picker has one list and cannot offer a style the scheduler cannot play.

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

/** Where a bass note sits: the lowest octave that still speaks, E1 upward. */
const BASS_FLOOR = 28
const bassMidiFor = (pc) => BASS_FLOOR + ((((pc | 0) - BASS_FLOOR) % 12) + 12) % 12

/**
 * Chord spans in beats, so anything on the bar-level timeline can ask what
 * harmony is sounding underneath it.
 *
 * The groove repeats per bar while chords change on their own schedule, and the
 * two do not line up: a chord can straddle a bar line, and a bar can hold three
 * chords. Resolving by beat rather than by index is what keeps the bass on the
 * right root in both cases.
 */
function spansOf(items) {
  const spans = []
  let at = 0
  for (const item of items) {
    const beats = Math.max(0.05, item.beats ?? 4)
    spans.push({ start: at, end: at + beats, item })
    at += beats
  }
  return { spans, total: at }
}

const spanAt = (spans, beat) =>
  spans.find((s) => beat >= s.start - 1e-6 && beat < s.end - 1e-6) ?? spans[spans.length - 1]

/** The bass pitch class for an item — stated if the caller knows it, else the lowest voiced note. */
const bassPcOf = (item) =>
  item?.bassPc != null ? item.bassPc : (item?.midis?.length ? Math.min(...item.midis) % 12 : 0)

function scheduleBand(items, o) {
  const { start, secondsPerBeat, timbre, styleId, ts, onStep, sectionStartBeats } = o
  const bar = barFor(styleId, ts)
  const { spans, total } = spansOf(items)
  const perBar = ts.beatsPerBar
  const barCount = Math.max(1, Math.ceil(total / perBar - 1e-6))

  // A fill goes in the bar before something changes: a new section, or the loop
  // coming round again. Without them a groove stops being a performance and
  // starts being wallpaper.
  const fills = new Set([barCount - 1])
  for (const b of sectionStartBeats) {
    if (b > 0) fills.add(Math.max(0, Math.ceil(b / perBar) - 1))
  }

  const emit = (beat, fn) => {
    if (beat < -1e-6 || beat > total + 1e-6) return
    fn(start + beat * secondsPerBeat)
  }

  for (let b = 0; b < barCount; b++) {
    const barStart = b * perBar
    const barLen = Math.min(perBar, total - barStart)
    const isFill = fills.has(b)

    // barFor has already swung these and trimmed them to the bar; the only
    // thing left to check is a final bar that is shorter than a full one.
    for (const hit of isFill ? bar.fill : bar.drums) {
      const at = hit.at
      if (at >= barLen - 1e-6) continue
      emit(barStart + at, (when) => {
        const v = playDrum(ctx, drumBus, hit.voice, when, hit.gain ?? 1)
        if (v) voices.push(v)
      })
    }
    // A crash on the downbeat after a fill, which is what the fill was for.
    if (b > 0 && fills.has(b - 1)) {
      emit(barStart, (when) => {
        const v = playDrum(ctx, drumBus, 'crash', when, 0.7)
        if (v) voices.push(v)
      })
    }

    for (const hit of bar.comp) {
      const at = hit.at
      if (at >= barLen - 1e-6) continue
      const span = spanAt(spans, barStart + at)
      const dur = Math.min(hit.dur, barLen - at) * secondsPerBeat
      emit(barStart + at, (when) => {
        for (const m of span.item.midis ?? []) playNote(m, when, dur, timbre, 0.13 * (hit.gain ?? 1))
      })
    }

    for (const hit of bar.bass) {
      const at = hit.at
      if (at >= barLen - 1e-6) continue
      const span = spanAt(spans, barStart + at)
      const midi = bassMidiFor(bassPcOf(span.item)) + (hit.degree ?? 0)
      const dur = Math.min(hit.dur, barLen - at) * secondsPerBeat
      emit(barStart + at, (when) => playNote(midi, when, dur, 'bass', 0.3 * (hit.gain ?? 1)))
    }
  }

  // The playhead still moves chord by chord, whatever the band is doing.
  spans.forEach((span, i) => {
    const when = start + span.start * secondsPerBeat
    scheduled.push(setTimeout(() => onStep && onStep(i), Math.max(0, (when - ctx.currentTime) * 1000)))
  })

  return start + total * secondsPerBeat
}

function scheduleChords(items, o) {
  const { start, secondsPerBeat, timbre, pattern, strum, onStep } = o
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
  return cursor
}

/**
 * How far ahead of the end the next pass is scheduled, in seconds.
 *
 * A loop that re-arms *at* the end is never seamless: the timer fires late, and
 * the new pass then starts relative to whenever that happened. Scheduling early
 * against an explicit start time means the next downbeat is placed in
 * AudioContext time before the current pass has finished sounding, so the join
 * is sample-accurate rather than merely quick.
 */
const LOOP_LOOKAHEAD = 0.25

function runPass(items, opts, startAt) {
  // `settings` is consulted once per pass rather than captured at play time, so
  // a tempo nudge or a style change lands on the next time round instead of
  // being ignored until playback is restarted. Restarting would be the worse
  // instrument: you would lose your place every time you touched the tempo.
  const live = typeof opts.settings === 'function' ? (opts.settings() ?? {}) : {}
  const {
    timbre, strum, countIn, beatsPerBar,
    timeSignature, loop, onStep, onDone, sectionStartBeats,
  } = opts
  const bpm = live.bpm ?? opts.bpm
  const pattern = live.pattern ?? opts.pattern
  const secondsPerBeat = 60 / bpm
  let start = startAt

  if (countIn > 0) {
    for (let i = 0; i < countIn; i++) {
      playClick(start + i * secondsPerBeat, i % beatsPerBar === 0)
    }
    start += countIn * secondsPerBeat
  }

  const ts = timeSignature ?? { beatsPerBar, top: beatsPerBar, bottom: 4 }
  const style = styleOf(pattern)
  const end = style.band
    ? scheduleBand(items, { start, secondsPerBeat, timbre, styleId: pattern, ts, onStep, sectionStartBeats })
    : scheduleChords(items, { start, secondsPerBeat, timbre, pattern, strum, onStep })

  // The melody rides on the same timeline as everything else, so it does not
  // care whether a band is playing underneath or just block chords.
  for (const note of opts.melody ?? []) {
    if (!(note.beats > 0)) continue
    playNote(
      note.midi,
      start + note.at * secondsPerBeat,
      note.beats * secondsPerBeat * 0.95,
      'lead',
      0.2,
    )
  }

  if (loop) {
    // Re-arm one pass at a time rather than scheduling the whole loop up front,
    // so tempo and style changes take effect on the next pass and Stop always
    // works — but arm it early, and hand it the exact time this pass ends.
    const fireIn = Math.max(0, (end - LOOP_LOOKAHEAD - ctx.currentTime) * 1000)
    playbackTimer = setTimeout(() => runPass(items, { ...opts, countIn: 0 }, end), fireIn)
  } else {
    playbackTimer = setTimeout(() => onDone && onDone(), Math.max(0, (end - ctx.currentTime) * 1000))
  }
  return end
}

export function playProgression(items, opts = {}) {
  ensureContext()
  resumeAudio()
  stopPlayback()
  runPass(items, {
    bpm: 84,
    timbre: 'piano',
    strum: 0.012,
    pattern: 'block',
    countIn: 0,
    beatsPerBar: 4,
    timeSignature: null,
    loop: false,
    onStep: undefined,
    onDone: undefined,
    sectionStartBeats: [],
    settings: null,
    melody: [],
    ...opts,
  }, ctx.currentTime + 0.08)
}

export function isAudioReady() {
  return !!ctx && ctx.state === 'running'
}
