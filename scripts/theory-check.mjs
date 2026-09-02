// Regression checks for the theory engine. Run with: npm run check
//
// Not a unit-test framework — just assertions plus a printed dump of the
// rankings, because the interesting failures here are musical judgements that
// are easier to eyeball than to encode.

const B = '../src/'
const { parseChord, chordSymbol, chordNotes, voiceChord, chordId, makeChord, bassOf, inversionLabel, inversionShort, QUALITIES } = await import(B + 'theory/chords.js')
const { makeKey, romanNumeral, nashvilleNumber, detectKey, detectKeyAreas, scaleNotes, harmonicFunction, isDiatonic, keyName } = await import(B + 'theory/keys.js')
const { prettyName, noteName, parseNote, pcOf: pcOfNote } = await import(B + 'theory/notes.js')
const { suggestNext } = await import(B + 'theory/suggest.js')
const { findVoicings, TUNINGS, voicingLabel, tuningKey, normaliseTuning, suggestCapo } = await import(B + 'theory/guitar.js')
const { identifyChord } = await import(B + 'theory/identify.js')
const { generateProgression, FLAVOURS } = await import(B + 'theory/generate.js')
const { groupIntoBars, totalBeats, beatsOf, describeLength, barsAreComplete, TIME_SIGNATURES, timeSignatureOf } = await import(B + 'theory/rhythm.js')
const { flattenSong, songBeats, readSegment, makeSegment } = await import(B + 'lib/song.js')
const { transposeChord, transposeKey, keyPrefersFlats } = await import(B + 'theory/transpose.js')
const { optimiseInversions, progressionMovement, voiceLeadingFaults } = await import(B + 'theory/voicelead.js')
const { scalesForChord, guideTones, commonTones } = await import(B + 'theory/scales.js')
const { reharmonise } = await import(B + 'theory/reharm.js')
const { analyseProgression, cadenceAt, contrapuntalRole, findSequence, fiveSixMove } = await import(B + 'theory/analyze.js')
const { makeQuestion, makeRng, LEVELS: EX_LEVELS, checkNote, positionsFor, weightedTypes } = await import(B + 'theory/exercises.js')
const { intervalBetween, INTERVALS } = await import(B + 'theory/intervals.js')
const { classifyNote, classifyFigure, chordAtBeat, normaliseMelody } = await import(B + 'theory/melody.js')
const { parseChart } = await import(B + 'lib/textimport.js')
const { buildMidi, songToEvents } = await import(B + 'lib/midi.js')
const { encodeShape, decodeShape, shapeFromFrets } = await import(B + 'theory/guitar.js')
const { HUES, BRAND_HUE, makeTheme, contrastRatio, deltaE } = await import(B + 'brand/theme.js')
const { PAGES, routeFor, pageFor, legacyToolPath, TOOL_PATH, lessonSlugFor } = await import(B + 'lib/routes.js')
const { LESSONS, buildExample, exampleItems, allExamples, lessonPath } = await import(B + 'theory/lessons.js')
const { keepInView, isFullyVisible } = await import(B + 'lib/scroll.js')
const { parseMidiMessage } = await import(B + 'lib/midiInput.js')
const { BACKINGS, BACKING_KEYS, buildBacking } = await import(B + 'lib/backings.js')
const { STYLES, barFor, swingBeat, isCompound, pulseOf } = await import(B + 'audio/styles.js')
const { DRUM_VOICES } = await import(B + 'audio/drums.js')
const { unfinished: placeholders } = await import(B + 'pages/site.js')
const { buildMusicXml, progressionToParts, fifthsFor } = await import(B + 'lib/musicxml.js')
const { readFile } = await import('node:fs/promises')

