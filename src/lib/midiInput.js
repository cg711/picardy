// A MIDI keyboard as another way of picking notes.
//
// The app already has one: click the piano or the fretboard and the notes land
// in a set that identifyChord reads. A controller is the same act with better
// ergonomics, so it feeds the same set rather than growing a second path — which
// means chord identification, the instrument diagrams and the "from notes" tab
// all work through it without knowing MIDI exists.

/**
 * One MIDI message, as much of it as this app cares about.
 *
 * A note-on with zero velocity is a note-off. Plenty of controllers send that
 * form exclusively — running status makes it cheaper — and treating it as a
 * note-on leaves keys stuck down forever.
 */
export function parseMidiMessage(data) {
  if (!data || data.length < 3) return null
  const status = data[0] & 0xf0
  const note = data[1]
  const velocity = data[2]
  if (note < 0 || note > 127) return null
  if (status === 0x90) return { type: velocity > 0 ? 'on' : 'off', note, velocity }
  if (status === 0x80) return { type: 'off', note, velocity }
  return null
}

export const isMidiSupported = () =>
  typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'

/**
 * Open every input and listen.
 *
 * Every input rather than a chosen one: people plug in one controller, and
 * making them pick it from a list first is a step that exists only because the
 * API returns a collection. Hot-plugging is handled the same way — a device
 * arriving mid-session is simply subscribed to.
 */
export async function openMidi({ onNote, onDevices }) {
  if (!isMidiSupported()) throw new Error('This browser has no Web MIDI.')
  const access = await navigator.requestMIDIAccess({ sysex: false })

  let closed = false
  const listen = () => {
    const names = []
    for (const input of access.inputs.values()) {
      names.push(input.name || 'MIDI device')
      input.onmidimessage = (event) => {
        if (closed) return
        const parsed = parseMidiMessage(event.data)
        if (parsed) onNote(parsed)
      }
    }
    onDevices?.(names)
  }

  listen()
  access.onstatechange = () => { if (!closed) listen() }

  return {
    close() {
      closed = true
      access.onstatechange = null
      for (const input of access.inputs.values()) input.onmidimessage = null
    },
  }
}
