// Lead-sheet PDF export.
//
// Everything is drawn with jsPDF vector primitives — lines, circles, text — so
// the chart stays sharp at any zoom and the file stays small. Nothing is
// rasterised and nothing is fetched, so this works offline.

import { chordSymbol, chordId, chordNotes, voiceChord } from '../theory/chords.js'
import { romanNumeral } from '../theory/keys.js'
import { mod, pcOf, prettyName, noteName } from '../theory/notes.js'
import { findVoicings, TUNINGS, decodeShape, shapeFromFrets } from '../theory/guitar.js'
import { groupIntoBars, timeSignatureOf } from '../theory/rhythm.js'
import { readSegment } from './song.js'

const PAGE = { w: 210, h: 297 } // A4 portrait, millimetres
const MARGIN = 15
const CONTENT_W = PAGE.w - MARGIN * 2

// Brand palette, converted to the RGB triples jsPDF wants.
const INK = [28, 24, 18]
const MUTED = [122, 114, 102]
const RULE = [201, 194, 182]
const ACCENT = [166, 111, 20]

/** Strip the unicode accidentals jsPDF's standard fonts can't render. */
const ascii = (s) =>
  String(s)
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/𝄪/g, 'x')
    .replace(/°/g, 'o')
    .replace(/ø/g, '0')
    .replace(/Δ/g, 'maj')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/[^\x20-\x7E]/g, '')

/**
 * jsPDF is loaded on demand. Statically importing it drags html2canvas and
 * dompurify into the main bundle — neither of which this chart needs, since
 * everything here is drawn with vector primitives.
 */
export async function buildChart({ song, segments, title = 'Untitled', bpm = 84, instrument = 'guitar', tuning = TUNINGS.standard.strings, tuningId = 'standard', lefty = false }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  // --- title -----------------------------------------------------------------
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK)
  doc.text(ascii(title), MARGIN, y + 6)

  const sectionCount = song.reduce((n, e) => n + Math.max(1, e.repeats ?? 1), 0)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
  doc.text(`${bpm} bpm  ·  ${sectionCount} section${sectionCount === 1 ? '' : 's'}`, MARGIN, y + 12)
  y += 17

  doc.setDrawColor(...RULE).setLineWidth(0.4)
  doc.line(MARGIN, y, PAGE.w - MARGIN, y)
  y += 8

  // --- chord legend ----------------------------------------------------------
  const distinct = collectChords(song, segments)
  if (instrument !== 'none' && distinct.length) {
    y = drawLegend(doc, distinct, y, { instrument, tuning, tuningId, lefty })
    y += 4
    doc.setDrawColor(...RULE).setLineWidth(0.2)
    doc.line(MARGIN, y, PAGE.w - MARGIN, y)
    y += 8
  }

  // --- the chart itself ------------------------------------------------------
  const byId = new Map(segments.map((s) => [s.id, s]))
  for (const entry of song) {
    const segment = byId.get(entry.segmentId)
    if (!segment) continue
    const live = readSegment(segment)
    if (!live.key || !live.progression.length) continue

    const repeats = Math.max(1, entry.repeats ?? 1)
    const heading = `${segment.name}${repeats > 1 ? `  (x${repeats})` : ''}`
    const hasLyrics = (live.lyricLines ?? []).some((l) => l && l.trim())

    const bars = groupIntoBars(
      live.progression.map((chord, i) => ({
        chord,
        durationId: live.durations[i],
        inversion: live.inversions[i],
      })),
      live.timeSignature,
    )

    const needed = hasLyrics
      ? 10 + lineCount(live) * 15
      : 10 + Math.ceil(bars.length / barsPerRow(live.timeSignature)) * 18
    if (y + needed > PAGE.h - MARGIN) {
      doc.addPage()
      y = MARGIN
    }

    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ACCENT)
    doc.text(ascii(heading), MARGIN, y)
    // Measure with the font the heading was drawn in — measuring after the
    // switch to the smaller face underestimates the width and the key label
    // lands on top of the section name.
    const headingWidth = doc.getTextWidth(ascii(heading))
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED)
    doc.text(
      `${ascii(prettyName(live.key.tonic))} ${live.key.mode}  ·  ${live.timeSignature}`,
      MARGIN + headingWidth + 4,
      y,
    )
    y += 4

    y = hasLyrics
      ? drawLyricLines(doc, live, y)
      : drawBars(doc, bars, live.key, y, live.timeSignature)
    y += 7
  }

  // The mark, then the wordmark — the same P/notehead the app shows, drawn at
  // print size with the brand's own stroke weight.
  drawMark(doc, MARGIN, PAGE.h - 13, 6)
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...INK)
  doc.text('PICARDY', MARGIN + 8, PAGE.h - 8.4, { charSpace: 0.35 })

  return doc
}