let fails = 0
const eq = (label, got, want) => {
  const ok = got === want
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${got}${ok ? '' : `  (want ${want})`}`)
}

console.log('--- parsing & spelling ---')
const spell = (s) => chordNotes(parseChord(s)).map((e) => prettyName(e.note)).join(' ')
eq('Cmaj7', spell('Cmaj7'), 'C E G B')
eq('F#m7b5', spell('F#m7b5'), 'F♯ A C E')
eq('Bb13', spell('Bb13'), 'B♭ D F A♭ C G')
eq('C7#9', spell('C7#9'), 'C E G B♭ D♯')
eq('Cadd9', spell('Cadd9'), 'C E G D')
eq('Abger6', spell('Abger6'), 'A♭ C E♭ F♯')
eq('Db7 symbol', chordSymbol(parseChord('Db7')), 'D♭7')
eq('D/F# symbol', chordSymbol(parseChord('D/F#')), 'D/F♯')
eq('C6/9 not slash', chordSymbol(parseChord('C6/9')), 'C6/9')
eq('roundtrip Cmaj7#11', chordSymbol(parseChord(chordId(parseChord('Cmaj9#11')))), 'Cmaj9♯11')
eq('garbage rejected', parseChord('Hq7'), null)

console.log('\n--- roman numerals ---')
const C = makeKey('C', 'major')
const Am = makeKey('A', 'minor')
eq('G7 in C', romanNumeral(parseChord('G7'), C), 'V7')
eq('Dm7 in C', romanNumeral(parseChord('Dm7'), C), 'ii7')
eq('Ab in C', romanNumeral(parseChord('Ab'), C), '♭VI')
eq('Bb in C', romanNumeral(parseChord('Bb'), C), '♭VII')
eq('Fm in C', romanNumeral(parseChord('Fm'), C), 'iv')
eq('D7 in C', romanNumeral(parseChord('D7'), C), 'V7/V')
eq('A7 in C', romanNumeral(parseChord('A7'), C), 'V7/ii')
eq('F#dim7 in C', romanNumeral(parseChord('F#dim7'), C), 'vii°7/V')
eq('Db7 in C', romanNumeral(parseChord('Db7'), C), '♭II7')
eq('E7 in Am', romanNumeral(parseChord('E7'), Am), 'V7')
eq('C in Am', romanNumeral(parseChord('C'), Am), '♭III')
eq('Bdim in Am', romanNumeral(parseChord('Bdim'), Am), 'ii°')
eq('G in Am', romanNumeral(parseChord('G'), Am), '♭VII')
console.log('  Bdim in C 1st inv ->', JSON.stringify(romanNumeral(parseChord('Bdim'), C, 1)))
eq('C major scale', scaleNotes(C).map(noteName).join(' '), 'C D E F G A B')
eq('Gb major scale', scaleNotes(makeKey('Gb', 'major')).map(noteName).join(' '), 'Gb Ab Bb Cb Db Eb F')

console.log('\n--- key detection ---')
const det = (chords) => { const k = detectKey(chords.map(parseChord)); return `${noteName(k.tonic)} ${k.mode}` }
eq('C F G C', det(['C', 'F', 'G', 'C']), 'C major')
eq('Am F C G', det(['Am', 'F', 'C', 'G']), 'C major')
eq('Dm7 G7 Cmaj7', det(['Dm7', 'G7', 'Cmaj7']), 'C major')
eq('Am Dm E7 Am', det(['Am', 'Dm', 'E7', 'Am']), 'A minor')

console.log('\n--- suggestions ---')
const show = (key, prog, n = 8) => {
  const s = suggestNext(key, prog.map(parseChord))
  console.log(`  after [${prog.join(' ')}] in ${noteName(key.tonic)} ${key.mode}:`)
  s.slice(0, n).forEach((c) => console.log(`    ${String(Math.round(c.score)).padStart(3)}  ${c.roman.padEnd(12)} ${c.symbol.padEnd(10)} ${c.tier.label.padEnd(12)} ${c.category}`))
  return s
}
const s1 = show(C, [])
const s2 = show(C, ['C'])
const s3 = show(C, ['C', 'Am', 'F'])
const s4 = show(C, ['Dm7'])
const s5 = show(C, ['D7'])
const s6 = show(Am, ['Am', 'F'])
console.log(`  total candidates generated (after C): ${s2.length}`)

const topAfterD7 = s5[0]
eq('D7 in C resolves to a G chord first', topAfterD7.symbol.startsWith('G'), true)
const afterDm7 = s4.findIndex((c) => c.symbol === 'G7')
console.log(`  G7 rank after Dm7: ${afterDm7 + 1}`)
eq('G7 is top-3 after Dm7', afterDm7 >= 0 && afterDm7 < 3, true)
eq('no candidate repeats the previous chord at high score', s2.filter((c) => c.symbol === 'C' && c.score > 20).length, 0)

console.log('\n--- categories present ---')
const cats = new Set(s2.flatMap((c) => c.categories))
console.log('  ', [...cats].join(', '))
for (const need of ['diatonic', 'extension', 'secondary', 'secondaryLT', 'relatedII', 'mixture', 'tritoneSub', 'neapolitan', 'aug6', 'mediant', 'passing', 'backdoor', 'coltrane', 'constant', 'poly', 'pedal']) {
  eq(`  category ${need}`, cats.has(need), true)
}

console.log('\n--- guitar voicings ---')
for (const sym of ['C', 'G', 'Am', 'F', 'Cmaj7', 'F#m7b5', 'Bb13', 'D/F#', 'Cadd9', 'E7#9']) {
  const ch = parseChord(sym)
  const v = findVoicings(ch, { tuning: TUNINGS.standard.strings, limit: 3 })
  console.log(`  ${sym.padEnd(9)} ${v.length} shapes  ${v.map((s) => s.frets.map((f) => (f === null ? 'x' : f)).join('')).join('  |  ')}`)
  if (!v.length) { fails++; console.log(`FAIL no voicing for ${sym}`) }
}
const cShapes = findVoicings(parseChord('C'), { tuning: TUNINGS.standard.strings, limit: 5 })
console.log('  top C shape:', cShapes[0].frets.map((f) => (f === null ? 'x' : f)).join(''), '/', voicingLabel(cShapes[0]))

console.log('\n--- bass and inversion labels ---')
{
  // A slash bass is stated by the symbol, so it wins over the inversion index.
  // Reading the bass off notes[inversion] is how D/F♯ came to be described as
  // "root position — D in the bass".
  const dslash = parseChord('D/F#')
  eq('  D/F# reports F# in the bass', prettyName(bassOf(dslash).note), 'F♯')
  eq('  and calls it the 1st inversion', bassOf(dslash).index, 1)
  eq('  in words', inversionLabel(dslash, 0), '1st inversion — F♯ in the bass')
  eq('  and short', inversionShort(dslash, 0), '1st inv')
  // Even if something sets the inversion to 0, the sounding bass is unchanged.
  eq('  an inversion setting cannot override the symbol', inversionLabel(dslash, 2), '1st inversion — F♯ in the bass')
  // The bass really is the lowest note voiced.
  const voiced = voiceChord(dslash, { bottom: 48 })
  eq('  and it is the lowest note voiced', voiced[0] % 12, 6)

  // A bass that is not a chord tone at all keeps its own description.
  const pedal = parseChord('C/D')
  eq('  C/D bass is not a chord tone', bassOf(pedal).isChordTone, false)
  eq('  so it is not called an inversion', inversionShort(pedal, 0), 'D bass')

  // Plain chords still work off the inversion index.
  const plain = parseChord('C')
  eq('  plain C root position', inversionLabel(plain, 0), 'root position — C in the bass')
  eq('  plain C 1st inversion', inversionLabel(plain, 1), '1st inversion — E in the bass')
  eq('  plain C 2nd inversion', inversionShort(plain, 2), '2nd inv')
}

console.log('\n--- lyrics under chords ---')
{
  const { layoutLine, lineFragments, distributeWords, lineText } = await import(B + 'lib/lyrics.js')
  const { buildChart } = await import(B + 'lib/pdf.js')

  // A monospace stand-in: one unit per character, so positions are countable.
  const measure = (t) => (t ?? '').length
  const frag = (label, text) => ({ label, text, chord: parseChord(label) })

  // The plain case: each chord sits at the start of its own words.
  const simple = layoutLine({
    leadIn: '', measure, spaceWidth: 1, gap: 1,
    fragments: [frag('C', 'hello '), frag('Am', 'darkness')],
  })
  eq('  first chord starts the line', simple.placements[0].x, 0)
  eq('  second sits where its words start', simple.placements[1].x, 'hello '.length)
  eq('  and the words join in order', simple.lyricRow, 'hello darkness')

  // A lead-in pushes the first chord along.
  const lead = layoutLine({
    leadIn: 'I have been ', measure, spaceWidth: 1, gap: 1,
    fragments: [frag('C', 'waiting')],
  })
  eq('  a lead-in offsets the first chord', lead.placements[0].x, 'I have been '.length)

  // Mid-word: two fragments with no space between them.
  const midWord = layoutLine({
    leadIn: '', measure, spaceWidth: 1, gap: 1,
    fragments: [frag('C', 'wait'), frag('Am', 'ing')],
  })
  eq('  a chord can change mid-word', midWord.lyricRow, 'waiting')
  eq('  and lands on the syllable', midWord.placements[1].x, 4)

  // A label wider than its words must not let the next chord collide.
  const tight = layoutLine({
    leadIn: '', measure, spaceWidth: 1, gap: 1,
    fragments: [frag('Cmaj7', 'a'), frag('G', 'b')],
  })
  eq('  a wide label pads the lyric instead of colliding', tight.placements[1].x >= 'Cmaj7'.length + 1, true)
  eq('  and the words are still in order', tight.lyricRow.replace(/ +/g, ' '), 'a b')

  // Pasting a line deals whole words out across the chords on it.
  eq('  pasted words are split across the chords', distributeWords('one two three four', 2).map((s) => s.trim()).join('|'), 'one two|three four')
  eq('  a remainder is spread, not dumped', distributeWords('a b c', 2).map((s) => s.trim()).join('|'), 'a b|c')
  eq('  and no chords means nothing to split', distributeWords('a b', 0).length, 0)

  // Now the same association through the real PDF: the chord must be drawn at
  // the measured start of its own words, in the font the lyric is drawn in.
  const key = makeKey('C', 'major')
  const seg = makeSegment({
    name: 'Verse', key,
    progression: ['C', 'Am'].map(parseChord),
    inversions: [0, 0], durations: [4, 4], timeSignature: '4/4',
    shapes: [null, null], lines: [0, 0],
    lyrics: ['hello ', 'darkness'], leadIns: ['I have been '],
  })
  const doc = await buildChart({ song: [{ segmentId: seg.id, repeats: 1 }], segments: [seg], instrument: 'none' })
  const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1')
  const runs = []
  const re = /([\d.-]+)\s+([\d.-]+)\s+Td\s*\(((?:[^()\\]|\\.)*)\)\s*Tj/g
  let m
  while ((m = re.exec(raw))) runs.push({ x: +m[1], s: m[3] })

  const lyricRun = runs.find((r) => r.s.includes('darkness'))
  eq('  the compiled line is printed whole', lyricRun.s.trim(), 'I have been hello darkness')
  const cRun = runs.find((r) => r.s === 'C')
  const amRun = runs.find((r) => r.s === 'Am')
  // Both chords sit to the right of the line start, and Am to the right of C.
  eq('  chords print in order along the line', cRun.x < amRun.x, true)
  eq('  and the first is offset by the lead-in', cRun.x > lyricRun.x, true)
}

console.log('\n--- exporting one section or all of them ---')
{
  const { makeSegment, flattenSong, flattenMelody, songBeats } = await import(B + 'lib/song.js')
  const verse = makeSegment({
    name: 'Verse', key: makeKey('C', 'major'),
    progression: ['Cmaj7', 'Am7'].map(parseChord), inversions: [0, 0], durations: [4, 4],
    timeSignature: '4/4', shapes: [], lines: [], lyrics: [], leadIns: [],
    melody: [{ at: 0, beats: 1, midi: 64 }],
  })
  const chorus = makeSegment({
    name: 'Chorus', key: makeKey('Eb', 'major'),
    progression: ['Ebmaj7', 'Bb7'].map(parseChord), inversions: [0, 0], durations: [4, 4],
    timeSignature: '4/4', shapes: [], lines: [], lyrics: [], leadIns: [],
    melody: [{ at: 4, beats: 1, midi: 70 }],
  })
  const segs = [verse, chorus]
  const whole = [{ segmentId: verse.id, repeats: 1 }, { segmentId: chorus.id, repeats: 1 }, { segmentId: verse.id, repeats: 1 }]
  const justChorus = [{ segmentId: chorus.id, repeats: 1 }]

  eq('  the whole song is every entry', flattenSong(whole, segs).length, 6)
  eq('  one section is only itself', flattenSong(justChorus, segs).length, 2)
  eq('  and keeps its own key', keyName(flattenSong(justChorus, segs)[0].key), 'E♭ major')

  // The point of a per-section export: the melody rebases to that section's own
  // start instead of staying where it sat in the arrangement.
  eq('  in the whole song the chorus melody is late', flattenMelody(whole, segs).map((n) => n.at).join(','), '0,12,16')
  eq('  taken alone it starts at its own beat 4', flattenMelody(justChorus, segs).map((n) => n.at).join(','), '4')

  eq('  a repeated section is played twice', flattenMelody(whole, segs).filter((n) => n.midi === 64).length, 2)
  eq('  beats add up', songBeats(whole, segs), 24)
  eq('  and a single section is shorter', songBeats(justChorus, segs), 8)
}

console.log('\n--- melody in the chart ---')
{
  const { buildChart } = await import(B + 'lib/pdf.js')
  const { makeSegment } = await import(B + 'lib/song.js')

  const seg = makeSegment({
    name: 'Verse', key: makeKey('C', 'major'),
    progression: ['Cmaj7', 'Am7', 'Dm7', 'G7'].map(parseChord),
    inversions: [0, 0, 0, 0], durations: [4, 4, 4, 4], timeSignature: '4/4',
    shapes: [], lines: [], lyrics: [], leadIns: [],
    melody: [{ at: 0, beats: 2, midi: 64 }, { at: 4, beats: 2, midi: 72 }],
  })
  eq('  a section stores its melody', seg.melody.length, 2)

  const runsOf = async (opts) => {
    const doc = await buildChart({ song: [{ segmentId: seg.id, repeats: 1 }], segments: [seg], instrument: 'none', ...opts })
    const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1')
    const out = []
    const re = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g
    let m
    while ((m = re.exec(raw))) out.push(m[1])
    return out
  }

  const off = await runsOf({ includeMelody: false })
  const on = await runsOf({ includeMelody: true })

  eq('  the chords print either way', on.includes('Cmaj7') && off.includes('Cmaj7'), true)
  eq('  note names appear when the melody is included', on.some((r) => r === 'E4'), true)
  eq('  …and the higher note too', on.some((r) => r === 'C5'), true)
  eq('  but not when it is left out', off.some((r) => r === 'E4' || r === 'C5'), false)

  // A section with no melody must draw no lane whatever the option says.
  const bare = makeSegment({
    name: 'Bare', key: makeKey('C', 'major'),
    progression: ['C'].map(parseChord), inversions: [0], durations: [4],
    timeSignature: '4/4', shapes: [], lines: [], lyrics: [], leadIns: [],
  })
  eq('  a section with no melody stores none', bare.melody.length, 0)
  const bareDoc = await buildChart({ song: [{ segmentId: bare.id, repeats: 1 }], segments: [bare], instrument: 'none', includeMelody: true })
  eq('  and asking for one changes nothing', bareDoc.internal.getNumberOfPages(), 1)
}

console.log('\n--- tunings ---')
{
  const ids = Object.keys(TUNINGS)
  eq('  every tuning has a name and strings', ids.every((id) => TUNINGS[id].name && TUNINGS[id].strings.length >= 4), true)
  eq('  and strings run low to high', ids.every((id) => TUNINGS[id].strings.every((m, i, a) => i === 0 || m >= a[i - 1])), true)
  console.log(`     ${ids.length} presets, string counts: ${[...new Set(ids.map((id) => TUNINGS[id].strings.length))].sort().join(', ')}`)

  // Every preset has to be able to voice a plain major triad, or it is not a
  // usable tuning in this app whatever it is called.
  const dead = ids.filter((id) => !findVoicings(parseChord('C'), { tuning: TUNINGS[id].strings, limit: 1 }).length)
  eq('  every preset can voice a C major triad', dead.join(','), '')
  // And something harder, on the extended-range ones especially.
  const deadJazz = ids.filter((id) => !findVoicings(parseChord('Cmaj7'), { tuning: TUNINGS[id].strings, limit: 1 }).length)
  eq('  and a Cmaj7', deadJazz.join(','), '')

  // A seven-string grip really uses seven strings.
  const seven = findVoicings(parseChord('C'), { tuning: TUNINGS.sevenString.strings, limit: 1 })[0]
  eq('  a 7-string shape has 7 slots', seven.frets.length, 7)

  // Custom tunings: normalisation, and the identity that guards pinned shapes.
  eq('  a custom tuning is clamped to playable strings', normaliseTuning([0, 999, 45]).every((m) => m >= 24 && m <= 76), true)
  eq('  and padded to at least four', normaliseTuning([40]).length >= 4, true)
  eq('  and capped at eight', normaliseTuning(new Array(20).fill(40)).length, 8)

  const keyA = tuningKey('custom', [40, 45, 50, 55, 59, 64])
  const keyB = tuningKey('custom', [38, 45, 50, 55, 59, 64])
  eq('  a preset keeps its own id', tuningKey('dropD', [1, 2]), 'dropD')
  eq('  two different custom tunings get different keys', keyA === keyB, false)
  eq('  and the key carries no colon', keyA.includes(':'), false)

  // The point of that: retuning one string must not keep shapes found on the old
  // tuning, since the same frets now sound different notes.
  const shape = findVoicings(parseChord('C'), { tuning: [40, 45, 50, 55, 59, 64], limit: 1 })[0]
  const stamped = encodeShape(shape, keyA)
  eq('  a shape pinned under one custom tuning decodes there', decodeShape(stamped, keyA) !== null, true)
  eq('  and is rejected after retuning a string', decodeShape(stamped, keyB), null)
}

console.log('\n--- inversions on guitar ---')
const g = parseChord('C')
const notes = chordNotes(g)
notes.forEach((n, i) => {
  const { pcOf } = { pcOf: (nn) => (([0,2,4,5,7,9,11][nn.letter] + nn.acc) % 12 + 12) % 12 }
  const v = findVoicings(g, { tuning: TUNINGS.standard.strings, bassPc: pcOf(n.note), limit: 2 })
  console.log(`  bass ${prettyName(n.note)}: ${v.length} shapes ${v.map((s) => s.frets.map((f) => (f === null ? 'x' : f)).join('')).join(' | ')}`)
})

console.log('\n--- piano voicings / inversions ---')
for (let inv = 0; inv < 4; inv++) {
  console.log(`  Cmaj7 inv ${inv}:`, voiceChord(parseChord('Cmaj7'), { inversion: inv, bottom: 52 }).join(' '))
}
console.log('  D/F#:', voiceChord(parseChord('D/F#'), { bottom: 52 }).join(' '))

console.log('\n--- identify ---')
const idf = (midis) => identifyChord(midis, C).slice(0, 3).map((r) => r.symbol).join(', ')

console.log('  60 64 67    ->', idf([60, 64, 67]))
console.log('  60 64 67 71 ->', idf([60, 64, 67, 71]))
console.log('  59 62 65 68 ->', idf([59, 62, 65, 68]))
console.log('  57 60 64 67 ->', idf([57, 60, 64, 67]))

console.log('\n--- polychord ---')
const poly = suggestNext(C, [parseChord('Dm7')]).filter((c) => c.category === 'poly')
poly.slice(0, 3).forEach((p) => console.log(`  ${p.symbol}  ${p.roman}  ${Math.round(p.score)}`))
console.log('  poly notes:', chordNotes(poly[0].chord).map((e) => prettyName(e.note)).join(' '))

console.log('\n--- generated progressions ---')
{
  const keys = [makeKey('C', 'major'), makeKey('A', 'minor'), makeKey('Eb', 'major'), makeKey('F#', 'minor')]
  let runs = 0, adjacentId = 0, adjacentRoot = 0, tooShort = 0
  let minLen = Infinity, maxLen = 0
  const cadences = new Set(), flavours = new Set()
  const rootPc = (c) => (([0, 2, 4, 5, 7, 9, 11][c.root.letter] + c.root.acc) % 12 + 12) % 12

  for (const key of keys) {
    for (let i = 0; i < 250; i++) {
      const r = generateProgression(key, { flavour: 'any' })
      runs++
      cadences.add(r.cadence)
      flavours.add(r.flavour)
      const ids = r.progression.map(chordId)
      minLen = Math.min(minLen, ids.length)
      maxLen = Math.max(maxLen, ids.length)
      if (ids.length < 3) tooShort++
      for (let j = 1; j < ids.length; j++) {
        if (ids[j] === ids[j - 1]) adjacentId++
        if (rootPc(r.progression[j]) === rootPc(r.progression[j - 1])) adjacentRoot++
      }
    }
  }
  console.log(`  ${runs} progressions, lengths ${minLen}-${maxLen}`)
  eq('  no two identical chords in a row', adjacentId, 0)
  eq('  no two chords on the same root in a row', adjacentRoot, 0)
  eq('  none shorter than 3 chords', tooShort, 0)
  eq('  every flavour reachable', flavours.size, Object.keys(FLAVOURS).length)
  console.log(`  distinct cadences used: ${cadences.size} (${[...cadences].join(', ')})`)

  for (const key of [makeKey('C', 'major'), makeKey('A', 'minor')]) {
    for (const flavour of Object.keys(FLAVOURS)) {
      const r = generateProgression(key, { flavour })
      const label = `${noteName(key.tonic)} ${key.mode}`
      console.log(`  ${label.padEnd(9)} ${flavour.padEnd(10)} ${r.progression.map((c) => chordSymbol(c)).join(' - ').padEnd(46)} | ${r.progression.map((c) => romanNumeral(c, key)).join(' ')}`)
      console.log(`  ${' '.repeat(20)}ends on ${r.cadenceLabel}`)
    }
  }
}

console.log('\n--- canonical guitar shapes ---')
{
  // The grips every guitarist already knows. If a scoring or playability change
  // buries one of these, it broke something.
  const canonical = {
    C: 'x,3,2,0,1,0', G: '3,2,0,0,0,3', D: 'x,x,0,2,3,2', A: 'x,0,2,2,2,0',
    E: '0,2,2,1,0,0', Am: 'x,0,2,2,1,0', Em: '0,2,2,0,0,0', Dm: 'x,x,0,2,3,1',
    F: '1,3,3,2,1,1', Bb: 'x,1,3,3,3,1', Bm: 'x,2,4,4,3,2', 'F#m': '2,4,4,2,2,2',
    Cmaj7: 'x,3,2,0,0,0', Am7: 'x,0,2,0,1,0', G7: '3,2,0,0,0,1', D7: 'x,x,0,2,1,2',
    E7: '0,2,0,1,0,0', Dm7: 'x,x,0,2,1,1', Bm7: 'x,2,0,2,0,2', Amaj7: 'x,0,2,1,2,0',
    Cadd9: 'x,3,2,0,3,0', 'F#m7b5': 'x,x,4,5,5,5',
  }
  const fmt = (s) => s.frets.map((f) => (f === null ? 'x' : f)).join(',')
  const rootPc = (c) => (([0, 2, 4, 5, 7, 9, 11][c.root.letter] + c.root.acc) % 12 + 12) % 12
  let shown = 0
  for (const [sym, want] of Object.entries(canonical)) {
    const chord = parseChord(sym)
    const shapes = findVoicings(chord, { tuning: TUNINGS.standard.strings, bassPc: rootPc(chord) })
    if (shapes.map(fmt).includes(want)) shown++
    else console.log(`  MISSING from the shown list: ${sym} ${want}`)
  }
  eq('  every canonical shape is shown', shown, Object.keys(canonical).length)

  // Position spread: ranking by score alone buries every barre shape up the neck.
  const cShapes = findVoicings(parseChord('C'), { tuning: TUNINGS.standard.strings, bassPc: 0 })
  const positions = new Set(cShapes.map((s) => s.position))
  console.log(`  C major: ${cShapes.length} of ${cShapes.total} grips, positions ${[...positions].sort((a, b) => a - b).join(', ')}`)
  eq('  C major spans at least 5 neck positions', positions.size >= 5, true)
  eq('  no shape mixes an open string with a barre', cShapes.every((s) => !(s.barre && s.frets.includes(0))), true)
}

console.log('\n--- handedness: the two diagrams must agree ---')
{
  // Both diagrams derive their layout from the same rule, so assert the rule
  // rather than the pixels: string index -> column, and fret -> horizontal
  // direction. A right-handed neck puts low E (string 0) on the left of a chord
  // box and the nut on the left of the neck; a lefty mirrors both together.
  const columnOf = (stringIndex, nStrings, lefty) => (lefty ? nStrings - 1 - stringIndex : stringIndex)
  const nutIsLeft = (lefty) => !lefty

  for (const lefty of [false, true]) {
    const lowEColumn = columnOf(0, 6, lefty)
    const highEColumn = columnOf(5, 6, lefty)
    const label = lefty ? 'left-handed' : 'right-handed'
    // Low E and the nut sit on the same side as each other in both diagrams.
    const boxLowEOnLeft = lowEColumn < highEColumn
    eq(`  ${label}: chord box low E on the ${lefty ? 'right' : 'left'}`, boxLowEOnLeft, !lefty)
    eq(`  ${label}: neck nut on the ${lefty ? 'right' : 'left'}`, nutIsLeft(lefty), !lefty)
    eq(`  ${label}: box and neck agree`, boxLowEOnLeft === nutIsLeft(lefty), true)
  }

  // Mirroring must be an involution: flipping twice returns the original.
  const twice = columnOf(columnOf(2, 6, true), 6, true)
  eq('  mirroring twice is the identity', twice, 2)
}

console.log('\n--- rhythm: bars and ties ---')
{
  const items = (durations) => durations.map((d, i) => ({ durationId: d, i }))

  // Four whole notes in 4/4 = four bars, one chord each, nothing tied.
  let bars = groupIntoBars(items(['1', '1', '1', '1']), '4/4')
  eq('  4 whole notes make 4 bars', bars.length, 4)
  eq('  none of them tied', bars.flat().filter((s) => s.tiedFromPrevious).length, 0)

  // Two halves share a bar.
  bars = groupIntoBars(items(['2', '2', '2', '2']), '4/4')
  eq('  4 half notes make 2 bars', bars.length, 2)
  eq('  first bar holds 2 chords', bars[0].length, 2)

  // A whole note in 3/4 has to spill over the bar line and be tied.
  bars = groupIntoBars(items(['1']), '3/4')
  eq('  a whole note in 3/4 spans 2 bars', bars.length, 2)
  eq('  the continuation is marked tied', bars[1][0].tiedFromPrevious, true)
  eq('  the two halves add up', bars[0][0].beats + bars[1][0].beats, 4)

  // Every bar except a trailing partial must be exactly full.
  const perBar = 4
  bars = groupIntoBars(items(['2', '4', '8', '8', '1', '1']), '4/4')
  const fullBars = bars.slice(0, -1)
  eq('  every complete bar is exactly full',
    fullBars.every((b) => Math.abs(b.reduce((n, s) => n + s.beats, 0) - perBar) < 1e-9), true)

  eq('  totalBeats adds durations', totalBeats(['1', '2', '4']), 7)
  eq('  16th is a quarter of a beat', beatsOf('16'), 0.25)
  eq('  4 bars of 4/4 reported', describeLength(['1', '1', '1', '1'], '4/4'), '4 bars')
  eq('  incomplete bar detected', barsAreComplete(['1', '2'], '4/4'), false)

  // A zero-length duration must not spin the bar grouper forever.
  const guarded = groupIntoBars([{ durationId: 'nonsense' }], '4/4')
  eq('  unknown duration falls back instead of looping', guarded.length >= 1, true)
}

console.log('\n--- song arrangement ---')
{
  const verse = { id: 'a', name: 'Verse', key: 'C', timeSignature: '4/4', chords: ['C', 'Am', 'F', 'G7'], inversions: [0, 0, 0, 0], durations: ['1', '1', '1', '1'] }
  const chorus = { id: 'b', name: 'Chorus', key: 'Eb', timeSignature: '4/4', chords: ['Eb', 'Cm', 'Ab', 'Bb7'], inversions: [0, 0, 0, 0], durations: ['1', '1', '1', '1'] }
  const segments = [verse, chorus]
  const song = [{ segmentId: 'a', repeats: 2 }, { segmentId: 'b', repeats: 1 }]

  const flat = flattenSong(song, segments)
  eq('  repeats expand', flat.length, 12)
  eq('  total beats', songBeats(song, segments), 48)
  eq('  entry index maps back to the arrangement', flat[11].entryIndex, 1)

  // Each section keeps its own key, so numerals stay right through a modulation.
  eq('  verse chord reads in C', romanNumeral(flat[0].chord, flat[0].key), 'I')
  eq('  chorus chord reads in its own key', romanNumeral(flat[8].chord, flat[8].key), 'I')
  eq('  chorus really is in Eb', noteName(flat[8].key.tonic), 'Eb')

  // A dangling reference must not throw or produce holes.
  const dangling = flattenSong([{ segmentId: 'gone', repeats: 3 }, { segmentId: 'a', repeats: 1 }], segments)
  eq('  missing segment skipped', dangling.length, 4)

  // Round-tripping a segment preserves everything that matters.
  const key = makeKey('F#', 'minor')
  const built = makeSegment({
    name: 'Bridge', key,
    progression: ['F#m', 'D', 'A', 'E'].map(parseChord),
    inversions: [0, 1, 0, 0], durations: ['2', '2', '1', '1'], timeSignature: '3/4',
    lines: [0, 0, 1, 1], leadIns: ['first line', 'second line'], lyrics: ['a', 'b', 'c', 'd'],
  })
  const back = readSegment(built)
  eq('  round-trip keeps the key', noteName(back.key.tonic) + ' ' + back.key.mode, 'F# minor')
  eq('  round-trip keeps the metre', back.timeSignature, '3/4')
  eq('  round-trip keeps inversions', back.inversions.join(','), '0,1,0,0')
  // Preset ids normalise to beats on the way in: '2' is a half note (2 beats),
  // '1' a whole note (4).
  eq('  round-trip normalises durations to beats', back.durations.join(','), '2,2,4,4')
  eq('  round-trip keeps the lead-ins', back.leadIns.join('|'), 'first line|second line')
  eq('  round-trip keeps the words under each chord', back.lyrics.join('|'), 'a|b|c|d')
  eq('  round-trip keeps each chord\'s line', back.lines.join(','), '0,0,1,1')
  eq('  round-trip keeps chords', back.progression.map((c) => chordSymbol(c)).join(' '), 'F♯m D A E')
}

console.log('\n--- transpose ---')
{
  const from = makeKey('C', 'major')
  // Diatonic and applied chords must keep their function exactly.
  const functional = ['Cmaj7', 'Am7', 'Dm7', 'G7', 'A7', 'F#m7b5', 'D/F#', 'Fm']
  const pcsOf = (chord) => chordNotes(chord).map((e) => (([0, 2, 4, 5, 7, 9, 11][e.note.letter] + e.note.acc) % 12 + 12) % 12).sort().join(',')

  // The pitches are the non-negotiable part: whatever spelling is chosen, the
  // chord must sound like the original moved by the interval.
  let wrongPitches = 0
  let respelled = 0
  for (let semis = 1; semis <= 11; semis++) {
    const to = transposeKey(from, semis)
    for (const sym of functional) {
      const before = parseChord(sym)
      const after = transposeChord(before, from, to)
      const expected = pcsOf(before).split(',').map((n) => (Number(n) + semis) % 12).sort().join(',')
      if (pcsOf(after) !== expected) wrongPitches++
      // The numeral only shifts when readability forced an enharmonic respell.
      if (romanNumeral(before, from) !== romanNumeral(after, to)) respelled++
    }
  }
  eq('  transposition always preserves the pitches', wrongPitches, 0)
  // Fm in D♭ is G♭m, whose third is B𝄫 — respelling to F♯m is the deliberate
  // trade, so a couple of numerals shifting is expected, not a regression.
  eq('  and preserves the numeral except where a double accidental forced a respell',
    respelled <= 2, true)
  console.log(`  ${respelled} of ${functional.length * 11} chord/key pairs needed an enharmonic respell`)

  // No key should ever need a double accidental.
  let doubleKeys = 0
  for (let semis = 0; semis < 12; semis++) {
    if (scaleNotes(transposeKey(from, semis)).some((n) => Math.abs(n.acc) > 1)) doubleKeys++
  }
  eq('  no transposed key needs a double sharp or flat', doubleKeys, 0)

  // Transposing must not drift: stepping up twelve semitones returns the
  // original spelling, which is what caught the compounding bug.
  let key = from
  let chords = functional.map(parseChord)
  for (let i = 0; i < 12; i++) {
    const next = transposeKey(key, 1)
    chords = chords.map((c) => transposeChord(c, key, next))
    key = next
  }
  eq('  a full chromatic cycle returns the original spelling',
    chords.map((c) => chordSymbol(c)).join(' '),
    functional.map((x) => chordSymbol(parseChord(x))).join(' '))

  // Ordinary chords should never print a double accidental in any key. German
  // sixths are excluded: on some roots every enharmonic spelling needs one.
  let ugly = []
  for (let semis = 1; semis <= 11; semis++) {
    const to = transposeKey(from, semis)
    for (const sym of functional) {
      const moved = transposeChord(parseChord(sym), from, to)
      if (chordNotes(moved).some((e) => Math.abs(e.note.acc) > 1)) ugly.push(`${sym}->${chordSymbol(moved)}`)
    }
  }
  eq('  no ordinary chord transposes to a double accidental', ugly.join(','), '')

}

console.log('\n--- voice leading ---')
{
  let worse = 0
  for (const syms of [['C', 'Am', 'F', 'G7'], ['Cmaj7', 'A7', 'Dm7', 'G7', 'Cmaj7'], ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db']]) {
    const prog = syms.map(parseChord)
    const rootPosition = progressionMovement(prog, prog.map(() => 0))
    const optimised = progressionMovement(prog, optimiseInversions(prog, { lockFirst: true }))
    if (optimised > rootPosition + 1e-9) worse++
  }
  eq('  optimising never increases voice movement', worse, 0)

  // A slash chord's bass is the user's choice and must not be reinverted.
  const withSlash = ['C', 'G/B', 'Am'].map(parseChord)
  eq('  slash chords keep their bass', optimiseInversions(withSlash)[1], 0)
}

console.log('\n--- chord scales ---')
{
  const C = makeKey('C', 'major')
  const Am = makeKey('A', 'minor')
  const expected = [
    ['Cmaj7', C, 'Ionian (major)'], ['Dm7', C, 'Dorian'], ['Em7', C, 'Phrygian'],
    ['Fmaj7', C, 'Lydian'], ['G7', C, 'Mixolydian'], ['Am7', C, 'Aeolian (natural minor)'],
    ['Bm7b5', C, 'Locrian'], ['G7alt', C, 'Altered (super-Locrian)'],
    ['Db7', C, 'Lydian dominant'], ['Bb7', C, 'Lydian dominant'],
    ['Bdim7', C, 'Whole-half diminished'], ['E7', Am, 'Phrygian dominant'],
  ]
  let wrong = 0
  for (const [sym, key, want] of expected) {
    const got = scalesForChord(parseChord(sym), key)[0]
    if (!got || got.name !== want) {
      wrong++
      console.log(`  MISMATCH ${sym}: ${got?.name} (want ${want})`)
    }
  }
  eq('  every chord-scale default matches convention', wrong, 0)

  // Whatever is offered must actually contain the chord.
  let bad = 0
  for (const sym of ['Cmaj7', 'G7alt', 'F#m7b5', 'Bb13', 'E7#9', 'Cdim7', 'Caug']) {
    const chord = parseChord(sym)
    const chordPcs = new Set(chordNotes(chord).map((e) => (([0, 2, 4, 5, 7, 9, 11][e.note.letter] + e.note.acc) % 12 + 12) % 12))
    for (const scale of scalesForChord(chord, C)) {
      if (![...chordPcs].every((pc) => scale.pcs.includes(pc))) bad++
    }
  }
  eq('  every suggested scale contains the whole chord', bad, 0)

  eq('  guide tones of G7 are its 3rd and 7th', guideTones(parseChord('G7')).map((e) => e.degree).join(','), '3,7')
  eq('  G7 and Cmaj7 share two notes', commonTones(parseChord('G7'), parseChord('Cmaj7')).length, 2)
}

console.log('\n--- reharmonisation ---')
{
  const C = makeKey('C', 'major')
  const prog = ['C', 'Am', 'F', 'G7'].map(parseChord)
  const r = reharmonise(prog, 3, C)
  eq('  G7 offers substitutions', r.replace.length > 0, true)
  eq('  including the tritone sub', r.replace.some((e) => chordSymbol(e.chord) === 'A♭7'), true)
  eq('  and chords to insert', r.insert.length > 0, true)
  // The two lists are independent: the same chord means different things in each.
  eq('  A♭7 appears as both a swap and an insert', r.insert.some((e) => chordSymbol(e.chord) === 'A♭7'), true)
  eq('  nothing suggests the chord it is replacing', r.replace.every((e) => chordId(e.chord) !== chordId(prog[3])), true)
}

console.log('\n--- analysis ---')
{
  const cases = [
    ['| Dm7 G7 | Cmaj7 |', 'C major', 'perfect authentic cadence'],
    ['| Am | F | C | G |', 'C major', 'half cadence'],
    ['| Cmaj7 | Fm7 | Bb7 | Cmaj7 |', 'C major', 'backdoor cadence'],
    ['| Am | Dm | E7 | Am |', 'A minor', 'perfect authentic cadence'],
  ]
  for (const [chart, wantKey, wantCadence] of cases) {
    const a = analyseProgression(parseChart(chart).chords)
    eq(`  ${chart} reads as ${wantKey}`, a.keyName, wantKey)
    eq('    and finds the ' + wantCadence, a.observations.some((o) => o.text.includes(wantCadence)), true)
  }
  // A minor-key V7 is normal, not borrowed colour.
  const minor = analyseProgression(parseChart('| Am | Dm | E7 | Am |').chords)
  eq('  minor V7 is not reported as chromatic', minor.observations.some((o) => o.kind === 'mixture'), false)

  // The cadence table is first-match-wins, and each of these also satisfies a
  // looser pattern in the same table: iv-I is also IV-I, bVII7-i is also the
  // Aeolian bVII-i, and iv-V is also "lands on V". Reordering the table so a
  // general pattern comes first makes the specific one unreachable — which is
  // invisible in the output, since you still get *a* plausible cadence name.
  const named = [
    ['| C | F | Fm | C |', makeKey('C', 'major'), 'minor plagal cadence'],
    ['| C | Am | F | C |', makeKey('C', 'major'), 'plagal cadence'],
    ['| Am | Dm | E |', makeKey('A', 'minor'), 'Phrygian half cadence'],
    ['| Am | G7 | Am |', makeKey('A', 'minor'), 'backdoor cadence'],
    ['| Am | G | Am |', makeKey('A', 'minor'), 'Aeolian cadence'],
    ['| C | F | G |', makeKey('C', 'major'), 'half cadence'],
  ]
  for (const [chart, key, want] of named) {
    const a = analyseProgression(parseChart(chart).chords, key)
    eq(`  ${chart} ends on the ${want}`, a.observations.some((o) => o.text.includes(want)), true)
  }
}

// The one chord whose spelling and whose function disagree. harmonicFunction
// sees a tonic triad and says tonic, which is right about the notes and wrong
// about the music; the figure is only visible with the next chord and the
// inversions in hand.
console.log('\n--- cadential 6/4 ---')
{
  const C = makeKey('C', 'major')
  const Am = makeKey('A', 'minor')
  const chords = (chart) => parseChart(chart).chords
  const read = (chart, key, invs) => analyseProgression(chords(chart), key, invs)

  // I 6/4 - V - I in C: the first chord spells C major and functions as V.
  const cad = read('| C | G | C |', C, [2, 0, 0])
  eq('  the 6/4 is counted as dominant, not tonic', cad.chords[0].fn, 'D')
  eq('  …and is labelled', cad.chords[0].sixFour, 'cadential 6/4')
  eq('  …and reads as V 6/4', cad.chords[0].readAs, 'V 6/4')
  eq('  …and the numeral still says what is spelled', cad.chords[0].roman, 'I 6/4')
  eq('  …and it is explained', cad.observations.some((o) => o.kind === 'six-four'), true)
  // harmonicFunction on its own is unchanged: it sees one chord and no context.
  eq('  the per-chord function is left alone', harmonicFunction(chords('| C |')[0], C), 'T')

  // In minor too.
  const min = read('| Am | E | Am |', Am, [2, 0, 0])
  eq('  minor: i 6/4 before V is dominant', min.chords[0].fn, 'D')

  // Everything that must NOT match.
  eq('  root position is a real tonic', read('| C | G |', C, [0, 0]).chords[0].fn, 'T')
  eq('  first inversion is a real tonic', read('| C | G |', C, [1, 0]).chords[0].fn, 'T')
  eq('  a 6/4 that does not go to V is a real tonic', read('| C | F |', C, [2, 0]).chords[0].fn, 'T')
  eq('  a 6/4 over a V that is itself inverted does not count', read('| C | G |', C, [2, 1]).chords[0].fn, 'T')
  eq('  a IV 6/4 is not this figure', read('| F | G |', C, [2, 0]).chords[0].fn, 'PD')
  eq('  a seventh chord is not this figure', read('| Cmaj7 | G |', C, [2, 0]).chords[0].sixFour, null)
  eq('  the last chord has nothing to resolve to', read('| G | C |', C, [0, 2]).chords[1].sixFour, null)
  // No inversions at all — an import with no voicing gets the old reading
  // rather than a guess.
  eq('  without inversions nothing is claimed', read('| C | G |', C, null).chords[0].sixFour, null)

  // Figured bass in the numerals is what makes "6/4" sayable at all, and the
  // chips have always shown it — this panel used to say "I" beside a chip
  // reading "I 6/4".
  // Picardy keeps the quality suffix beside the figures — "V7 6/5" where most
  // textbooks let the figures imply the seventh and write "V6/5". Redundant
  // rather than wrong, pre-dates this work, and changing it would move every
  // inverted seventh in the app; left alone deliberately.
  eq('  numerals carry figured bass when inversions are known', read('| G7 | C |', C, [1, 0]).chords[0].roman, 'V7 6/5')
  // ...which puts a slash in numerals that never had one. An applied chord's
  // slash is followed by a roman numeral, a figured bass's by a digit; testing
  // for the slash alone now reports every inverted dominant as applied.
  eq('  an inverted V7 is not an applied chord', read('| G7 | C |', C, [1, 0]).chords[0].applied, false)
  eq('  …and no tonicisation is claimed', read('| G7 | C |', C, [1, 0]).observations.some((o) => o.kind === 'tonicisation'), false)
  eq('  a real applied chord still is one', read('| C | A7 | Dm |', C, [0, 0, 0]).chords[1].applied, true)

  // The rest of the panel has to agree with the new reading. A progression
  // opening on a cadential 6/4 does not open on the tonic, whatever the numeral
  // spells.
  const opens = read('| C | G | C |', C, [2, 0, 0]).observations.find((o) => o.kind === 'shape')
  eq('  a 6/4 opening is not reported as establishing the key', /opens on the tonic/.test(opens.text), false)
  eq('  …it is reported as opening on the dominant', /starts on the dominant/.test(opens.text), true)
  eq('  a real tonic opening still is one', /opens on the tonic/.test(read('| C | G |', C, [0, 0]).observations.find((o) => o.kind === 'shape').text), true)

  // Two of the nine cadence labels start with a vowel.
  const vowel = read('| C | F | G | C |', C, [0, 0, 0, 0]).observations.find((o) => o.kind === 'cadence')
  eq('  "an authentic cadence", not "a authentic cadence"', /Ends on an authentic/.test(vowel.text), true)
  eq('  …and consonants keep "a"', /Ends on a perfect/.test(read('| Dm7 G7 | Cmaj7 |', C, null).observations.find((o) => o.kind === 'cadence').text), true)
}

console.log('\n--- exercises ---')
{
  // Sweeping seeds rather than checking one question: the failures that matter
  // here are rare draws — a distractor that happens to equal the answer, a key
  // where a builder cannot find four options — and they only show up in bulk.
  const problems = []
  const typesSeen = new Map()
  let built = 0

  for (const level of EX_LEVELS) {
    for (let seed = 1; seed <= 120; seed++) {
      const rng = makeRng(seed * 97)
      for (let n = 0; n < 12; n++) {
        const q = makeQuestion(level.id, rng)
        if (!q) { problems.push(`${level.id}: makeQuestion gave up at seed ${seed}`); continue }
        built++
        typesSeen.set(q.type, (typesSeen.get(q.type) ?? 0) + 1)

        const where = `${level.id}/${q.type} seed ${seed}`
        if (!q.prompt || !q.explain) problems.push(`${where}: missing prompt or explanation`)
        if (/undefined|NaN|\[object/.test(q.prompt + q.explain + q.options.join(''))) {
          problems.push(`${where}: placeholder leaked into the text`)
        }
        // Something has to be presentable: chords to voice, notes to play, or an
        // instrument to look at.
        if (!q.chords?.length && !q.play?.length && !q.instrument) {
          problems.push(`${where}: nothing to play and nothing to show`)
        }

        if (q.input === 'instrument') {
          if (q.options.length) problems.push(`${where}: instrument question also carries options`)
          const target = q.answerMidi ?? null
          if (target != null && !positionsFor(q.instrument, target).length) {
            problems.push(`${where}: the answer ${target} is not reachable on the ${q.instrument}`)
          }
          if (target != null && !checkNote(q, target)) problems.push(`${where}: checkNote rejects its own answer`)
          if (q.answerPcs?.length) {
            const anywhere = q.instrument === 'piano' ? 60 : 52
            const m = anywhere - ((anywhere - q.answerPcs[0]) % 12 + 12) % 12
            if (!checkNote(q, m)) problems.push(`${where}: checkNote rejects a note of the right pitch class`)
          }
          if (q.reference != null && !positionsFor(q.instrument, q.reference).length) {
            problems.push(`${where}: the reference ${q.reference} is off the ${q.instrument}`)
          }
        } else {
          if (new Set(q.options).size !== q.options.length) problems.push(`${where}: duplicate options — ${q.options.join(' | ')}`)
          if (q.options.length < 3) problems.push(`${where}: only ${q.options.length} options`)
          if (q.options[q.answerIndex] !== q.answer) problems.push(`${where}: answerIndex points at the wrong option`)
        }

        // A listening question must not print what it is about to play, and its
        // options must not contain two things that sound identical.
        if (q.secret) {
          if (!q.play?.length) problems.push(`${where}: a listening question with nothing to hear`)
          if (q.options.some((o) => q.prompt.includes(o))) problems.push(`${where}: the prompt gives the answer away`)
        }
        // Anything held back until after the answer must not be in the sound the
        // question offers up front.
        if (q.playAnswer && q.play) {
          const upFront = new Set(q.play.flat())
          if (q.answerMidi != null && upFront.has(q.answerMidi)) {
            problems.push(`${where}: the answer note is audible before answering`)
          }
        }
        // A degree question is only a degree question if the key was planted
        // first: without the cadence it is interval training from an arbitrary
        // pitch, which is a different skill with a different answer.
        if (q.type === 'degree') {
          const played = q.play ?? []
          if (played.length < 3) problems.push(`${where}: no cadence to establish the key`)
          const last = played[played.length - 1]
          const note = Array.isArray(last) ? last : last?.midis
          if (!note || note.length !== 1) problems.push(`${where}: the thing to name is not a single note`)
          else {
            // Re-derive: the note really is that degree above the key's tonic.
            const semis = ((note[0] - pcOfNote(q.key.tonic)) % 12 + 12) % 12
            const want = { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' }[semis]
            if (want !== q.answer) problems.push(`${where}: says degree ${q.answer}, sounds ${want ?? semis}`)
          }
          if (q.key.mode !== 'major') problems.push(`${where}: minor has two sixths and sevenths, so the degree is ambiguous`)
        }
        if (q.type === 'earChord') {
          // Two qualities that are the same pitch set from one root would be
          // indistinguishable however good the ear.
          const sets = q.options.map((name) => {
            const id = Object.keys(QUALITIES).find((k) => QUALITIES[k].name === name)
            return id ? chordNotes(makeChord(parseNote('C'), id)).map((e) => (pcOfNote(e.note))).sort((x, y) => x - y).join(',') : name
          })
          if (new Set(sets).size !== sets.length) problems.push(`${where}: two qualities sound alike — ${q.options.join(' | ')}`)
        }
        if (q.type === 'earInterval') {
          const semis = q.options.map((name) => INTERVALS.find((i) => i.name === name)?.semitones)
          if (new Set(semis).size !== semis.length) {
            problems.push(`${where}: two options sound the same — ${q.options.join(' | ')}`)
          }
        }
        // The level's own vocabulary: Basics must never reach for a key or a
        // chord it has not introduced.
        if (level.id === 'basics' && q.key?.mode !== 'major') problems.push(`${where}: minor key in Basics`)

        // The answer must be what the engine says, re-derived here rather than
        // trusted from the generator — otherwise this only checks that the
        // generator agrees with itself.
        if (q.type === 'numeral' && q.key && romanNumeral(q.chords[0], q.key) !== q.answer) {
          problems.push(`${where}: numeral disagrees with romanNumeral()`)
        }
        if (q.type === 'fn') {
          const want = { T: 'Tonic', PD: 'Predominant', D: 'Dominant' }[harmonicFunction(q.chords[0], q.key)]
          if (want !== q.answer) problems.push(`${where}: function disagrees with harmonicFunction()`)
        }
        if (q.type === 'cadence' && cadenceAt(q.chords, 1, q.key)?.label !== q.answer) {
          problems.push(`${where}: cadence disagrees with cadenceAt()`)
        }
        if (q.type === 'interval') {
          // Re-derive from the two notes named in the prompt rather than trusting
          // the catalogue entry the generator happened to draw.
          const [, a, b] = q.prompt.match(/from (\S+) up to (\S+)\?/) ?? []
          const named = a && b ? intervalBetween(parseNote(a.replace('♯', '#').replace('♭', 'b')), parseNote(b.replace('♯', '#').replace('♭', 'b')), { octave: q.answer === 'octave' }) : null
          if (!named) problems.push(`${where}: could not re-read "${q.prompt}"`)
          else if (named.name !== q.answer) problems.push(`${where}: says ${q.answer}, intervalBetween says ${named.name}`)
        }
        if (q.type === 'outsider') {
          const strangers = q.chords.filter((c) => !isDiatonic(c, q.key)).map(chordSymbol)
          if (strangers.length !== 1) problems.push(`${where}: ${strangers.length} chords outside the key, want exactly 1`)
          else if (strangers[0] !== q.answer) problems.push(`${where}: names the wrong chord as the outsider`)
        }
      }
    }
  }

  eq('  every level builds a question every time', problems.length, 0)
  if (problems.length) console.log('   ' + problems.slice(0, 8).join('\n   '))
  eq('  questions generated', built, EX_LEVELS.length * 120 * 12)
  eq('  every question type appears', typesSeen.size, 13)
  console.log('     mix — ' + [...typesSeen].map(([t, n]) => `${t} ${n}`).join(', '))

  // Same seed, same question. Without this the check above proves nothing about
  // a specific failure, because there is no way to get back to it.
  const a = makeQuestion('chromatic', makeRng(4242))
  const b = makeQuestion('chromatic', makeRng(4242))
  eq('  a seed reproduces its question', a.prompt === b.prompt && a.answerIndex === b.answerIndex, true)
}

console.log('\n--- chart import ---')
{
  const r = parseChart('| Cmaj7 | Am7 | Dm7 G7 |')
  eq('  four chords parsed', r.chords.length, 4)
  eq('  a shared bar splits into halves', r.durations.join(','), '1,1,2,2')
  eq('  bar lines detected', r.usedBarLines, true)
  eq('  unreadable tokens are reported', parseChart('C Xq7 F').unknown.join(','), 'Xq7')
  eq('  and do not stop the rest parsing', parseChart('C Xq7 F').chords.length, 2)
}

console.log('\n--- MIDI ---')
{
  /** A real parser: chunk walk, VLQ deltas, running status. */
  const parseMidi = (bytes) => {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const out = { format: dv.getUint16(8), declared: dv.getUint16(10), division: dv.getUint16(12), tracks: [] }
    let i = 8 + dv.getUint32(4)
    while (i < bytes.length) {
      const type = String.fromCharCode(...bytes.slice(i, i + 4))
      const len = dv.getUint32(i + 4)
      const body = bytes.slice(i + 8, i + 8 + len)
      i += 8 + len
      if (type !== 'MTrk') continue

      const track = { name: null, notes: [], channels: new Set(), tick: 0 }
      let p = 0
      let status = 0
      const vlq = () => { let v = 0; while (body[p] & 0x80) { v = (v << 7) | (body[p++] & 0x7f) } return (v << 7) | body[p++] }
      while (p < body.length) {
        track.tick += vlq()
        let b = body[p]
        if (b & 0x80) { status = b; p++ } // else running status
        if (status === 0xff) {
          const meta = body[p++]
          const n = vlq()
          if (meta === 0x03) track.name = String.fromCharCode(...body.slice(p, p + n))
          p += n
          if (meta === 0x2f) break
        } else if (status === 0xf0 || status === 0xf7) {
          p += vlq()
        } else {
          const kind = status & 0xf0
          const channel = status & 0x0f
          const data = kind === 0xc0 || kind === 0xd0 ? 1 : 2
          if (kind === 0x90 || kind === 0x80) {
            track.channels.add(channel)
            const midi = body[p]
            const velocity = body[p + 1]
            track.notes.push({ tick: track.tick, midi, on: kind === 0x90 && velocity > 0, channel })
          }
          p += data
        }
      }
      out.tracks.push(track)
    }
    return out
  }

  const verse = { id: 'a', name: 'Verse', key: 'C', timeSignature: '4/4', chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'], inversions: [0, 0, 0, 0], durations: [1, 1, 1, 1] }
  const segments = [verse]
  const events = songToEvents([{ segmentId: 'a', repeats: 2 }], segments)

  const plain = parseMidi(buildMidi(events, { bpm: 96, timeSignature: '4/4' }))
  eq('  format 1', plain.format, 1)
  eq('  declares two tracks', plain.declared, 2)
  eq('  and actually holds two', plain.tracks.length, 2)
  eq('  named', plain.tracks.map((t) => t.name).join(', '), 'Picardy, Chords')
  // Channels are zero-based in the file; a DAW shows them as 1 and 2.
  eq('  chords are on channel 0', [...plain.tracks[1].channels].join(','), '0')

  const balanced = (track) => {
    const open = new Map()
    for (const n of track.notes) {
      const k = `${n.channel}:${n.midi}`
      open.set(k, (open.get(k) ?? 0) + (n.on ? 1 : -1))
      if ((open.get(k) ?? 0) < 0) return false
    }
    return [...open.values()].every((v) => v === 0)
  }
  eq('  every note is turned off again', balanced(plain.tracks[1]), true)
  const expectedNotes = events.reduce((n, e) => n + e.midis.length, 0)
  eq('  one note-on per voiced note', plain.tracks[1].notes.filter((n) => n.on).length, expectedNotes)

  // With a melody: a third track, its own channel, and nothing left hanging.
  const line = [{ at: 0, beats: 1, midi: 72 }, { at: 2, beats: 2, midi: 76 }, { at: 6, beats: 1, midi: 79 }]
  const withMel = parseMidi(buildMidi(events, { bpm: 96, timeSignature: '4/4', melody: line }))
  eq('  a melody adds a track', withMel.declared, 3)
  eq('  …that is really there', withMel.tracks.length, 3)
  eq('  …and is named', withMel.tracks[2].name, 'Melody')
  eq('  the melody is on its own channel', [...withMel.tracks[2].channels].join(','), '1')
  eq('  with one note-on each', withMel.tracks[2].notes.filter((n) => n.on).length, line.length)
  eq('  and none left hanging', balanced(withMel.tracks[2]), true)
  eq('  the chord track is untouched by it',
    withMel.tracks[1].notes.length, plain.tracks[1].notes.length)

  // Position: the note at beat 2 must land two beats in, at 480 ticks a beat.
  const firstOn = withMel.tracks[2].notes.filter((n) => n.on)
  eq('  a note at beat 2 lands on tick 960', firstOn[1].tick, 2 * withMel.division)

  // An empty melody must not add an empty track.
  eq('  no melody, no extra track', parseMidi(buildMidi(events, { melody: [] })).declared, 2)
}

console.log('\n--- pinned shapes ---')
{
  const T = TUNINGS.standard.strings
  const found = findVoicings(parseChord('C'), { tuning: T, bassPc: 0 })
  const high = found.find((s) => s.position >= 7)

  const encoded = encodeShape(high, 'standard')
  eq('  a shape encodes with its tuning', encoded.startsWith('standard:'), true)
  eq('  and decodes back in that tuning', decodeShape(encoded, 'standard').join(','), high.frets.map((f) => (f === null ? 'x' : f)).join(','))
  eq('  but is ignored under a different tuning', decodeShape(encoded, 'dropD'), null)

  const rebuilt = shapeFromFrets(decodeShape(encoded, 'standard'), T)
  eq('  rebuilding gives the same notes', rebuilt.midis.join(','), high.midis.join(','))
  eq('  and the same position', rebuilt.position, high.position)
  eq('  and detects the barre the same way', rebuilt.barre, high.barre)

  // A pinned shape must reach the chart, not be re-searched away.
  const segment = {
    id: 'a', name: 'Verse', key: 'C', timeSignature: '4/4',
    chords: ['C', 'C'], inversions: [0, 0], durations: ['1', '1'],
    shapes: [encoded, null],
    lines: [0, 1], lyricLines: ['first line', 'second line'],  // stored before lyrics moved onto chords
  }
  const live = readSegment(segment)
  eq('  a section round-trips the pinned shape', live.shapes[0], encoded)
  eq('  and the unpinned slot stays empty', live.shapes[1], null)
  // Old sections keep their words: whole-line text becomes the line's lead-in.
  eq('  an older section migrates its lyrics to lead-ins', live.leadIns.join('|'), 'first line|second line')
  eq('  and which line each chord sits on', live.lines.join(','), '0,1')

  // Two voicings of one chord must both survive into the legend.
  const flat = flattenSong([{ segmentId: 'a', repeats: 1 }], [segment])
  const distinct = new Set(flat.map((item) => `${chordId(item.chord)}|${item.shape ?? ''}`))
  eq('  the same chord with two shapes stays two legend entries', distinct.size, 2)
}

console.log('\n--- brand palette ---')
{
  // theme.js claims the recipe keeps every hue legible. That claim is only worth
  // making if something checks it, so check it for all ten, not just amber.
  let worstBody = Infinity
  let worstButton = Infinity
  let worstDim = Infinity
  for (const { id, hue } of HUES) {
    const t = makeTheme(hue)
    worstBody = Math.min(worstBody, contrastRatio(t.ink, t.bg))
    worstButton = Math.min(worstButton, contrastRatio(t.accentInk, t.accent))
    worstDim = Math.min(worstDim, contrastRatio(t.dim, t.panel))
    if (contrastRatio(t.ink, t.bg) < 4.5 || contrastRatio(t.accentInk, t.accent) < 4.5) {
      eq(`  ${id} is legible`, false, true)
    }
  }
  // AAA for body text, AA for the accent button and for muted text on a panel.
  eq('  body text on background clears AAA everywhere', worstBody >= 7, true)
  eq('  ink on the accent clears AA everywhere', worstButton >= 4.5, true)
  eq('  muted text on a panel clears AA everywhere', worstDim >= 4.5, true)
  console.log(`     worst of ${HUES.length} hues — body ${worstBody.toFixed(2)}:1, accent ${worstButton.toFixed(2)}:1, dim ${worstDim.toFixed(2)}:1`)

  // The CSS ships literal hex, so it can drift from the recipe silently. These
  // pin the two together: change the hue in theme.js and this tells you which
  // custom properties in app.css still need updating.
  const brand = makeTheme(BRAND_HUE)
  const css = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8')
  const cssVar = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase()
  eq('  --hue matches the brand hue', css.match(/--hue:\s*(\d+)/)?.[1], String(BRAND_HUE))
  eq('  --accent matches the recipe', cssVar('accent'), brand.accent)
  eq('  --accent-2 is the recipe\'s cool', cssVar('accent-2'), brand.cool)
  eq('  --bg matches the recipe', cssVar('bg'), brand.bg)
  eq('  --surface-1 is the panel colour', cssVar('surface-1'), brand.panel)
  eq('  --border is the panel edge', cssVar('border'), brand.panelEdge)
  eq('  --ink matches the recipe', cssVar('ink'), brand.ink)
  eq('  --text-dim matches the recipe', cssVar('text-dim'), brand.dim)
  eq('  --string matches the recipe', cssVar('string'), brand.string)

  // theme-color in index.html is what mobile browser chrome paints, so it has to
  // be the panel colour or the app appears to have a seam at the top.
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  eq('  theme-color is the panel colour', html.match(/theme-color"\s+content="(#[0-9a-f]{6})"/i)?.[1]?.toLowerCase(), brand.panel)

  // Several scrapers refuse to resolve a root-relative og:image and just show no
  // preview at all — which is invisible from the page itself, so assert it here.
  const ogImage = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1]
  eq('  og:image is an absolute URL', /^https:\/\//.test(ogImage ?? ''), true)

  // Chord-tone colours have to be told apart from each other and from the accent,
  // which paints scale dots on the same fretboard. WCAG contrast is the wrong
  // instrument for that — it only sees luminance, so two plainly different hues
  // can "fail" it and two near-identical yellows can pass. Perceptual distance is
  // the question actually being asked, so measure it in Lab.
  const tones = Object.fromEntries(
    [...css.matchAll(/--tone-([a-z]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]),
  )
  eq('  every chord-tone colour is defined', Object.keys(tones).length, 10)

  let nearestToAccent = [Infinity, '']
  for (const [name, hex] of Object.entries(tones)) {
    const d = deltaE(hex, brand.accent)
    if (d < nearestToAccent[0]) nearestToAccent = [d, name]
  }
  let closestPair = [Infinity, '']
  const names = Object.keys(tones)
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const d = deltaE(tones[names[i]], tones[names[j]])
      if (d < closestPair[0]) closestPair = [d, `${names[i]}/${names[j]}`]
    }
  }
  // 30 and 18 are where these stopped being confusable at dot size on the
  // fretboard — below them the amber accent starts reading as a chord tone.
  eq(`  no tone crowds the accent (nearest: ${nearestToAccent[1]})`, nearestToAccent[0] >= 30, true)
  eq(`  no two tones collide (closest: ${closestPair[1]})`, closestPair[0] >= 18, true)
  console.log(`     ΔE — nearest to accent ${nearestToAccent[0].toFixed(1)}, closest pair ${closestPair[0].toFixed(1)}`)
}

console.log('\n--- melody against the chords ---')
{
  const role = (midi, sym) => classifyNote(midi, parseChord(sym), C).role
  const label = (midi, sym) => classifyNote(midi, parseChord(sym), C).label

  eq('  E over Cmaj7 is the third', label(64, 'Cmaj7'), '3')
  eq('  …and counts as a chord tone', role(64, 'Cmaj7'), 'chord')
  eq('  B over Cmaj7 is the major seventh', label(71, 'Cmaj7'), '7')
  eq('  D over Cmaj7 is the ninth', label(62, 'Cmaj7'), '9')

  // The rule worth having: a natural 11th only fights when there is a major
  // third for it to sit a half step above.
  eq('  F over Cmaj7 is an avoid note', role(65, 'Cmaj7'), 'avoid')
  eq('  C over G7 is an avoid note', role(72, 'G7'), 'avoid')
  eq('  but G over Dm7 is a plain eleventh', role(67, 'Dm7'), 'tension')
  eq('  …because Dm7 has no major third', label(67, 'Dm7'), '11')
  eq('  and F over Dm7 is simply its third', label(65, 'Dm7'), '♭3')

  eq('  C♯ over Cmaj7 is outside the key', role(61, 'Cmaj7'), 'outside')
  eq('  every classification carries a reason',
    [64, 65, 61, 62].every((m) => (classifyNote(m, parseChord('Cmaj7'), C).why ?? '').length > 10), true)

  // The chord under a beat, with chords of different lengths.
  const prog = ['Cmaj7', 'G7'].map(parseChord)
  eq('  beat 0 is under the first chord', chordAtBeat(prog, [4, 2], 0).index, 0)
  eq('  beat 3.5 is still the first', chordAtBeat(prog, [4, 2], 3.5).index, 0)
  eq('  beat 4 has moved on', chordAtBeat(prog, [4, 2], 4).index, 1)
  eq('  past the end there is no chord', chordAtBeat(prog, [4, 2], 99).index, -1)

  // Two clicks on one cell must not stack into a doubled note.
  const dup = normaliseMelody([{ at: 1, beats: 1, midi: 60 }, { at: 1, beats: 2, midi: 60 }])
  eq('  a repeated note collapses', dup.length, 1)
  eq('  and rubbish is dropped',
    normaliseMelody([{ at: NaN, beats: 1, midi: 60 }, { at: 0, beats: 0, midi: 60 }]).length, 0)
}

console.log('\n--- ready-made backing tracks ---')
{
  const problems = []
  const seen = new Set()
  for (const preset of BACKINGS) {
    if (seen.has(preset.id)) problems.push(`duplicate id ${preset.id}`)
    seen.add(preset.id)
    if (!STYLES[preset.style]?.band) problems.push(`${preset.id}: style "${preset.style}" is not a band style`)

    // Every preset in every key. Degrees are stored rather than symbols exactly
    // so this holds: a ii-V-I in D flat has to come out E flat m7, A flat 7,
    // D flat maj7 — never a sharp, never a double accidental.
    for (const tonic of BACKING_KEYS) {
      const built = buildBacking(preset, tonic)
      const where = `${preset.id} in ${tonic}`
      if (!built) { problems.push(`${where}: did not build`); continue }
      if (built.progression.length !== preset.chords.length) problems.push(`${where}: wrong chord count`)
      for (const chord of built.progression) {
        for (const e of chordNotes(chord)) {
          if (Math.abs(e.note.acc) > 1) {
            problems.push(`${where}: ${chordSymbol(chord)} needs a double accidental (${prettyName(e.note)})`)
          }
        }
        // The numeral is what the chart prints over the chord, so it has to be
        // something the engine can actually name.
        const roman = romanNumeral(chord, built.key)
        if (!roman || /undefined|NaN/.test(roman)) problems.push(`${where}: ${chordSymbol(chord)} has no numeral`)
      }
      // Bars have to come out whole, or the chart shows a ragged final bar.
      const beats = built.durations.reduce((a, b) => a + b, 0)
      if (beats % timeSignatureOf(built.timeSignature).beatsPerBar !== 0) {
        problems.push(`${where}: ${beats} beats does not fill whole bars`)
      }
    }
  }
  eq('  every preset builds in every key', problems.length, 0)
  if (problems.length) console.log('   ' + problems.slice(0, 8).join('\n   '))
  eq('  presets offered', BACKINGS.length, 10)
  eq('  keys offered', BACKING_KEYS.length, 12)

  // The one that matters most, spelled out.
  const dflat = buildBacking(BACKINGS.find((p) => p.id === 'ii-v-i'), 'Db')
  eq('  ii–V–I in D♭', dflat.progression.map(chordSymbol).join(' '), 'E♭m7 A♭7 D♭maj7 D♭maj7')
  eq('  …and its numerals', dflat.progression.map((c) => romanNumeral(c, dflat.key)).join(' '), 'ii7 V7 Imaj7 Imaj7')
}

console.log('\n--- playback styles ---')
{
  const bandStyles = Object.entries(STYLES).filter(([, s]) => s.band)
  eq('  band styles present', bandStyles.length, 4)
  eq('  the chord-only patterns survive',
    ['block', 'strum', 'arpeggio', 'bassComp'].every((id) => STYLES[id] && !STYLES[id].band), true)

  const problems = []
  // Every metre the app offers, not just 4/4 — a groove written for a backbeat
  // must not put a snare on a beat that 3/4 does not have.
  for (const ts of TIME_SIGNATURES) {
    for (const [id, style] of bandStyles) {
      const bar = barFor(id, ts)
      const where = `${id} in ${ts.id}`
      if (!bar) { problems.push(`${where}: no bar built`); continue }

      for (const part of ['drums', 'fill', 'comp', 'bass']) {
        if (!Array.isArray(bar[part]) || !bar[part].length) problems.push(`${where}: ${part} is empty`)
        for (const e of bar[part] ?? []) {
          const at = e.at
          if (!(at >= 0)) problems.push(`${where}: ${part} event at ${e.at} is negative or NaN`)
          if (at >= ts.beatsPerBar) problems.push(`${where}: ${part} event at ${at} is past the ${ts.beatsPerBar}-beat bar`)
          if (e.gain != null && (e.gain <= 0 || e.gain > 1.2)) problems.push(`${where}: ${part} gain ${e.gain} out of range`)
        }
      }
      for (const hit of [...bar.drums, ...bar.fill]) {
        if (!DRUM_VOICES.includes(hit.voice)) problems.push(`${where}: no such drum voice "${hit.voice}"`)
      }
      // A bar with no downbeat reads as a mistake however good the rest is.
      if (!bar.drums.some((h) => h.at === 0)) problems.push(`${where}: nothing on the downbeat`)
      // The fill has to differ from the groove, or it is not a fill.
      const sig = (list) => list.map((h) => `${h.voice}@${h.at}`).join(',')
      if (sig(bar.drums) === sig(bar.fill)) problems.push(`${where}: the fill is identical to the groove`)
    }
  }
  eq('  every style fits every metre', problems.length, 0)
  if (problems.length) console.log('   ' + problems.slice(0, 8).join('\n   '))

  // Swing moves offbeats and leaves everything else alone.
  eq('  a downbeat never swings', swingBeat(2, 1), 2)
  eq('  a straight offbeat is untouched at swing 0', swingBeat(2.5, 0), 2.5)
  eq('  full swing puts the offbeat on the triplet', +swingBeat(2.5, 1).toFixed(4), +(2 + 2 / 3).toFixed(4))
  eq('  a sixteenth is left alone', swingBeat(2.25, 1), 2.25)

  // 6/8 is compound: three quarter-beats to the bar, a dotted-quarter pulse.
  const sixEight = TIME_SIGNATURES.find((t) => t.id === '6/8')
  eq('  6/8 is compound', isCompound(sixEight), true)
  eq('  and its pulse is a dotted quarter', pulseOf(sixEight), 1.5)
  eq('  4/4 is not compound', isCompound(TIME_SIGNATURES.find((t) => t.id === '4/4')), false)
}

console.log('\n--- MIDI input ---')
{
  const msg = (...bytes) => parseMidiMessage(Uint8Array.from(bytes))

  eq('  a note-on is a note-on', msg(0x90, 60, 100)?.type, 'on')
  eq('  and carries the note', msg(0x90, 60, 100)?.note, 60)
  eq('  and the velocity', msg(0x90, 60, 100)?.velocity, 100)
  eq('  a note-off is a note-off', msg(0x80, 60, 0)?.type, 'off')

  // The one that bites: plenty of controllers never send 0x80 at all, and say
  // "off" as a note-on with zero velocity. Reading that as a note-on leaves the
  // key stuck down for the rest of the session.
  eq('  a note-on at velocity 0 is a release', msg(0x90, 60, 0)?.type, 'off')

  // Channels are the low nibble, and this app listens to all sixteen.
  eq('  channel 10 note-on still reads', msg(0x99, 64, 80)?.type, 'on')
  eq('  channel 16 note-off still reads', msg(0x8f, 64, 0)?.type, 'off')

  // Everything else is someone else's business.
  eq('  a pitch bend is ignored', msg(0xe0, 0, 64), null)
  eq('  a control change is ignored', msg(0xb0, 7, 100), null)
  eq('  clock is ignored', msg(0xf8, 0, 0), null)
  eq('  a truncated message is ignored', parseMidiMessage(Uint8Array.from([0x90, 60])), null)
  eq('  and nothing at all is ignored', parseMidiMessage(null), null)
}

console.log('\n--- keeping the strip in view ---')
{
  // The numbers are a real measurement: eight chords at 1440px wide, the strip
  // 649 across with 1360 of content, the last chip at 1100 and the add card
  // running to 1360.
  const strip = { scrollLeft: 589, clientWidth: 649 }
  const lastChip = { left: 1100, right: 1224 }
  const withCard = { left: 1100, right: 1360 }

  // The chip is already visible, so holding only the chip does nothing at all —
  // and the card sits past the right edge, still painted but clipped, looking
  // present while clicks fall through it. That is the bug, twice.
  eq('  the last chip is already in view', isFullyVisible({ ...strip, ...lastChip }), true)
  eq('  so holding just the chip does not scroll', keepInView({ ...strip, ...lastChip }), null)
  eq('  …leaving the add card out of view', isFullyVisible({ ...strip, ...withCard }), false)

  // Including the card is the fix, and it keeps the chip visible too.
  const withTail = keepInView({ ...strip, ...withCard })
  eq('  holding the card as well scrolls further', withTail, 1360 - 649 + 12)
  eq('  …and the card is fully in view',
    isFullyVisible({ scrollLeft: withTail, clientWidth: 649, ...withCard }), true)
  eq('  …and so is the chord it follows',
    isFullyVisible({ scrollLeft: withTail, clientWidth: 649, ...lastChip }), true)

  // The ordinary cases still behave.
  eq('  something already visible stays put', keepInView({ scrollLeft: 100, clientWidth: 649, left: 200, right: 300 }), null)
  eq('  something off the left scrolls back', keepInView({ scrollLeft: 400, clientWidth: 649, left: 100, right: 224 }), 88)
  eq('  and never past the start', keepInView({ scrollLeft: 40, clientWidth: 649, left: 4, right: 128 }), 0)
}

// The point of building lesson examples from degrees rather than typing chord
// names is that the page cannot disagree with the engine. That guarantee is
// only real if something checks it, so this is that something: every example is
// compiled and compared against what the lesson claims it will say. A spelling
// or numeral change that would make an article wrong fails here rather than
// going out and quietly teaching the wrong thing.
console.log('\n--- lessons ---')
{
  const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/
  const seen = new Set()
  let examples = 0
  let claims = 0
  let badSlug = 0
  let badStyle = 0
  let unbuildable = 0
  let mismatched = 0
  let shortProse = 0
  // *emphasis* is rendered; an odd number of asterisks in a paragraph means one
  // of them is going to show up on the page as an asterisk.
  let strayEmphasis = 0

  for (const lesson of LESSONS) {
    if (!slugRe.test(lesson.id) || seen.has(lesson.id)) badSlug++
    seen.add(lesson.id)
    // A lesson with no prose is a stub; better to notice here than on the page.
    const words = lesson.sections
      .flatMap((s) => s.body ?? [])
      .join(' ')
      .split(/\s+/).filter(Boolean).length
    if (words < 60) shortProse++
    for (const paragraph of lesson.sections.flatMap((s) => s.body ?? [])) {
      if ((paragraph.match(/\*/g) ?? []).length % 2) strayEmphasis++
    }

    for (const section of lesson.sections) {
      if (!section.example) continue
      examples++
      const ex = section.example
      const built = buildExample(ex)
      if (!built) { unbuildable++; continue }

      // A style id the audio layer does not know falls back to block chords
      // silently, so an example would play something other than what it says.
      if (!STYLES[built.style]) badStyle++

      const want = ex.expect ?? {}
      const check = (field, got) => {
        claims++
        const wanted = want[field]
        const same = Array.isArray(wanted)
          ? wanted.length === got.length && wanted.every((v, i) => v === got[i])
          : wanted === got
        if (!same) {
          mismatched++
          console.log(`FAIL   ${lesson.id} / "${ex.caption}" ${field}: ${JSON.stringify(got)}  (want ${JSON.stringify(wanted)})`)
        }
      }
      check('symbols', built.symbols)
      check('numerals', built.numerals)
      check('cadence', built.cadence)
    }
  }

  // Every example has to be playable, and "playable" means the shape the
  // scheduler actually reads: voiced pitches, not chords. Passing it chords
  // fails silently — a band style still schedules drums off the same items and
  // sounds like it is working, while the chords are mute — which is how the
  // lessons shipped with playback that had never worked. Asserted here because
  // the component could not assert it.
  let unplayable = 0
  for (const { example } of allExamples()) {
    const items = exampleItems(buildExample(example))
    if (!items.length) { unplayable++; continue }
    if (items.some((it) => !Array.isArray(it.midis) || !it.midis.length || !(it.beats > 0))) unplayable++
  }
  eq('  every example is playable by the scheduler', unplayable, 0)

  eq('  every lesson has a URL-safe, unique slug', badSlug, 0)
  eq('  every lesson has real prose in it', shortProse, 0)
  eq('  no unpaired *emphasis* markers', strayEmphasis, 0)
  eq('  every example builds from its degrees', unbuildable, 0)
  eq('  every example names a style the audio layer has', badStyle, 0)
  eq(`  every claim matches the engine (${claims} across ${examples} examples)`, mismatched, 0)

  // The reader is chosen by slug, so the slugs have to route. A lesson that
  // cannot be linked to is a lesson nobody will read.
  const routable = LESSONS.every((l) => routeFor(lessonPath(l.id)) === 'lesson' && lessonSlugFor(lessonPath(l.id)) === l.id)
  eq('  every lesson routes from its own path', routable, true)
  eq('  a made-up slug is not a lesson', lessonSlugFor('/lessons/nope'), null)
  eq('  …and falls back to the index, not the front page', routeFor('/lessons/nope'), 'lessons')
  eq('  the index itself routes', routeFor('/lessons'), 'lessons')
  eq('  a trailing slash is the same lesson', lessonSlugFor(`${lessonPath(LESSONS[0].id)}/`), LESSONS[0].id)
  // The tab title has to come from the path, since every lesson shares a route.
  eq('  a lesson titles its own tab', pageFor('lesson', lessonPath('cadences')).title, 'Cadences — Picardy')
}

// Forcing one key on a progression that moves does not merely miss the
// modulation — it reports the opening as a string of errors. The hard part is
// not finding key changes, it is refusing to find them where a single applied
// dominant fits another key better for one chord.
// Some chords carry the structure and some decorate it. The risk here is not
// missing one, it is claiming an ordinary harmony is decoration — so the
// negative cases outnumber the positive ones.
// classifyNote reads a pitch against a chord, one note at a time. That cannot
// tell a suspension from an appoggiatura — they can be the same pitch over the
// same chord on the same beat, and what separates them is where the note came
// from and where it goes.
// optimiseInversions searched for the smoothest voicing and had no idea what a
// bad one looks like. Minimising movement alone happily returns parallel fifths,
// because moving two voices in lockstep is about the smoothest thing they can do.
// The engine already noticed a progression was full of falling fifths and said
// so as a statistic. One word short of the name.
console.log('\n--- sequences, 5-6, and perfect vs imperfect ---')
{
  const chords = (chart) => parseChart(chart).chords
  const seq = (chart) => findSequence(chords(chart))?.label ?? null
  const C = makeKey('C', 'major')

  eq('  descending fifths', seq('| C | F | Bdim | Em | Am | Dm | G | C |'), 'descending fifths')
  eq('  …with sevenths on top', seq('| Cmaj7 | Fmaj7 | Bm7b5 | Em7 | Am7 | Dm7 | G7 | Cmaj7 |'), 'descending fifths')
  eq('  ascending fifths', seq('| C | G | D | A |'), 'ascending fifths')
  eq('  descending 5–6, the falling-thirds sequence', seq('| C | G | Am | Em | F | C |'), 'descending 5–6')
  eq('  ascending 5–6', seq('| C | Am | Dm | Bdim | Em |'), 'ascending 5–6')
  eq('  descending steps', seq('| C | Bb | Ab | Gb |'), 'descending steps')
  eq('  an ordinary progression is not a sequence', seq('| C | Am | F | G |'), null)
  eq('  one statement is not a sequence', seq('| C | F | G | C |'), null)
  eq('  and nothing too short to state one twice', seq('| C | F | Bdim |'), null)

  // Steps, not semitones. A diatonic descending-fifths sequence contains one
  // diminished fifth — F to B in C major — so a semitone matcher reports the
  // sequence starting two chords late, and the 5–6 patterns never match at all
  // because E–F is a semitone where the other steps are tones.
  const full = findSequence(chords('| C | F | Bdim | Em | Am | Dm | G | C |'))
  eq('  the sequence is found from its first chord, tritone link and all', full.start, 0)
  eq('  …and counts every statement', full.statements, 7)

  // The named sequence replaces the statistic it refines.
  const named = analyseProgression(chords('| C | F | Bdim | Em | Am | Dm | G | C |'), C)
  eq('  it is reported by name', named.observations.some((o) => o.kind === 'sequence'), true)
  eq('  …and not also as a count of fifths', named.observations.some((o) => /changes fall by a fifth/.test(o.text)), false)

  // The 5-6 technique: a bass that holds while a voice above it steps up.
  const five = (chart, invs, i) => !!fiveSixMove(chords(chart), i, invs)
  eq('  C then Am over the same C bass is a 5–6', five('| C | Am |', [0, 1], 1), true)
  eq('  …but Am in root position is a real chord change', five('| C | Am |', [0, 0], 1), false)
  eq('  a different bass is not a 5–6', five('| C | F |', [0, 0], 1), false)
  eq('  the same chord twice is not a 5–6', five('| C | C |', [0, 0], 1), false)
  eq('  and without inversions nothing is claimed', five('| C | Am |', null, 1), false)

  // Perfect and imperfect by position, which is what the terms actually mean.
  const cad = (invs) => analyseProgression(chords('| C | G7 | C |'), C, invs)
    .observations.filter((o) => o.kind === 'cadence').map((o) => o.text).join(' ')
  eq('  root position both sides is perfect in the strict sense', /perfect in the strict sense/.test(cad([0, 0, 0])), true)
  eq('  an inverted dominant makes it imperfect', /imperfect/.test(cad([0, 1, 0])), true)
  eq('  an inverted tonic too', /imperfect/.test(cad([0, 0, 1])), true)
  eq('  with no inversions the claim is not made', /strict sense|imperfect/.test(
    analyseProgression(chords('| C | G7 | C |'), C).observations.map((o) => o.text).join(' ')), false)
}

console.log('\n--- voice-leading faults ---')
{
  const P = (s) => s.split(/\s+/).map(parseChord)
  const kinds = (chart, invs) => voiceLeadingFaults(P(chart), invs).map((f) => f.type)

  eq('  V–IV in root position makes parallel fifths',
    kinds('G F', [0, 0]).includes('parallel-fifths'), true)
  eq('  I–II in root position too',
    kinds('C D', [0, 0]).includes('parallel-fifths'), true)
  // The two ways parallels are avoided in practice.
  eq('  a held voice is oblique motion, not a parallel',
    kinds('C Am', [0, 1]).includes('parallel-fifths'), false)
  eq('  contrary motion is not a parallel',
    kinds('C G', [0, 2]).includes('parallel-fifths'), false)
  eq('  a single chord has nothing to compare', voiceLeadingFaults(P('C'), [0]).length, 0)
  eq('  and no progression at all is not an error', voiceLeadingFaults([], []).length, 0)

  // Smoothing must not make voice leading worse, and should make it better.
  // Measured across every backing preset in every key rather than on one chart.
  let before = 0
  let after = 0
  let moveBefore = 0
  let moveAfter = 0
  let regressions = 0
  let n = 0
  for (const preset of BACKINGS) {
    for (const tonic of BACKING_KEYS) {
      const built = buildBacking(preset, tonic)
      if (!built) continue
      n++
      const b0 = voiceLeadingFaults(built.progression, built.inversions).length
      const inv = optimiseInversions(built.progression)
      const b1 = voiceLeadingFaults(built.progression, inv).length
      before += b0
      after += b1
      if (b1 > b0) regressions++
      moveBefore += progressionMovement(built.progression, built.inversions)
      moveAfter += progressionMovement(built.progression, inv)
    }
  }
  eq('  smoothing never leaves a progression with more faults than it started', regressions, 0)
  eq(`  and removes most of them (${before} → ${after} across ${n} progressions)`, after < before * 0.25, true)
  eq('  while still reducing movement', moveAfter < moveBefore, true)
  // The parallel penalty is meant to break ties, not to buy fewer parallels
  // with clumsier voice leading. It removes faults at no cost in movement.
  eq('  smoothing keeps movement under one semitone per change on average', moveAfter / n < 1, true)
}

console.log('\n--- melodic figures ---')
{
  const ts44 = timeSignatureOf('4/4')
  const P = (s) => s.split(/\s+/).map(parseChord)
  const M = (a) => a.map(([at, beats, midi]) => ({ at, beats, midi }))
  const figure = (chart, durs, mel, i, ts = ts44) => {
    const r = classifyFigure(M(mel), i, P(chart), durs, ts)
    return r ? r.role : null
  }

  // C4 = 60. C major: C60 D62 E64 F65 G67 A69 B71.
  eq('  a passing tone off the beat', figure('C C', [4, 4], [[0, 1, 64], [1, 1, 62], [2, 1, 60]], 1), 'passing')
  eq('  an accented passing tone', figure('C C', [4, 4], [[0, 2, 64], [2, 1, 62], [3, 1, 60]], 1), 'passing')
  eq('  an upper neighbour', figure('C C', [4, 4], [[0, 1, 64], [1, 1, 65], [2, 1, 64]], 1), 'neighbour')
  eq('  a lower neighbour', figure('C C', [4, 4], [[0, 1, 64], [1, 1, 62], [2, 1, 64]], 1), 'neighbour')
  eq('  an escape tone', figure('C C', [4, 4], [[0, 1, 64], [1, 1, 65], [2, 1, 60]], 1), 'escape')
  eq('  an appoggiatura', figure('C C', [4, 4], [[0, 2, 60], [4, 1, 65], [5, 1, 64]], 1), 'appoggiatura')
  eq('  an anticipation', figure('C F', [4, 4], [[0, 3, 64], [3, 1, 69], [4, 2, 69]], 1), 'anticipation')
  eq('  a retardation', figure('F G7', [4, 4], [[0, 4, 69], [4, 2, 69], [6, 2, 71]], 1), 'retardation')

  // A suspension is written either way in a roll: as a repeated pitch, or as
  // one note still sounding when the chord changes underneath it.
  eq('  a suspension, as a repeated pitch', figure('C G7', [4, 4], [[0, 4, 60], [4, 2, 60], [6, 2, 59]], 1), 'suspension')
  eq('  a suspension, as one sustained note', figure('C G7', [4, 4], [[0, 6, 60], [6, 2, 59]], 0), 'suspension')

  // Chord tones are not figures, whatever shape the line makes around them.
  eq('  a chord tone is not a figure', figure('C C', [4, 4], [[0, 1, 60], [1, 1, 64], [2, 1, 67]], 1), null)
  eq('  …even on a strong beat', figure('C C', [4, 4], [[0, 4, 64], [4, 4, 60]], 0), null)
  eq('  the first note has nothing before it', figure('C C', [4, 4], [[0, 1, 62], [1, 1, 60]], 0), null)

  // The order is load-bearing in the same way the cadence table is: a
  // suspension also passes the accented-passing-tone test, and an appoggiatura
  // also passes the looser incomplete-neighbour test.
  eq('  a suspension is not called an accented passing tone',
    figure('C G7', [4, 4], [[0, 4, 60], [4, 2, 60], [6, 2, 59]], 1), 'suspension')
  eq('  an appoggiatura is not called an incomplete neighbour',
    figure('C C', [4, 4], [[0, 2, 60], [4, 1, 65], [5, 1, 64]], 1), 'appoggiatura')

  // Metre decides between two of these. The same three pitches, moved off the
  // downbeat, stop being an appoggiatura.
  eq('  the same leap-and-step off the beat is not an appoggiatura',
    figure('C C', [4, 4], [[0, 1, 60], [1, 1, 65], [2, 1, 64]], 1), 'incomplete')

  // In 3/4 the accented positions are different, so the reading must follow.
  const ts34 = timeSignatureOf('3/4')
  eq('  metre is read from the time signature, not assumed',
    figure('C C', [3, 3], [[0, 2, 60], [3, 1, 65], [4, 1, 64]], 1, ts34), 'appoggiatura')

  // A note ending flush against a chord change is not sounding into the next
  // chord. Deciding otherwise needs a step back larger than chordAtBeat's own
  // tolerance — at exactly that tolerance the two cancel, and nearly every note
  // in a normal melody looked like it spanned the change, which invented
  // figures for chord tones that were doing nothing.
  eq('  a note ending flush on a chord change does not span it',
    figure('C G7 C', [4, 4, 4], [[0, 4, 60], [4, 2, 60], [6, 2, 59], [8, 2, 64]], 2), null)
  eq('  …and the suspension before it still reads',
    figure('C G7 C', [4, 4, 4], [[0, 4, 60], [4, 2, 60], [6, 2, 59], [8, 2, 64]], 1), 'suspension')
  eq('  …and its preparation is not a figure',
    figure('C G7 C', [4, 4, 4], [[0, 4, 60], [4, 2, 60], [6, 2, 59], [8, 2, 64]], 0), null)
}

console.log('\n--- contrapuntal chords ---')
{
  const chords = (chart) => parseChart(chart).chords
  const roleOf = (chart, invs, i = 1) => {
    const r = contrapuntalRole(chords(chart), i, invs)
    return r ? r.label : null
  }

  eq('  I–VII6–I6: the VII6 is passing', roleOf('| C | Bdim | C |', [0, 1, 1]), 'passing chord')
  eq('  I–V 4/3–I6: likewise', roleOf('| C | G7 | C |', [0, 2, 1]), 'passing chord')
  eq('  and descending, I6–V 4/3–I', roleOf('| C | G7 | C |', [1, 2, 0]), 'passing chord')
  eq('  I–IV 6/4–I is a pedal', roleOf('| C | F | C |', [0, 2, 0]), 'pedal chord')
  eq('  V–I 6/4–V is a pedal', roleOf('| G | C | G |', [0, 2, 0]), 'pedal chord')

  // Everything that must NOT be called decoration.
  eq('  a plain I–IV–V is three harmonies', roleOf('| C | F | G |', [0, 0, 0]), null)
  eq('  ii–V–I is three harmonies', roleOf('| Dm | G7 | C |', [0, 0, 0]), null)
  eq('  I–ii–I in root position is not a neighbour', roleOf('| C | Dm | C |', [0, 0, 0]), null)
  eq('  I–♭VII–I in root position is not a neighbour', roleOf('| C | Bb | C |', [0, 0, 0]), null)
  eq('  a bass that leaps is not passing', roleOf('| C | G | C |', [0, 0, 0]), null)
  eq('  different harmonies either side is not passing', roleOf('| C | G | Am |', [0, 1, 0]), null)
  eq('  with no inversions nothing is claimed', roleOf('| C | Bdim | C |', null), null)
  // The first and last chord have nothing on one side of them.
  eq('  the first chord is never contrapuntal', roleOf('| C | Bdim | C |', [0, 1, 1], 0), null)
  eq('  the last chord is never contrapuntal', roleOf('| C | Bdim | C |', [0, 1, 1], 2), null)

  // A cadential 6/4 is already read as something other than what it spells;
  // it must not also be called a pedal.
  const cad = analyseProgression(chords('| C | G | C |'), makeKey('C', 'major'), [2, 0, 0])
  eq('  a cadential 6/4 is not also called contrapuntal', cad.chords[0].contrapuntal, null)

  // The notation, and the spine underneath it.
  const passing = analyseProgression(chords('| C | Bdim | C |'), makeKey('C', 'major'), [0, 1, 1])
  eq('  the numeral is parenthesised', passing.chords[1].shownRoman, '(vii° 6)')
  eq('  …and the structural chords are not', passing.chords[0].shownRoman, 'I')
  eq('  it is marked subordinate', passing.chords[1].structural, false)
  eq('  …and it is explained', passing.observations.some((o) => o.kind === 'counterpoint'), true)
  eq('  …with the underlying progression named', passing.observations.some((o) => /Underneath, the progression is I–I 6/.test(o.text)), true)

  // How often does this fire where it should not? Every backing preset in every
  // key, all root position: the answer has to be never.
  let falsePositives = 0
  for (const preset of BACKINGS) {
    for (const tonic of BACKING_KEYS) {
      const built = buildBacking(preset, tonic)
      if (!built) continue
      const a = analyseProgression(built.progression, built.key, built.inversions)
      falsePositives += a.chords.filter((c) => c.contrapuntal).length
    }
  }
  eq('  no chord in any backing preset is called decoration', falsePositives, 0)
}

console.log('\n--- modulation ---')
{
  const chords = (chart) => parseChart(chart).chords
  const areasOf = (chart) => detectKeyAreas(chords(chart)).map((a) => `${a.start}-${a.end} ${keyName(a.key)}`)
  const keysOf = (chart) => detectKeyAreas(chords(chart)).map((a) => keyName(a.key)).join(' → ')

  // Must NOT modulate. Every one of these fits another key better somewhere,
  // and reporting a key change in any of them would be worse than the old
  // single-key reading.
  const stays = [
    ['a plain progression', '| C | F | G | C |', 'C major'],
    ['an applied dominant of ii', '| C | A7 | Dm | G7 | C |', 'C major'],
    ['an applied dominant of V', '| C | D7 | G7 | C |', 'C major'],
    ['a tonicisation held for three chords', '| C | C | A7 | Dm | Dm | G7 | C |', 'C major'],
    ['borrowed chords', '| C | Fm | C | Ab | Bb | C |', 'C major'],
    ['a rock ♭VII', '| C | Bb | F | C |', 'C major'],
    ['a twelve-bar blues', '| C7 | F7 | C7 | C7 | F7 | F7 | C7 | C7 | G7 | F7 | C7 | G7 |', 'C major'],
  ]
  for (const [what, chart, want] of stays) {
    eq(`  ${what} stays in one key`, keysOf(chart), want)
  }

  // Must modulate.
  const moves = [
    ['to the dominant', '| C | F | G | C | D7 | G | D7 | G |', 'C major → G major'],
    ['to the relative major', '| Am | Dm | E7 | Am | C | F | G | C |', 'A minor → C major'],
    ['to the relative minor', '| C | F | G | C | E7 | Am | Dm | E7 | Am |', 'C major → A minor'],
    ['two ii–V–Is a fifth apart', '| Dm7 | G7 | Cmaj7 | Am7 | D7 | Gmaj7 |', 'C major → G major'],
  ]
  for (const [what, chart, want] of moves) {
    eq(`  a modulation ${what}`, keysOf(chart), want)
  }
  eq('  …and the boundary lands where the key changes', areasOf('| C | F | G | C | D7 | G | D7 | G |').join(' | '), '0-4 C major | 4-8 G major')

  // Areas must tile the progression exactly — a gap or an overlap would leave a
  // chord with no key or two.
  for (const [, chart] of [...stays, ...moves]) {
    const n = chords(chart).length
    const areas = detectKeyAreas(chords(chart))
    const contiguous = areas[0].start === 0 && areas[areas.length - 1].end === n
      && areas.every((a, i) => i === 0 || a.start === areas[i - 1].end)
    const longEnough = areas.length === 1 || areas.every((a) => a.end - a.start >= 3)
    if (!contiguous || !longEnough) eq(`  areas tile ${chart}`, `${contiguous}/${longEnough}`, 'true/true')
  }
  eq('  every area is contiguous and long enough', true, true)

  // The reading that started all this.
  const moved = analyseProgression(chords('| C | F | G | C | D7 | G | D7 | G |'))
  eq('  the opening is no longer read in the key it ends in', moved.chords[0].roman, 'I')
  eq('  …and its F is not reported as borrowed', moved.observations.some((o) => o.kind === 'mixture'), false)
  eq('  …and it is not said to open on IV', /opens on IV/.test(moved.observations.find((o) => o.kind === 'shape')?.text ?? ''), false)
  eq('  …and the modulation is named', moved.observations.some((o) => o.kind === 'modulation'), true)
  eq('  …with the pivot chord identified', moved.observations.some((o) => /turns on/.test(o.text)), true)
  // Numerals are read in each chord's own area, so the same chord reads differently.
  eq('  the same G is V in the first key…', moved.chords[2].roman, 'V')
  eq('  …and I in the second', moved.chords[5].roman, 'I')

  // A key the user set is not overruled when nothing modulates.
  const C = makeKey('C', 'major')
  eq('  an explicit key stands when there is no modulation',
    analyseProgression(chords('| C | A7 | Dm |'), C).chords[1].roman, 'V7/ii')

  // detectKey and the segmenter share one scorer, so a one-area reading must
  // name the key detectKey names — otherwise the panel contradicts its own
  // "detected key" banner. Checked across every backing preset in every key.
  let disagreed = 0
  let split = 0
  for (const preset of BACKINGS) {
    for (const tonic of BACKING_KEYS) {
      const built = buildBacking(preset, tonic)
      if (!built) continue
      const areas = detectKeyAreas(built.progression)
      if (areas.length > 1) { split++; continue }
      if (keyName(areas[0].key) !== keyName(detectKey(built.progression))) disagreed++
    }
  }
  eq('  no backing preset is reported as modulating', split, 0)
  eq('  and a single area always names the key detectKey names', disagreed, 0)

  // Everything above runs with no key set, which is not how the app calls it —
  // the studio always passes the user's key. That path has its own failure mode:
  // the home-key nudge is applied per chord, and at 0.7 it was quietly hiding
  // the modulation from A minor to its relative major, where the two keys share
  // all seven notes and nothing else separates them.
  const withKey = [
    [1, 'a tonicisation', '| C | A7 | Dm | G7 | C |', makeKey('C', 'major')],
    [1, 'a blues', '| C7 | F7 | C7 | C7 | F7 | F7 | C7 | C7 | G7 | F7 | C7 | G7 |', makeKey('C', 'major')],
    [2, 'a move to the dominant', '| C | F | G | C | D7 | G | D7 | G |', makeKey('C', 'major')],
    [2, 'a move to the relative major', '| Am | Dm | E7 | Am | C | F | G | C |', makeKey('A', 'minor')],
    [2, 'a move to the relative minor', '| C | F | G | C | E7 | Am | Dm | E7 | Am |', makeKey('C', 'major')],
  ]
  for (const [want, what, chart, key] of withKey) {
    eq(`  with the user's key set, ${what}`, analyseProgression(chords(chart), key).areas.length, want)
  }
}

