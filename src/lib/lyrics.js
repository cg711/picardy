// Turning chord-and-words pairs into a printed chord-over-lyric line.
//
// A lyric line is stored as an association, not a layout: each chord carries the
// words sung under it, plus a lead-in for whatever is sung before the first
// chord. Nothing records a position, so nothing can drift — the chord is over
// its syllable because it owns it, whatever the width or font.
//
// This module turns that association back into two rows of text, which is what
// both the printed chart and any plain-text export need.

/** Words before the first chord, then one fragment per chord on the line. */
export function lineFragments(progression, lyrics, lines, leadIns, line) {
  const fragments = []
  progression.forEach((chord, i) => {
    if ((lines[i] ?? 0) !== line) return
    fragments.push({ chord, index: i, text: lyrics[i] ?? '' })
  })
  return { leadIn: leadIns[line] ?? '', fragments }
}

/**
 * Lay a line out as a chord row above a lyric row.
 *
 * The lyric row is the fragments joined in order. A chord sits at the x where
 * its own fragment starts — so it lands on the syllable it belongs to by
 * construction rather than by placement.
 *
 * Where a chord's label is wider than the words under it, the lyric is padded so
 * the next chord still starts after this label rather than on top of it. That
 * padding is the one thing a chord sheet does that ordinary text does not, and
 * it is why "C      G" sits over "wait      ing" rather than colliding.
 *
 * @param measure  (text) => width, in whatever unit the caller draws in
 * @param gap      minimum space to leave after a chord label
 * @returns { chordRow, lyricRow, placements: [{ chord, index, x }] }
 */
export function layoutLine({ leadIn = '', fragments = [], measure, gap = 0, spaceWidth }) {
  const space = spaceWidth ?? measure(' ') ?? 1
  let lyricRow = leadIn
  let chordRow = ''
  const placements = []

  for (const fragment of fragments) {
    // The chord belongs at the start of its own words.
    let x = measure(lyricRow)

    // If the previous label runs past that point, push the words along until it
    // does not. Padding the lyric — rather than shifting the chord — is what
    // keeps the two rows describing the same thing.
    const minX = chordRow ? measure(chordRow) + gap : 0
    if (minX > x && space > 0) {
      const need = Math.ceil((minX - x) / space)
      lyricRow += ' '.repeat(need)
      x = measure(lyricRow)
    }

    // Pad the chord row out to the chord's position, so the two rows can be
    // printed as plain text and still line up.
    if (space > 0) {
      const pad = Math.max(0, Math.round((x - measure(chordRow)) / space))
      chordRow += ' '.repeat(pad)
    }
    chordRow += fragment.label ?? ''
    placements.push({ chord: fragment.chord, index: fragment.index, x })

    lyricRow += fragment.text ?? ''
  }

  return { chordRow, lyricRow, placements }
}

/**
 * The plain text of a line, with no chords — what the words alone read as.
 * Used for the editor's preview and for anywhere the lyric is wanted on its own.
 */
export function lineText({ leadIn = '', fragments = [] }) {
  return leadIn + fragments.map((f) => f.text ?? '').join('')
}

/**
 * Split a pasted line into fragments across the chords already on it.
 *
 * Typing a line word by word into separate boxes is slow, and pasting is how
 * lyrics usually arrive. Words are dealt out at whitespace so each chord gets a
 * whole number of words; anything left over lands on the last chord. A chord
 * change mid-word still has to be made by hand, because only the writer knows
 * where the syllable breaks.
 */
export function distributeWords(text, count) {
  const out = new Array(Math.max(0, count)).fill('')
  if (!count) return out
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return out

  const per = Math.floor(words.length / count)
  const extra = words.length % count
  let w = 0
  for (let i = 0; i < count; i++) {
    // The first few chords take one more word each, so the remainder is spread
    // rather than dumped on the end.
    const take = per + (i < extra ? 1 : 0)
    const slice = words.slice(w, w + take)
    w += take
    out[i] = slice.join(' ') + (i < count - 1 && slice.length ? ' ' : '')
  }
  return out
}