/** Build the chart and hand it to the browser as a download. */
export async function exportChart(options) {
  const doc = await buildChart(options)
  doc.save(`${sanitiseFilename(options.title ?? 'chart')}.pdf`)
  return doc
}

/**
 * The mark, scaled into a box of `size` mm with its top-left at (x, y).
 *
 * Geometry copied exactly from the brand kit — stem, notehead tilted −20°, a
 * 13.5 stroke in a 100-unit box. All three are load-bearing: the tilt is what
 * makes it read as music rather than as a letter, and the ellipse has to overlap
 * the stem or the two shapes read as a bar standing next to an O.
 *
 * jsPDF has no rotated-ellipse primitive, so the notehead is stroked as a closed
 * polyline. Thirty segments is indistinguishable from a curve at print sizes.
 */
function drawMark(doc, x, y, size) {
  const k = size / 100
  doc.setLineCap('round')
  doc.setLineJoin('round')
  doc.setLineWidth(13.5 * k)

  doc.setDrawColor(...INK)
  doc.line(x + 28 * k, y + 24 * k, x + 28 * k, y + 89 * k)

  doc.setDrawColor(...ACCENT)
  const cx = x + 53 * k
  const cy = y + 34 * k
  const rx = 21.5 * k
  const ry = 17 * k
  const angle = (-20 * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const SEGMENTS = 30

  let previous = null
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * Math.PI * 2
    const ex = rx * Math.cos(t)
    const ey = ry * Math.sin(t)
    const point = [cx + ex * cos - ey * sin, cy + ex * sin + ey * cos]
    if (previous) doc.line(previous[0], previous[1], point[0], point[1])
    previous = point
  }

  doc.setLineWidth(0.2)
  doc.setLineCap('butt')
  doc.setLineJoin('miter')
}

function sanitiseFilename(title) {
  const clean = ascii(title).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')
  return clean || 'chart'
}

/** Every distinct chord in the song, in first-appearance order. */
function collectChords(song, segments) {
  const byId = new Map(segments.map((s) => [s.id, s]))
  const seen = new Map()
  for (const entry of song) {
    const segment = byId.get(entry.segmentId)
    if (!segment) continue
    const live = readSegment(segment)
    live.progression.forEach((chord, i) => {
      // Keyed by chord *and* pinned shape: the same chord played two ways
      // deserves two diagrams, not one that silently drops the other.
      const id = `${chordId(chord)}|${live.shapes[i] ?? ''}`
      if (!seen.has(id)) {
        seen.set(id, { chord, inversion: live.inversions[i], shape: live.shapes[i] })
      }
    })
  }
  return [...seen.values()]
}

function barsPerRow() {
  return 4
}

function lineCount(live) {
  return Math.max(live.lyricLines?.length ?? 1, ...live.lines.map((n) => n + 1), 1)
}

/**
 * Chord-over-lyric layout: the words on one row, the chords above them placed
 * where they fall in the line. Chords are positioned proportionally to their
 * beat, which is what makes a chord land mid-word when that is where it was
 * dragged to.
 */
