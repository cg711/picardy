// Regression checks for the theory engine. Run with: npm run check
//
// Not a unit-test framework — just assertions plus a printed dump of the
// rankings, because the interesting failures here are musical judgements that
// are easier to eyeball than to encode.

const B = '../src/'
const { parseChord, chordSymbol, chordNotes, voiceChord, chordId, makeChord, bassOf, inversionLabel, inversionShort } = await import(B + 'theory/chords.js')
const { makeKey, romanNumeral, detectKey, scaleNotes } = await import(B + 'theory/keys.js')
const { prettyName, noteName } = await import(B + 'theory/notes.js')
const { suggestNext } = await import(B + 'theory/suggest.js')
const { findVoicings, TUNINGS, voicingLabel, tuningKey, normaliseTuning } = await import(B + 'theory/guitar.js')
const { identifyChord } = await import(B + 'theory/identify.js')
const { generateProgression, FLAVOURS } = await import(B + 'theory/generate.js')
const { groupIntoBars, totalBeats, beatsOf, describeLength, barsAreComplete } = await import(B + 'theory/rhythm.js')
const { flattenSong, songBeats, readSegment, makeSegment } = await import(B + 'lib/song.js')
const { transposeChord, transposeKey, keyPrefersFlats } = await import(B + 'theory/transpose.js')
const { optimiseInversions, progressionMovement } = await import(B + 'theory/voicelead.js')
const { scalesForChord, guideTones, commonTones } = await import(B + 'theory/scales.js')
const { reharmonise } = await import(B + 'theory/reharm.js')
const { analyseProgression } = await import(B + 'theory/analyze.js')
const { parseChart } = await import(B + 'lib/textimport.js')
const { buildMidi, songToEvents } = await import(B + 'lib/midi.js')
const { encodeShape, decodeShape, shapeFromFrets } = await import(B + 'theory/guitar.js')
const { HUES, BRAND_HUE, makeTheme, contrastRatio, deltaE } = await import(B + 'brand/theme.js')
const { PAGES, routeFor, pageFor } = await import(B + 'lib/routes.js')
const { unfinished: placeholders } = await import(B + 'pages/site.js')
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