// The export that keeps the spelling. MIDI cannot: a German sixth and a ♭VI7
// are the same bytes. MusicXML carries step, alter and octave, so the checks
// here are about the two things an importer actually rejects — measures whose
// durations do not add up, and malformed XML.
// The drills recorded per-type accuracy from the start and showed it back, then
// chose the next question uniformly at random anyway. The risk in closing that
// loop is the opposite one: a topic that stops asking about something you have
// got good at.
// The same reading, written the way session players read it.
// A capo is a transposition you perform rather than one you write, so the
// question is not what one does but which fret makes a song playable with
// shapes you already have.
console.log('\n--- capo ---')
{
  const best = (chart, tonic, mode = 'major') => {
    const key = makeKey(tonic, mode)
    const top = suggestCapo(parseChart(chart).chords, key)[0]
    return top && { fret: top.fret, playIn: keyName(top.key), open: top.open, total: top.total, shapes: top.chords.map(chordSymbol).join(' ') }
  }

  // The answers a guitarist would give.
  const eb = best('| Eb | Cm | Ab | Bb |', 'Eb')
  eq('  E♭ major goes to capo 3', eb.fret, 3)
  eq('  …played in C major', eb.playIn, 'C major')
  eq('  …with everything open', `${eb.open}/${eb.total}`, '4/4')
  eq('  …and the shapes are the ones you know', eb.shapes, 'C Am F G')

  eq('  B major goes to capo 4, in G', `${best('| B | G#m | E | F# |', 'B').fret} ${best('| B | G#m | E | F# |', 'B').playIn}`, '4 G major')
  eq('  D♭ major goes to capo 1, in C', `${best('| Db | Bbm | Gb | Ab |', 'Db').fret} ${best('| Db | Bbm | Gb | Ab |', 'Db').playIn}`, '1 C major')

  // A capo you do not need is a capo you should not use: capo 5 also gives four
  // open shapes for C major, and must not win.
  const c = best('| C | Am | F | G |', 'C')
  eq('  a key that is already open stays at capo 0', c.fret, 0)
  eq('  …even though a higher fret ties on openness', c.open, 4)

  // The chords handed back are what the hands play, so they have to be a real
  // transposition of the music rather than relabelled.
  const f = suggestCapo(parseChart('| F | Dm | Bb | C |').chords, makeKey('F', 'major'))
    .find((r) => r.fret === 5)
  eq('  the shapes are the progression transposed down by the capo', f.chords.map(chordSymbol).join(' '), 'C Am F G')

  eq('  nothing to advise on returns nothing', suggestCapo([], makeKey('C', 'major')).length, 0)
}

