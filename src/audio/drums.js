// A synthesised drum kit. No samples, for the same reason the rest of the synth
// has none: a usable kit is a few oscillators and some filtered noise, and
// shipping megabytes of audio would undo the thing the app is fastest at.
//
// Every voice takes (ctx, dest, when, gain) and returns the nodes it started, so
// the caller can register them for stopPlayback and cut them short mid-bar.

let noiseBuffer = null

/** One second of white noise, generated once and shared by every noisy voice. */
function noise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const len = ctx.sampleRate
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

function noiseSource(ctx, when, duration) {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  src.loop = true
  // A random offset so repeated hits are not bit-identical, which is most of
  // what makes a synthesised hat sound like a machine.
  src.loopStart = Math.random() * 0.5
  src.loopEnd = src.loopStart + 0.4
  src.start(when, src.loopStart)
  src.stop(when + duration + 0.02)
  return src
}

const env = (ctx, when, peak, decay, hold = 0) => {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(peak, when + 0.002)
  if (hold) g.gain.setValueAtTime(peak, when + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, when + hold + decay)
  return g
}

function tone(ctx, when, { type = 'sine', from, to, decay, peak, pitchTime = null }) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, when)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, when + (pitchTime ?? decay * 0.6))
  const amp = env(ctx, when, peak, decay)
  osc.connect(amp)
  osc.start(when)
  osc.stop(when + decay + 0.05)
  return { osc, amp }
}

function filteredNoise(ctx, when, { type, freq, q = 1, decay, peak, hold = 0 }) {
  const src = noiseSource(ctx, when, decay + hold)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const amp = env(ctx, when, peak, decay, hold)
  src.connect(filter)
  filter.connect(amp)
  return { src, amp }
}

/**
 * The kit. Each entry returns { nodes, amp } — `nodes` are things with .stop()
 * so playback can be cut, `amp` is the output to connect.
 *
 * Levels are baked in relative to each other so a style only has to say "hit
 * this, fairly hard" rather than carry a mix.
 */
const VOICES = {
  kick: (ctx, when, g) => {
    const body = tone(ctx, when, { from: 155, to: 45, decay: 0.32, peak: 1.0 * g, pitchTime: 0.055 })
    const click = filteredNoise(ctx, when, { type: 'lowpass', freq: 2200, decay: 0.02, peak: 0.35 * g })
    return { nodes: [body.osc, click.src], amps: [body.amp, click.amp] }
  },
  snare: (ctx, when, g) => {
    const body = tone(ctx, when, { type: 'triangle', from: 195, to: 165, decay: 0.11, peak: 0.42 * g })
    const rattle = filteredNoise(ctx, when, { type: 'bandpass', freq: 1900, q: 0.7, decay: 0.17, peak: 0.75 * g })
    return { nodes: [body.osc, rattle.src], amps: [body.amp, rattle.amp] }
  },
  // The quiet cross-stick a ballad uses instead of a backbeat.
  rim: (ctx, when, g) => {
    const body = tone(ctx, when, { type: 'triangle', from: 420, to: 380, decay: 0.035, peak: 0.3 * g })
    const tick = filteredNoise(ctx, when, { type: 'bandpass', freq: 2600, q: 3, decay: 0.035, peak: 0.55 * g })
    return { nodes: [body.osc, tick.src], amps: [body.amp, tick.amp] }
  },
  hat: (ctx, when, g) => {
    const h = filteredNoise(ctx, when, { type: 'highpass', freq: 7800, decay: 0.045, peak: 0.3 * g })
    return { nodes: [h.src], amps: [h.amp] }
  },
  hatOpen: (ctx, when, g) => {
    const h = filteredNoise(ctx, when, { type: 'highpass', freq: 7200, decay: 0.34, peak: 0.26 * g })
    return { nodes: [h.src], amps: [h.amp] }
  },
  // Swing lives or dies on the ride, so it gets a little pitched body rather
  // than being pure noise like the hat.
  ride: (ctx, when, g) => {
    const wash = filteredNoise(ctx, when, { type: 'highpass', freq: 6200, decay: 0.5, peak: 0.16 * g })
    const ping = tone(ctx, when, { type: 'square', from: 3100, to: 3050, decay: 0.16, peak: 0.055 * g })
    return { nodes: [wash.src, ping.osc], amps: [wash.amp, ping.amp] }
  },
  crash: (ctx, when, g) => {
    const c = filteredNoise(ctx, when, { type: 'highpass', freq: 4200, decay: 1.1, peak: 0.34 * g })
    return { nodes: [c.src], amps: [c.amp] }
  },
  tomHi: (ctx, when, g) => {
    const t = tone(ctx, when, { from: 260, to: 190, decay: 0.24, peak: 0.55 * g })
    return { nodes: [t.osc], amps: [t.amp] }
  },
  tomMid: (ctx, when, g) => {
    const t = tone(ctx, when, { from: 200, to: 145, decay: 0.27, peak: 0.58 * g })
    return { nodes: [t.osc], amps: [t.amp] }
  },
  tomLo: (ctx, when, g) => {
    const t = tone(ctx, when, { from: 150, to: 105, decay: 0.3, peak: 0.6 * g })
    return { nodes: [t.osc], amps: [t.amp] }
  },
}

export const DRUM_VOICES = Object.keys(VOICES)

/**
 * Schedule one hit. Returns { oscs, amp } shaped like a synth voice so the
 * existing stopPlayback bookkeeping can kill it without special-casing drums.
 */
export function playDrum(ctx, dest, voice, when, gain = 1) {
  const make = VOICES[voice]
  if (!make) return null
  const { nodes, amps } = make(ctx, when, gain)
  const out = ctx.createGain()
  out.gain.value = 1
  for (const a of amps) a.connect(out)
  out.connect(dest)
  return { oscs: nodes, amp: out }
}