function drawLyricLines(doc, live, startY) {
  let y = startY + 3
  const total = lineCount(live)

  for (let line = 0; line < total; line++) {
    // Chords on this line, with the beat each one starts at.
    const onLine = []
    let cursor = 0
    live.progression.forEach((chord, i) => {
      if ((live.lines[i] ?? 0) !== line) return
      onLine.push({ chord, start: cursor, inversion: live.inversions[i] })
      cursor += live.durations[i]
    })
    const lineBeats = cursor
    const text = ascii(live.lyricLines?.[line] ?? '')
    if (!onLine.length && !text) continue

    if (y + 14 > PAGE.h - MARGIN) {
      doc.addPage()
      y = MARGIN
    }

    // The lyric sets the width to align against; a line with no words still
    // gets a sensible span so its chords do not bunch up.
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK)
    const textWidth = text ? doc.getTextWidth(text) : 0
    const span = Math.max(textWidth, CONTENT_W * 0.4)

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ACCENT)
    let lastRight = -Infinity
    for (const item of onLine) {
      const fraction = lineBeats > 0 ? item.start / lineBeats : 0
      let x = MARGIN + fraction * span
      const label = ascii(chordSymbol(item.chord))
      const width = doc.getTextWidth(label)
      // Never let two chords overlap, however tightly they were placed.
      if (x < lastRight + 1.5) x = lastRight + 1.5
      if (x + width > PAGE.w - MARGIN) break
      doc.text(label, x, y)
      lastRight = x + width
    }

    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK)
    if (text) doc.text(text, MARGIN, y + 5)
    y += text ? 12 : 8
  }

  return y
}

// --- the chart --------------------------------------------------------------

function drawBars(doc, bars, key, startY, timeSignatureId) {
  const perRow = barsPerRow(timeSignatureId)
  const barW = CONTENT_W / perRow
  const barH = 16
  let y = startY

  for (let i = 0; i < bars.length; i += perRow) {
    const row = bars.slice(i, i + perRow)

    if (y + barH > PAGE.h - MARGIN) {
      doc.addPage()
      y = MARGIN
    }

    row.forEach((bar, j) => {
      const x = MARGIN + j * barW
      // Bar line at the left of every bar, plus a closing line on the last one.
      doc.setDrawColor(...RULE).setLineWidth(0.3)
      doc.line(x, y, x, y + barH)
      if (j === row.length - 1) doc.line(x + barW, y, x + barW, y + barH)
      doc.setLineWidth(0.15)
      doc.line(x, y + barH, x + barW, y + barH)

      // Chords sit proportionally to where they fall in the bar.
      const perBar = timeSignatureOf(timeSignatureId).beatsPerBar
      let cursor = 0
      bar.forEach((slot) => {
        const cx = x + 2.5 + (cursor / perBar) * (barW - 4)
        doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK)
        const label = (slot.tiedFromPrevious ? '(' : '') + ascii(chordSymbol(slot.chord)) + (slot.tiedFromPrevious ? ')' : '')
        doc.text(label, cx, y + 7)

        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
        doc.text(ascii(romanNumeral(slot.chord, key, slot.inversion)), cx, y + 12)
        cursor += slot.beats
      })
    })

    y += barH
  }
  return y
}

// --- diagrams ---------------------------------------------------------------

function drawLegend(doc, entries, startY, { instrument, tuning, tuningId, lefty }) {
  const both = instrument === 'both'
  const cellW = both ? CONTENT_W / 4 : CONTENT_W / 6
  const cellH = both ? 40 : 34
  const perRow = Math.floor(CONTENT_W / cellW)
  let y = startY

  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...MUTED)
  doc.text('CHORDS', MARGIN, y)
  y += 4

  entries.forEach((entry, i) => {
    const col = i % perRow
    if (col === 0 && i > 0) y += cellH
    if (y + cellH > PAGE.h - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
    const x = MARGIN + col * cellW

    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK)
    doc.text(ascii(chordSymbol(entry.chord)), x, y + 4)

    let dy = y + 7
    if (instrument === 'guitar' || both) {
      dy = drawGuitarBox(doc, entry.chord, x, dy, cellW - 4, { tuning, tuningId, lefty, pinned: entry.shape })
    }
    if (instrument === 'piano' || both) {
      drawPianoDiagram(doc, entry.chord, x, dy + 1, cellW - 4)
    }
  })

  return y + cellH
}