console.log('\n--- Nashville numbers ---')
{
  const C = makeKey('C', 'major')
  const Cm = makeKey('C', 'minor')
  const n = (sym, key = C, inv = 0) => nashvilleNumber(parseChord(sym), key, inv)

  eq('  a major triad is a bare number', n('C'), '1')
  eq('  a minor triad carries an m, since case cannot survive a scribbled chart', n('Dm'), '2m')
  eq('  a diminished chord already says minor and does not need one too', n('Bdim'), '7°')
  eq('  nor does a half-diminished', n('Bm7b5'), '7ø⁷')

  // The reason the extension is raised at all: flat, this reads fifty-seven.
  eq('  a dominant seventh raises its extension', n('G7'), '5⁷')
  eq('  …so a flat seven degree stays full size and is not confused with it', n('Bb'), '♭7')
  eq('  a major seventh too', n('Cmaj7'), '1maj⁷')

  // Figured bass is intervals above the bass, so those digits stay full size.
  eq('  figured bass is left alone', n('G7', C, 1), '5⁷ 6/5')

  // Applied chords convert on both sides of the slash.
  eq('  an applied dominant keeps its slash', n('A7'), '5⁷/2m')
  eq('  …including one aimed at the dominant', n('D7'), '5⁷/5')

  eq('  minor keys work the same way', n('Cm', Cm), '1m')
  eq('  a borrowed flat six', n('Ab', C), '♭6')
  // Anything the roman numeral does not express as a degree is left as it is.
  eq('  an augmented sixth is not a scale degree and passes through', n('Abger6', Cm), 'Ger+6')

  // The two readings must never disagree about what a chord is, only about how
  // to write it — which is why one is derived from the other.
  let mismatched = 0
  for (const sym of ['C', 'Dm', 'Em', 'F', 'G7', 'Am', 'Bdim', 'A7', 'Bb', 'Db', 'Cmaj7']) {
    const chord = parseChord(sym)
    const roman = romanNumeral(chord, C)
    const nash = nashvilleNumber(chord, C)
    const romanDegree = (roman.match(/^([♭♯]*)([IiVv]+)/) ?? [])[2]
    const nashDegree = (nash.match(/^([♭♯]*)(\d)/) ?? [])[2]
    if (romanDegree && String({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 }[romanDegree.toUpperCase()]) !== nashDegree) mismatched++
  }
  eq('  every degree matches the roman numeral it came from', mismatched, 0)
}

