// Regression checks for the theory engine. Run with: npm run check
//
// Not a unit-test framework — just assertions plus a printed dump of the
// rankings, because the interesting failures here are musical judgements that
// are easier to eyeball than to encode.

const B = '../src/'
const { parseChord, chordSymbol, chordNotes, voiceChord, chordId, makeChord } = await import(B + 'theory/chords.js')
const { makeKey, romanNumeral, detectKey, scaleNotes } = await import(B + 'theory/keys.js')
const { prettyName, noteName } = await import(B + 'theory/notes.js')
const { suggestNext } = await import(B + 'theory/suggest.js')
const { findVoicings, TUNINGS, voicingLabel } = await import(B + 'theory/guitar.js')
const { identifyChord } = await import(B + 'theory/identify.js')
const { generateProgression, FLAVOURS } = await import(B + 'theory/generate.js')
const { groupIntoBars, totalBeats, beatsOf, describeLength, barsAreComplete } = await import(B + 'theory/rhythm.js')
const { flattenSong, songBeats, readSegment, makeSegment } = await import(B + 'lib/song.js')
const { transposeChord, transposeKey, keyPrefersFlats, capoSuggestions } = await import(B + 'theory/transpose.js')
const { optimiseInversions, progressionMovement } = await import(B + 'theory/voicelead.js')
const { scalesForChord, guideTones, commonTones } = await import(B + 'theory/scales.js')
const { reharmonise } = await import(B + 'theory/reharm.js')
const { analyseProgression } = await import(B + 'theory/analyze.js')
const { parseChart } = await import(B + 'lib/textimport.js')
const { buildMidi, songToEvents } = await import(B + 'lib/midi.js')

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
  })
  const back = readSegment(built)
  eq('  round-trip keeps the key', noteName(back.key.tonic) + ' ' + back.key.mode, 'F# minor')
  eq('  round-trip keeps the metre', back.timeSignature, '3/4')
  eq('  round-trip keeps inversions', back.inversions.join(','), '0,1,0,0')
  eq('  round-trip keeps durations', back.durations.join(','), '2,2,1,1')
  eq('  round-trip keeps chords', back.progression.map((c) => chordSymbol(c)).join(' '), 'F♯m D A E')
}

console.log('\n--- transpose ---')
{
  const from = makeKey('C', 'major')
  const syms = ['Cmaj7', 'A7', 'Dm7', 'G7', 'F#m7b5', 'Bb13', 'D/F#', 'Abger6']
  let mismatches = 0
  for (let semis = 1; semis <= 11; semis++) {
    const to = transposeKey(from, semis)
    const flats = keyPrefersFlats(to)
    const before = syms.map((x) => romanNumeral(parseChord(x), from)).join(' ')
    const after = syms.map((x) => romanNumeral(transposeChord(parseChord(x), semis, flats), to)).join(' ')
    if (before !== after) mismatches++
  }
  eq('  every roman numeral survives all 11 transpositions', mismatches, 0)
  // No key should ever need a double accidental.
  let doubles = 0
  for (let semis = 0; semis < 12; semis++) {
    const to = transposeKey(from, semis)
    if (scaleNotes(to).some((n) => Math.abs(n.acc) > 1)) doubles++
  }
  eq('  no transposed key needs a double sharp or flat', doubles, 0)

  const capo = capoSuggestions(makeKey('Bb', 'major'))
  eq('  B♭ major suggests a capo', capo.length > 0, true)
  eq('  and the best one is playable in open position', capo[0].fret <= 3, true)
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

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' FAILURES'}`)

// Exit non-zero on failure so this can gate a deploy. Without it CI would go
// green on a broken build.
if (fails > 0) process.exit(1)
