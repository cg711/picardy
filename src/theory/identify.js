// Reverse lookup: given a set of sounding notes, what chord is that?

import { mod, pcOf, spellFrom, LETTER_PC } from './notes.js'
import { QUALITIES, makeChord, chordSymbol } from './chords.js'
import { keySteps, prefersFlats } from './keys.js'

// Try the richer qualities first so C E G B reads as Cmaj7, not C6/A-something.
const CANDIDATE_QUALITIES = [
  'maj', 'min', 'dim', 'aug', 'sus2', 'sus4', 'five',
  'six', 'm6', 'maj7', 'dom7', 'm7', 'mMaj7', 'm7b5', 'dim7', 'sevenSus4',
  'add9', 'madd9', 'sixNine', 'maj9', 'dom9', 'm9', 'm11', 'dom13', 'maj13', 'm13', 'dom11',
]

function qualityPcs(qualityId, rootPc) {
  return QUALITIES[qualityId].degrees.map(([, semi]) => mod(rootPc + semi, 12))
}

/**
 * @param midis sounding MIDI notes (order irrelevant; the lowest becomes the bass)
 * @param key   used only to pick a sensible enharmonic spelling
 */
export function identifyChord(midis, key) {
  const notes = [...new Set(midis)].sort((a, b) => a - b)
  if (notes.length < 2) return []
  const pcs = [...new Set(notes.map((m) => mod(m, 12)))]
  const bassPc = mod(notes[0], 12)
  const pcSet = new Set(pcs)

  const results = []
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const qid of CANDIDATE_QUALITIES) {
      const qPcs = new Set(qualityPcs(qid, rootPc))
      const missing = [...qPcs].filter((pc) => !pcSet.has(pc))
      const extra = pcs.filter((pc) => !qPcs.has(pc))
      if (missing.length > 1) continue
      if (extra.length > 1) continue
      if (missing.length && qPcs.size <= 3) continue // don't guess incomplete triads

      let score = 100
      score -= missing.length * 26
      score -= extra.length * 30
      score += qPcs.size * 2
      if (rootPc === bassPc) score += 14
      if (qid === 'maj' || qid === 'min') score += 6

      const root = spellRoot(rootPc, key)
      const bass = rootPc === bassPc ? null : spellRoot(bassPc, key)
      const chord = makeChord(root, qid, [], bass)
      if (!chord) continue
      results.push({ chord, symbol: chordSymbol(chord), score, missing: missing.length, extra: extra.length })
    }
  }

  const seen = new Set()
  return results
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      const s = r.symbol
      if (seen.has(s)) return false
      seen.add(s)
      return true
    })
    .slice(0, 6)
}

/** Spell a pitch class using the key's letters where possible. */
function spellRoot(pc, key) {
  if (key) {
    const steps = keySteps(key)
    for (let i = 0; i < 7; i++) {
      const n = spellFrom(key.tonic, i + 1, steps[i])
      if (pcOf(n) === pc) return n
    }
    // Chromatic: flat keys spell flats, sharp keys spell sharps.
    const flat = prefersFlats(key)
    for (let i = 0; i < 7; i++) {
      const letterPc = LETTER_PC[i]
      if (mod(letterPc + (flat ? -1 : 1), 12) === pc) return { letter: i, acc: flat ? -1 : 1 }
    }
  }
  const idx = LETTER_PC.indexOf(pc)
  if (idx >= 0) return { letter: idx, acc: 0 }
  const below = LETTER_PC.indexOf(mod(pc - 1, 12))
  if (below >= 0) return { letter: below, acc: 1 }
  return { letter: 0, acc: 0 }
}