console.log('\n--- weighted question choice ---')
{
  const types = ['a', 'b', 'c']
  const share = (byType, draws = 6000) => {
    const w = weightedTypes(types, byType)
    const counts = Object.fromEntries(types.map((t) => [t, 0]))
    // A deterministic sweep rather than random draws: the weights are what is
    // under test, not the RNG.
    const total = w.reduce((s, x) => s + x.weight, 0)
    for (const x of w) counts[x.type] = x.weight / total
    return counts
  }

  eq('  with no history every type is equally likely',
    JSON.stringify(weightedTypes(types, {}).map((w) => w.weight)), '[1,1,1]')
  eq('  a type answered twice is not yet judged',
    weightedTypes(types, { a: { asked: 2, right: 0 } })[0].weight, 1)

  const weak = share({ a: { asked: 10, right: 1 }, b: { asked: 10, right: 9 }, c: { asked: 10, right: 10 } })
  eq('  the weakest type is asked most', weak.a > weak.b && weak.b > weak.c, true)
  eq('  …and a perfect type is still asked', weak.c > 0.1, true)
  // The guard that matters: mastery must not silence a topic.
  const mastered = weightedTypes(types, Object.fromEntries(types.map((t) => [t, { asked: 50, right: 50 }])))
  eq('  when everything is mastered the mix is even again',
    JSON.stringify(mastered.map((w) => +w.weight.toFixed(3))), '[0.35,0.35,0.35]')

  // And it must still produce real questions for every level.
  let built = 0
  for (const level of EX_LEVELS) {
    const byType = Object.fromEntries(level.types.map((t, i) => [t, { asked: 10, right: i === 0 ? 0 : 10 }]))
    for (let seed = 0; seed < 60; seed++) {
      const q = makeQuestion(level.id, makeRng(seed), { byType })
      if (q?.options?.length || q?.input === 'instrument') built++
    }
  }
  eq('  weighted draws still build a question every time', built, EX_LEVELS.length * 60)
}