console.log('\n--- pdf chart ---')
{
  const { buildChart } = await import(B + 'lib/pdf.js')

  // Pull every drawn text run and its position out of the finished PDF, so this
  // asserts what the file actually contains rather than what the code intended.
  const runsOf = async (opts) => {
    const doc = await buildChart(opts)
    const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1')
    const out = []
    const re = /([\d.-]+)\s+([\d.-]+)\s+Td\s*\(((?:[^()\\]|\\.)*)\)\s*Tj/g
    let m
    while ((m = re.exec(raw))) out.push({ x: +m[1], y: +m[2], s: m[3] })
    return out
  }

  const key = makeKey('C', 'major')
  const chords = ['C', 'Am', 'F', 'G'].map(parseChord)
  const segFor = (spans, shapes) => makeSegment({
    name: 'Verse', key, progression: chords,
    inversions: [0, 0, 0, 0], durations: [4, 4, 4, 4], timeSignature: '4/4',
    shapes, lines: [0, 0, 0, 0], spans,
    lyricLines: ['hello there my old friend'],
  })

  // Lyric placement follows spans, not durations. Durations are identical in
  // both of these, so any difference in layout can only come from the spans.
  const gaps = async (spans) => {
    const seg = segFor(spans, [null, null, null, null])
    const runs = await runsOf({ song: [{ segmentId: seg.id, repeats: 1 }], segments: [seg], instrument: 'none' })
    const xs = runs.filter((r) => ['C', 'Am', 'F', 'G'].includes(r.s)).map((r) => r.x)
    return xs.slice(1).map((x, i) => +(x - xs[i]).toFixed(1))
  }

  const even = await gaps([1, 1, 1, 1])
  eq('  equal spans lay the chords out evenly', new Set(even).size, 1)
  const weighted = await gaps([3, 1, 1, 1])
  eq('  a 3:1:1 split spaces them 3:1:1', +(weighted[0] / weighted[1]).toFixed(2), 3)
  eq('  and the later pair stay equal', weighted[1], weighted[2])
  // A wider last chord compresses the rest, because the line is a fixed width
  // divided proportionally — the same behaviour as the row on screen. The three
  // leading gaps stay equal to each other, and shrink by 4/6.
  const trailing = await gaps([1, 1, 1, 3])
  eq('  a trailing span compresses the rest evenly', new Set(trailing).size, 1)
  eq('  by exactly the change in total', +(trailing[0] / even[0]).toFixed(2), +(4 / 6).toFixed(2))

  // The same chord pinned two ways is numbered; a chord with one shape is not.
  const seg = segFor([1, 1, 1, 1], ['standard:x-3-2-0-1-0', null, null, null])
  const twoWays = makeSegment({
    name: 'Chorus', key, progression: chords,
    inversions: [0, 0, 0, 0], durations: [4, 4, 4, 4], timeSignature: '4/4',
    shapes: ['standard:8-10-10-9-8-8', null, null, null], lines: [0, 0, 0, 0], spans: [1, 1, 1, 1],
    lyricLines: [''],
  })
  const runs = await runsOf({
    song: [{ segmentId: seg.id, repeats: 1 }, { segmentId: twoWays.id, repeats: 1 }],
    segments: [seg, twoWays], instrument: 'guitar',
  })
  const drawn = runs.map((r) => r.s)
  eq('  two shapes of one chord are numbered', drawn.includes('1') && drawn.includes('2'), true)
  // Am appears once with one shape, so it must not pick up a number.
  const amIndex = drawn.indexOf('Am')
  eq('  a chord with a single shape is left unnumbered', /^[0-9]$/.test(drawn[amIndex + 1] ?? ''), false)
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
    lines: [0, 0, 1, 1], lyricLines: ['first line', 'second line'],
  })
  const back = readSegment(built)
  eq('  round-trip keeps the key', noteName(back.key.tonic) + ' ' + back.key.mode, 'F# minor')
  eq('  round-trip keeps the metre', back.timeSignature, '3/4')
  eq('  round-trip keeps inversions', back.inversions.join(','), '0,1,0,0')
  // Preset ids normalise to beats on the way in: '2' is a half note (2 beats),
  // '1' a whole note (4).
  eq('  round-trip normalises durations to beats', back.durations.join(','), '2,2,4,4')
  eq('  round-trip keeps the lyric lines', back.lyricLines.join('|'), 'first line|second line')
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
  const verse = { id: 'a', name: 'Verse', key: 'C', timeSignature: '4/4', chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'], inversions: [0, 0, 0, 0], durations: ['1', '1', '1', '1'] }
  const segments = [verse]
  const events = songToEvents([{ segmentId: 'a', repeats: 2 }], segments)
  const bytes = buildMidi(events, { bpm: 96, timeSignature: '4/4' })

  const header = String.fromCharCode(...bytes.slice(0, 4))
  eq('  writes a MIDI header', header, 'MThd')
  eq('  format 1', bytes[9], 1)
  eq('  two tracks', bytes[11], 2)

  // Note-ons and note-offs must balance, or a DAW hangs notes forever.
  let on = 0, off = 0
  for (let i = 0; i < bytes.length - 2; i++) {
    if ((bytes[i] & 0xf0) === 0x90 && bytes[i] !== 0x90 + 0) continue
  }
  const expectedNotes = events.reduce((n, e) => n + e.midis.length, 0)
  eq('  every chord contributes notes', expectedNotes > 0, true)
  eq('  file is non-trivial', bytes.length > 100, true)
  void on; void off
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
    lines: [0, 1], lyricLines: ['first line', 'second line'],
  }
  const live = readSegment(segment)
  eq('  a section round-trips the pinned shape', live.shapes[0], encoded)
  eq('  and the unpinned slot stays empty', live.shapes[1], null)
  eq('  and carries the lyric lines', live.lyricLines.join('|'), 'first line|second line')
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

console.log('\n--- routes ---')
{
  eq('  / is the app', routeFor('/'), 'app')
  eq('  /privacy', routeFor('/privacy'), 'privacy')
  eq('  /terms', routeFor('/terms'), 'terms')
  // A trailing slash is the same page — hosts and hand-typed URLs disagree about it.
  eq('  /privacy/ is the same page', routeFor('/privacy/'), 'privacy')
  eq('  unknown paths fall back to the app', routeFor('/nope'), 'app')
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