function drawGuitarBox(doc, chord, x, y, w, { tuning, tuningId, lefty, pinned }) {
  // A shape the player pinned to this chord wins over anything the search would
  // pick — that choice is the whole point of pinning it.
  const pinnedFrets = decodeShape(pinned, tuningId)
  let shape = pinnedFrets ? shapeFromFrets(pinnedFrets, tuning) : null
  if (!shape) {
    const bassPc = pcOf(chordNotes(chord)[0].note)
    let found = findVoicings(chord, { tuning, bassPc, limit: 1 })
    if (!found.length) found = findVoicings(chord, { tuning, bassPc: null, limit: 1 })
    shape = found[0]
  }
  const strings = tuning.length
  const boxW = Math.min(w, 20)
  const colW = boxW / (strings - 1)
  const rows = 4
  const rowH = 4
  const top = y + 3

  if (!shape) {
    doc.setFont('helvetica', 'italic').setFontSize(7).setTextColor(...MUTED)
    doc.text('no shape', x, top + 4)
    return top + rowH * rows + 4
  }

  const fretted = shape.frets.filter((f) => f !== null && f > 0)
  const minF = fretted.length ? Math.min(...fretted) : 1
  const openPosition = minF === 1 && (!fretted.length || Math.max(...fretted) <= 4)
  const start = openPosition ? 1 : minF

  // Nut (thick) or a position number for shapes further up the neck.
  doc.setDrawColor(...INK)
  doc.setLineWidth(openPosition ? 0.9 : 0.2)
  doc.line(x, top, x + boxW, top)
  doc.setLineWidth(0.2)
  for (let r = 1; r <= rows; r++) doc.line(x, top + rowH * r, x + boxW, top + rowH * r)
  for (let s = 0; s < strings; s++) doc.line(x + colW * s, top, x + colW * s, top + rowH * rows)

  if (!openPosition) {
    // Sits outside the low-E edge of the box, which mirrors along with the
    // strings; aligned away from the box so a two-digit fret can't run into it.
    doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...MUTED)
    doc.text(
      String(start),
      lefty ? x + boxW + 1.2 : x - 1.2,
      top + rowH * 0.9,
      { align: lefty ? 'left' : 'right' },
    )
  }

  shape.frets.forEach((f, s) => {
    // Column order mirrors for a left-handed chart, matching the app.
    const column = lefty ? strings - 1 - s : s
    const cx = x + colW * column
    if (f === null || f === 0) {
      doc.setFont('helvetica', 'normal').setFontSize(6).setTextColor(...(f === null ? MUTED : INK))
      doc.text(f === null ? 'x' : 'o', cx - 0.7, top - 1)
      return
    }
    const rowIdx = f - start
    if (rowIdx < 0 || rowIdx >= rows) return
    doc.setFillColor(...INK)
    doc.circle(cx, top + rowH * (rowIdx + 0.5), 1.2, 'F')
  })

  return top + rowH * rows + 3
}

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_OFFSET = { 1: 0.62, 3: 0.72, 6: 0.6, 8: 0.7, 10: 0.8 }

/** One octave of keys with the chord's pitch classes filled in. */
function drawPianoDiagram(doc, chord, x, y, w) {
  const pcs = new Set(chordNotes(chord).map((e) => pcOf(e.note)))
  const whites = WHITE_PCS
  const keyW = Math.min(w, 21) / whites.length
  const keyH = 10
  const blackW = keyW * 0.58
  const blackH = keyH * 0.6

  doc.setDrawColor(...INK).setLineWidth(0.15)
  whites.forEach((pc, i) => {
    const kx = x + i * keyW
    if (pcs.has(pc)) {
      doc.setFillColor(...ACCENT)
      doc.rect(kx, y, keyW, keyH, 'FD')
    } else {
      doc.setFillColor(255, 255, 255)
      doc.rect(kx, y, keyW, keyH, 'FD')
    }
  })

  for (let pc = 0; pc < 12; pc++) {
    if (WHITE_PCS.includes(pc)) continue
    const whiteIndex = whites.indexOf(pc - 1)
    if (whiteIndex < 0) continue
    const kx = x + whiteIndex * keyW + keyW * BLACK_OFFSET[pc]
    doc.setFillColor(...(pcs.has(pc) ? ACCENT : INK))
    doc.rect(kx, y, blackW, blackH, 'F')
  }

  return y + keyH
}

export { ascii }