console.log('\n--- MusicXML ---')
{
  const C = makeKey('C', 'major')
  const chords = (chart) => parseChart(chart).chords
  const build = (chart, opts = {}) => {
    const prog = chords(chart)
    return buildMusicXml(
      progressionToParts(prog, prog.map(() => 0), opts.durations ?? prog.map(() => 4)),
      { key: C, timeSignature: '4/4', bpm: 96, title: 'Test', ...opts },
    )
  }

  const xml = build('| Cmaj7 | Am7 | Dm7 | G7 |')

  // Tags must balance. A hand-written generator is exactly where they do not.
  const balanced = (text) => {
    const stack = []
    const tag = /<(\/?)([A-Za-z][\w-]*)([^>]*?)(\/?)>/g
    let m
    while ((m = tag.exec(text))) {
      const [, closing, name, attrs, selfClose] = m
      if (attrs.startsWith('?') || name === 'xml') continue
      if (selfClose === '/') continue
      if (closing) {
        if (stack.pop() !== name) return false
      } else {
        stack.push(name)
      }
    }
    return stack.length === 0
  }
  eq('  the document is balanced', balanced(xml.replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/g, '')), true)
  eq('  it declares itself as MusicXML', /<score-partwise version="4\.0">/.test(xml), true)

  // The one thing importers refuse outright: a measure that does not add up.
  const measureSums = (text, perBar = 4, divisions = 96) => {
    const bad = []
    const measures = text.match(/<measure number="\d+">[\s\S]*?<\/measure>/g) ?? []
    measures.forEach((mm, i) => {
      const total = [...mm.matchAll(/<duration>(\d+)<\/duration>/g)]
        .reduce((sum, d) => sum + Number(d[1]), 0)
      if (total !== perBar * divisions) bad.push(`${i + 1}:${total}`)
    })
    return { count: measures.length, bad }
  }
  const sums = measureSums(xml)
  eq('  four chords of four beats make four bars', sums.count, 4)
  eq('  every measure adds up to a full bar', sums.bad.join(','), '')

  // Spelling is the whole point. C7♯9 has a D♯ in it and must not be respelled.
  const sharp9 = build('| C7#9 |')
  eq('  a chord keeps its own symbol as display text', /<kind text="C7♯9"/.test(sharp9), true)
  const ger = buildMusicXml(
    progressionToParts([parseChord('Abger6')], [0], [4]),
    { key: makeKey('C', 'minor'), timeSignature: '4/4' },
  )
  eq('  an augmented sixth survives as text even with no MusicXML kind for it',
    /<kind text="A♭\+6\(Ger\)">other<\/kind>/.test(ger), true)

  // A melody note is stored as a bare pitch number, so it has to be spelled on
  // the way out — and spelled in the key, not with a default sharp.
  const flat = buildMusicXml(
    progressionToParts([parseChord('Db')], [0], [4]),
    { key: makeKey('Db', 'major'), timeSignature: '4/4', melody: [{ at: 0, beats: 4, midi: 66 }] },
  )
  eq('  a melody note is spelled in its key', /<step>G<\/step>\s*<alter>-1<\/alter>/.test(flat), true)
  eq('  …and the key signature says five flats', /<fifths>-5<\/fifths>/.test(flat), true)

  // A note crossing a bar line is split and tied rather than overflowing.
  const tied = build('| C | Am | Dm | G7 |', { melody: [{ at: 2, beats: 4, midi: 60 }] })
  eq('  a note across a bar line is tied, not overflowed', /<tie type="start"\/>/.test(tied) && /<tie type="stop"\/>/.test(tied), true)
  eq('  …and the bars still add up', measureSums(tied).bad.join(','), '')

  // Odd metres and odd lengths are where an exporter that assumes 4/4 falls over.
  for (const [tsId, per] of [['3/4', 3], ['5/4', 5], ['7/8', 3.5], ['6/8', 3]]) {
    const odd = buildMusicXml(
      progressionToParts(chords('| C | F | G | C |'), [0, 0, 0, 0], [per, per, per, per]),
      { key: C, timeSignature: tsId },
    )
    const s = measureSums(odd, per)
    eq(`  ${tsId} bars add up`, s.bad.join(','), '')
  }
  // A chord that does not fill a bar leaves the measure short unless it is padded.
  const ragged = buildMusicXml(
    progressionToParts(chords('| C | F |'), [0, 0], [3, 2]),
    { key: C, timeSignature: '4/4' },
  )
  eq('  a ragged progression still writes full measures', measureSums(ragged).bad.join(','), '')

  eq('  nothing to export returns nothing', buildMusicXml([], { key: C }), null)
}

console.log('\n--- routes ---')
{
  eq('  / is the landing page', routeFor('/'), 'home')
  eq('  /tool is the app', routeFor('/tool'), 'app')
  eq('  /privacy', routeFor('/privacy'), 'privacy')
  eq('  /terms', routeFor('/terms'), 'terms')
  // A trailing slash is the same page — hosts and hand-typed URLs disagree about it.
  eq('  /exercises', routeFor('/exercises'), 'exercises')
  eq('  /backing', routeFor('/backing'), 'backing')
  eq('  /privacy/ is the same page', routeFor('/privacy/'), 'privacy')
  eq('  unknown paths fall back to the front page', routeFor('/nope'), 'home')

  // Every progression ever shared is a '/#k=…' link. Moving the tool to /tool
  // would break all of them if the front door did not forward them on.
  eq('  a shared progression at / goes to the tool', legacyToolPath('/', '#k=C&p=Cmaj7,G7'), '/tool')
  eq('  …carrying nothing else about the URL', legacyToolPath('/', '#k=Am&p=Am'), TOOL_PATH)
  eq('  a bare front page stays put', legacyToolPath('/', ''), null)
  eq('  a fragment that is not a progression stays put', legacyToolPath('/', '#pricing'), null)
  eq('  and no other page is forwarded', legacyToolPath('/exercises', '#k=C&p=C'), null)
  eq('  every page round-trips', PAGES.every((p) => pageFor(p.route).path === p.path), true)

  // The SPA fallback is what makes a typed /privacy work at all; without it the
  // host 404s and the menu link only works from inside the app.
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  eq('  the host serves index.html for unknown paths', /not_found_handling"\s*:\s*"single-page-application"/.test(wrangler), true)
  // Relative asset URLs would break under /privacy/; see vite.config.js.
  const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
  eq('  asset URLs are root-absolute', /base:\s*'\/'/.test(viteConfig), true)
}

// A warning rather than a failure: shipping with placeholders is the author's
// call, but it should never happen without them having read this.
if (placeholders().length) {
  console.log(`\nWARNING: the legal pages still have placeholders (${placeholders().join(', ')}) — see src/pages/site.js`)
}

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' FAILURES'}`)

// Exit non-zero on failure so this can gate a deploy. Without it CI would go
// green on a broken build.
if (fails > 0) process.exit(1)
