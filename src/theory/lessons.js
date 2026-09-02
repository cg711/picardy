// Theory lessons whose examples are built by the engine that powers the tool.
//
// The temptation with a lessons section is to type the examples out as text:
// "try Dm7–G7–Cmaj7". That text is a second source of truth, and the day the
// spelling rules change it starts quietly lying to readers — a teaching page
// that contradicts the tool it is teaching is worse than no page at all.
//
// So an example here is a list of scale degrees, not a list of chord names. The
// chords are built by makeChord, the symbols come from chordSymbol, the numerals
// from romanNumeral and the cadence from cadenceAt — the same functions the
// studio calls. Nothing on the page is written by hand.
//
// What *is* written by hand is `expect`: what the author believes the engine
// will say. The check suite compares the two and fails loudly on any
// disagreement, so a lesson can never drift from the engine, and an engine
// change that would make a lesson wrong cannot land quietly.

import { makeKey, romanNumeral, spellDegree } from './keys.js'
import { makeChord, chordSymbol } from './chords.js'
import { cadenceAt } from './analyze.js'

/**
 * One example, compiled.
 *
 * Returns the shape encodeState wants alongside the readings, so "play this",
 * "open this in the studio" and "print the numerals under it" are all the same
 * object rather than three parallel reconstructions of it.
 */
export function buildExample(example) {
  if (!example) return null
  const key = makeKey(example.tonic, example.mode)
  if (!key) return null

  const progression = []
  const durations = []
  const inversions = []
  // The fifth slot is the inversion. Several of these lessons are *about* a
  // chord's position — a cadential 6/4 in root position is not the figure at
  // all — so an example has to be able to say which one it means.
  for (const [semis, generic, qualityId, beats, inversion] of example.chords) {
    const chord = makeChord(spellDegree(key, semis, generic), qualityId)
    if (!chord) return null
    progression.push(chord)
    durations.push(beats ?? 4)
    inversions.push(inversion ?? 0)
  }

  const cadence = cadenceAt(progression, progression.length - 1, key)

  return {
    key,
    progression,
    durations,
    inversions,
    timeSignature: example.timeSignature ?? '4/4',
    bpm: example.bpm ?? 96,
    style: example.style ?? 'block',
    symbols: progression.map((chord) => chordSymbol(chord)),
    numerals: progression.map((chord, i) => romanNumeral(chord, key, inversions[i])),
    cadence: cadence ? cadence.label : null,
    cadenceWhy: cadence ? cadence.why : null,
  }
}

// [semitonesAboveTonic, genericDegree, qualityId, beats?] — the same degree
// vocabulary the roman-numeral picker and the backing presets use.
export const LESSONS = [
  {
    id: 'roman-numerals',
    title: 'Roman numerals',
    blurb: 'Why chord charts are written in numbers, and how to read them.',
    minutes: 6,
    sections: [
      {
        heading: 'The same song in two keys',
        body: [
          `A chord name tells you what to play. A roman numeral tells you what the chord is
           *doing*. The difference matters the moment a singer asks you to take it down a
           step — the letters all change, and nothing about the music does.`,
        ],
        example: {
          caption: 'The 50s turnaround, in C',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [9, 6, 'min'], [5, 4, 'maj'], [7, 5, 'maj']],
          expect: { symbols: ['C', 'Am', 'F', 'G'], numerals: ['I', 'vi', 'IV', 'V'], cadence: 'half cadence' },
        },
      },
      {
        heading: null,
        body: [
          `Now the same four chords in E♭. Every letter is different. Every numeral is
           identical, because it is the same progression — that is the whole point of the
           notation.`,
        ],
        example: {
          caption: 'And in E♭',
          tonic: 'Eb', mode: 'major',
          chords: [[0, 1, 'maj'], [9, 6, 'min'], [5, 4, 'maj'], [7, 5, 'maj']],
          expect: { symbols: ['E♭', 'Cm', 'A♭', 'B♭'], numerals: ['I', 'vi', 'IV', 'V'], cadence: 'half cadence' },
        },
      },
      {
        heading: 'Reading the case',
        body: [
          `Upper case is a major triad, lower case is minor. A small circle is diminished,
           a slashed circle is half-diminished. A flat in front of the numeral means the
           root is a half step below where the key would put it — so ♭VII in C major is a
           B♭ chord, not a B.`,
        ],
        points: [
          'I ii iii IV V vi vii° — the seven chords a major key gives you for free',
          'i ii° ♭III iv v ♭VI ♭VII — the same for a natural minor key',
          'A numeral with a slash, like V7/ii, belongs to a different key for one chord',
          'Numbers after the numeral are the extensions: V7, Imaj7, ii7',
        ],
      },
      {
        heading: 'Minor keys',
        body: [
          `A minor key flattens three of the seven degrees, and the numerals say so. This
           four-chord vamp is most of the modal pop written since 1965.`,
        ],
        example: {
          caption: 'i–♭VI–♭III–♭VII in A minor',
          tonic: 'A', mode: 'minor',
          chords: [[0, 1, 'min'], [8, 6, 'maj'], [3, 3, 'maj'], [10, 7, 'maj']],
          expect: { symbols: ['Am', 'F', 'C', 'G'], numerals: ['i', '♭VI', '♭III', '♭VII'], cadence: null },
        },
      },
    ],
  },

  {
    id: 'harmonic-function',
    title: 'Tonic, subdominant, dominant',
    blurb: 'Every chord in a key does one of three jobs. Once you can hear which, the rest follows.',
    minutes: 5,
    sections: [
      {
        heading: 'Three jobs',
        body: [
          `Home, away, and the tension that pulls you back. Tonic is rest. Subdominant is
           departure. Dominant is the chord that wants to resolve, and the one that makes
           the return feel earned.`,
        ],
        example: {
          caption: 'One of each, then home',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [5, 4, 'maj'], [7, 5, 'maj'], [0, 1, 'maj']],
          expect: { symbols: ['C', 'F', 'G', 'C'], numerals: ['I', 'IV', 'V', 'I'], cadence: 'authentic cadence' },
        },
      },
      {
        heading: 'What makes a dominant pull',
        body: [
          `The tritone. In G7 the B and the F are three whole tones apart, an interval with
           only one comfortable resolution: B leans up to C, F leans down to E. Play the
           chord and you can feel where it wants to go before you know why.`,
          `Take the seventh away and the pull softens — a plain V still resolves, but it is
           a suggestion rather than an argument.`,
        ],
      },
      {
        heading: 'Substitutes',
        body: [
          `Chords that share notes share jobs. vi has two notes in common with I, so it can
           stand in for home. ii shares three with IV, so it departs the same way — which
           is why ii–V–I and IV–V–I feel like versions of one another.`,
        ],
        points: [
          'Tonic: I, vi, iii',
          'Subdominant: IV, ii',
          'Dominant: V, vii°',
        ],
      },
    ],
  },

  {
    id: 'cadences',
    title: 'Cadences',
    blurb: 'How a phrase ends, and how much it sounds like an ending.',
    minutes: 7,
    sections: [
      {
        heading: 'The full stop',
        body: [
          `A perfect authentic cadence is V7 to I with the leading tone rising into the
           tonic. It is the strongest ending in the language, which is why it closes almost
           every hymn, symphony and pop song you have ever heard.`,
        ],
        example: {
          caption: 'V7–I',
          tonic: 'C', mode: 'major',
          chords: [[7, 5, 'dom7'], [0, 1, 'maj']],
          expect: { symbols: ['G7', 'C'], numerals: ['V7', 'I'], cadence: 'perfect authentic cadence' },
        },
      },
      {
        heading: 'The amen',
        body: [
          `IV to I has no leading tone anywhere in it, so it settles rather than resolves.
           It is softer, older, and slightly ceremonial — hence the nickname.`,
        ],
        example: {
          caption: 'IV–I',
          tonic: 'C', mode: 'major',
          chords: [[5, 4, 'maj'], [0, 1, 'maj']],
          expect: { symbols: ['F', 'C'], numerals: ['IV', 'I'], cadence: 'plagal cadence' },
        },
      },
      {
        heading: 'Borrowing the minor for it',
        body: [
          `Make that IV minor and the ♭6 falls a half step into the tonic chord. Same
           gesture, considerably more bittersweet — the Beatles ending.`,
        ],
        example: {
          caption: 'iv–I',
          tonic: 'C', mode: 'major',
          chords: [[5, 4, 'min'], [0, 1, 'maj']],
          expect: { symbols: ['Fm', 'C'], numerals: ['iv', 'I'], cadence: 'minor plagal cadence' },
        },
      },
      {
        heading: 'The one that lies',
        body: [
          `The dominant sets up the tonic and then sidesteps to vi. Nothing is wrong; the
           phrase simply refuses to be over, which is exactly what you want eight bars
           before you actually finish.`,
        ],
        example: {
          caption: 'V7–vi',
          tonic: 'C', mode: 'major',
          chords: [[7, 5, 'dom7'], [9, 6, 'min']],
          expect: { symbols: ['G7', 'Am'], numerals: ['V7', 'vi'], cadence: 'deceptive cadence' },
        },
      },
      {
        heading: 'The comma',
        body: [
          `A half cadence does not end on the tonic at all — it rests on V and waits. Half
           the verses ever written stop here at the midpoint and answer themselves in the
           second half.`,
        ],
        example: {
          caption: 'ii–V, resting on the dominant',
          tonic: 'C', mode: 'major',
          chords: [[2, 2, 'min'], [7, 5, 'maj']],
          expect: { symbols: ['Dm', 'G'], numerals: ['ii', 'V'], cadence: 'half cadence' },
        },
      },
      {
        heading: 'In minor',
        body: [
          `The Phrygian half cadence is iv–V in a minor key, with ♭6 falling a half step
           onto the dominant. It is the sound of the end of a slow movement, and of most
           flamenco.`,
        ],
        example: {
          caption: 'iv–V in A minor',
          tonic: 'A', mode: 'minor',
          chords: [[5, 4, 'min'], [7, 5, 'maj']],
          expect: { symbols: ['Dm', 'E'], numerals: ['iv', 'V'], cadence: 'Phrygian half cadence' },
        },
      },
    ],
  },

  {
    id: 'ii-v-i',
    title: 'Why ii–V–I is everywhere',
    blurb: 'The most common three chords in jazz, and the voice leading that explains them.',
    minutes: 6,
    sections: [
      {
        heading: 'Roots falling by fourths',
        body: [
          `D to G to C. Each root rises a fourth, which is the strongest root motion there
           is — every chord is the dominant of the next one along. Stack enough of them and
           you get the circle of fifths, which is most of jazz.`,
        ],
        example: {
          caption: 'ii7–V7–Imaj7 in C',
          tonic: 'C', mode: 'major',
          chords: [[2, 2, 'm7'], [7, 5, 'dom7'], [0, 1, 'maj7', 8]],
          bpm: 132, style: 'swing',
          expect: { symbols: ['Dm7', 'G7', 'Cmaj7'], numerals: ['ii7', 'V7', 'Imaj7'], cadence: 'perfect authentic cadence' },
        },
      },
      {
        heading: 'The guide tones',
        body: [
          `Watch the thirds and sevenths. In Dm7 they are F and C. In G7 they are B and F —
           the F is held, the C steps down to B. In Cmaj7 they are E and B — the B is held,
           the F falls to E.`,
          `Two voices, moving by half step or not at all, carry the entire progression. That
           is why it sounds inevitable, and why a pianist can comp the whole thing with two
           fingers.`,
        ],
      },
      {
        heading: 'In minor',
        body: [
          `The ii becomes half-diminished and the V keeps its major third — borrowed from
           harmonic minor, because the leading tone is what makes a dominant a dominant.`,
        ],
        example: {
          caption: 'iiø7–V7–i7 in C minor',
          tonic: 'C', mode: 'minor',
          chords: [[2, 2, 'm7b5'], [7, 5, 'dom7'], [0, 1, 'm7', 8]],
          bpm: 120, style: 'swing',
          expect: { symbols: ['Dm7♭5', 'G7', 'Cm7'], numerals: ['iiø7', 'V7', 'i7'], cadence: 'perfect authentic cadence' },
        },
      },
    ],
  },

  {
    id: 'secondary-dominants',
    title: 'Secondary dominants',
    blurb: 'Borrowing the pull of a dominant to make any chord feel like home for a moment.',
    minutes: 6,
    sections: [
      {
        heading: 'A dominant for a chord that is not the tonic',
        body: [
          `Any major or minor chord in a key can be approached by its own dominant. The
           chord you land on is not the tonic, but for one beat it behaves like one — the
           technical word is tonicisation.`,
          `In C major the ii chord is Dm. The dominant of D is A7 — a chord with a C♯ in it,
           which is not in the key at all. That C♯ is the whole effect: an accidental that
           announces a temporary destination.`,
        ],
        example: {
          caption: 'V7/ii, tonicising the ii chord',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [9, 6, 'dom7'], [2, 2, 'min'], [7, 5, 'dom7'], [0, 1, 'maj']],
          expect: {
            symbols: ['C', 'A7', 'Dm', 'G7', 'C'],
            numerals: ['I', 'V7/ii', 'ii', 'V7', 'I'],
            cadence: 'perfect authentic cadence',
          },
        },
      },
      {
        heading: 'Five of five',
        body: [
          `The most common one by far. D7 is the dominant of G, and G is the dominant of C —
           so D7 pulls to V, which pulls home. Two dominants in a row, each one raising the
           stakes.`,
          `The numeral notation reads exactly as you say it: V7/V, "five seven of five".`,
        ],
        example: {
          caption: 'V7/V–V7–I',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [2, 2, 'dom7'], [7, 5, 'dom7'], [0, 1, 'maj']],
          expect: {
            symbols: ['C', 'D7', 'G7', 'C'],
            numerals: ['I', 'V7/V', 'V7', 'I'],
            cadence: 'perfect authentic cadence',
          },
        },
      },
      {
        heading: 'How to spot one',
        body: [
          `A major or dominant-seventh chord with an accidental in it, sitting a fifth above
           the chord that follows. If the next chord is a fifth below, you have found one.`,
        ],
      },
    ],
  },

  {
    id: 'borrowed-chords',
    title: 'Borrowed chords',
    blurb: 'Taking chords from the parallel minor, and why it sounds like weather.',
    minutes: 5,
    sections: [
      {
        heading: 'Modal mixture',
        body: [
          `C major and C minor share a tonic. That makes the minor key's chords available to
           the major one — you keep the home note and borrow the colour. The usual suspects
           are iv, ♭VI and ♭VII.`,
        ],
        example: {
          caption: 'iv, borrowed from C minor',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [5, 4, 'min'], [0, 1, 'maj', 8]],
          expect: { symbols: ['C', 'Fm', 'C'], numerals: ['I', 'iv', 'I'], cadence: 'minor plagal cadence' },
        },
      },
      {
        heading: 'The flat seven',
        body: [
          `♭VII is a major chord a whole step below the tonic — B♭ in C major. It has no
           leading tone, which is precisely why rock likes it: it approaches the tonic
           without the formality of a dominant.`,
        ],
        example: {
          caption: 'I–♭VII–IV–I',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [10, 7, 'maj'], [5, 4, 'maj'], [0, 1, 'maj']],
          expect: { symbols: ['C', 'B♭', 'F', 'C'], numerals: ['I', '♭VII', 'IV', 'I'], cadence: 'plagal cadence' },
        },
      },
      {
        heading: 'The big ending',
        body: [
          `♭VI to ♭VII to I climbs into the tonic from below, both borrowed chords stepping
           up by whole tones. Every film score that has ever ended triumphantly has done
           this.`,
        ],
        example: {
          caption: '♭VI–♭VII–I',
          tonic: 'C', mode: 'major',
          chords: [[8, 6, 'maj'], [10, 7, 'maj'], [0, 1, 'maj', 8]],
          expect: { symbols: ['A♭', 'B♭', 'C'], numerals: ['♭VI', '♭VII', 'I'], cadence: null },
        },
      },
    ],
  },

  {
    id: 'inversions',
    title: 'Inversions and the bass line',
    blurb: 'The bass note is a melody too. Choosing it is most of what separates a chart from an arrangement.',
    minutes: 5,
    sections: [
      {
        heading: 'The note underneath',
        body: [
          `A chord is a set of notes; an inversion is a decision about which one goes at the
           bottom. Root position is stable. First inversion, with the third in the bass, is
           lighter and wants to keep moving.`,
          `Written as a slash — C/E is a C chord with E in the bass — or as figured bass on
           the numeral, where I becomes I6.`,
        ],
      },
      {
        heading: 'Stepwise bass',
        body: [
          `Use inversions to make the bass walk instead of leap. The same four chords with a
           bass line that moves by step will sound like an arrangement rather than a chart —
           try this one in the studio and change the inversion of the middle chords.`,
        ],
        example: {
          caption: 'I–iii–IV–V, ready to be inverted',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj'], [4, 3, 'min'], [5, 4, 'maj'], [7, 5, 'maj']],
          expect: { symbols: ['C', 'Em', 'F', 'G'], numerals: ['I', 'iii', 'IV', 'V'], cadence: 'half cadence' },
        },
      },
      {
        heading: 'Where it matters most',
        body: [
          `A cadence is the one place to think twice. A perfect authentic cadence needs both
           chords in root position — put the dominant in first inversion and the ending goes
           soft, which is either a mistake or exactly what you wanted.`,
        ],
      },
    ],
  },

  {
    id: 'twelve-bar-blues',
    title: 'The twelve-bar blues',
    blurb: 'Three chords, twelve bars, and a quarrel with common-practice theory.',
    minutes: 6,
    sections: [
      {
        heading: 'The form',
        body: [
          `Four bars of I, two of IV, two of I, then the turnaround: V, IV, I, V. Every
           chord is a dominant seventh, including the tonic — which is the part that breaks
           the rules.`,
        ],
        example: {
          caption: 'Twelve-bar blues in C',
          tonic: 'C', mode: 'major',
          bpm: 100, style: 'swing',
          chords: [
            [0, 1, 'dom7'], [5, 4, 'dom7'], [0, 1, 'dom7'], [0, 1, 'dom7'],
            [5, 4, 'dom7'], [5, 4, 'dom7'], [0, 1, 'dom7'], [0, 1, 'dom7'],
            [7, 5, 'dom7'], [5, 4, 'dom7'], [0, 1, 'dom7'], [7, 5, 'dom7'],
          ],
          expect: {
            symbols: ['C7', 'F7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7'],
            numerals: ['V7/IV', 'IV7', 'V7/IV', 'V7/IV', 'IV7', 'IV7', 'V7/IV', 'V7/IV', 'V7', 'IV7', 'V7/IV', 'V7'],
            cadence: 'half cadence',
          },
        },
      },
      {
        heading: 'Why the numerals above look wrong',
        body: [
          `Picardy labels those tonic chords V7/IV, not I7 — and a blues player would call
           that nonsense. Both are defensible, and the disagreement is worth understanding.`,
          `In common-practice harmony a dominant seventh means one thing: tension resolving
           down a fifth. A C7 contains a B♭, which is not in C major, and it does resolve to
           F. By that logic it genuinely is the dominant of IV, and the engine is applying
           the rule consistently rather than making an exception it cannot justify.`,
          `The blues simply does not use dominant sevenths that way. There the seventh is a
           colour, not a tension — the tonic chord is a tonic that happens to have a ♭7 in
           it, and it resolves nowhere. The form is I7–IV7–V7 and always was.`,
          `The honest summary: analysis is a lens, not a fact. When the engine's reading and
           your ears disagree about a style the engine was not built for, your ears are
           reporting the more useful truth.`,
        ],
      },
      {
        heading: 'The quick change',
        body: [
          `Bar two often goes to IV and straight back — the "quick change". It gives the
           form an early lift, and it is the single most common variation of the twelve
           bars.`,
        ],
      },
    ],
  },

  {
    id: 'tritone-substitution',
    title: 'Tritone substitution',
    blurb: 'Swapping a dominant for the one a tritone away, and getting a chromatic bass line for free.',
    minutes: 5,
    sections: [
      {
        heading: 'Two chords, one tritone',
        body: [
          `G7 contains B and F. D♭7 contains F and C♭ — the same two pitches, spelled
           differently and swapped around. The tritone that gives a dominant its pull is
           shared by two chords a tritone apart, so either can resolve to C.`,
        ],
        example: {
          caption: 'ii7–♭II7–Imaj7',
          tonic: 'C', mode: 'major',
          chords: [[2, 2, 'm7'], [1, 2, 'dom7'], [0, 1, 'maj7', 8]],
          bpm: 120, style: 'swing',
          expect: { symbols: ['Dm7', 'D♭7', 'Cmaj7'], numerals: ['ii7', '♭II7', 'Imaj7'], cadence: null },
        },
      },
      {
        heading: 'What you gain',
        body: [
          `A bass line that walks down by half step — D, D♭, C — instead of leaping a
           fourth. The upper voices barely move, so the substitution costs nothing and the
           bass gets a chromatic descent.`,
          `Picardy does not name ♭II7–I as a cadence, because it is a substitution rather
           than one of the classical patterns. The numeral tells you what happened; whether
           it ends the phrase is up to the phrase.`,
        ],
      },
      {
        heading: 'Try it yourself',
        body: [
          `Open any progression with a V7 in the studio and use Reharmonise on that chord —
           the tritone substitution will be among the options, alongside the related
           dominants and approach chords.`,
        ],
      },
    ],
  },
]

// The second tranche, read out of Aldwell & Schachter. The first nine lean jazz
// and pop — ii–V–I, the blues, tritone substitution — so these come at the music
// from the common-practice side instead of adding more of the same. Six of them
// teach something the engine learned at the same time, which is why they can
// show it rather than describe it.
LESSONS.push(
  {
    id: 'cadential-six-four',
    title: 'The cadential 6/4',
    blurb: 'A chord that spells a tonic and behaves like a dominant — the best argument there is that analysis is a reading.',
    minutes: 6,
    sections: [
      {
        heading: 'A tonic that is not one',
        body: [
          `Put a tonic triad over the dominant in the bass, just before the dominant
           arrives, and something odd happens: it stops sounding like the tonic. The bass
           is already where the dominant will be and does not move. The 6th and 4th above
           it are dissonances, and they fall to the 5th and 3rd.`,
          `Spelled out, it is a I chord. Heard, it is an ornamented V. Aldwell & Schachter
           give it a whole unit and write it under V rather than under I.`,
        ],
        example: {
          caption: 'I 6/4 leaning into V7',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4, 2], [7, 5, 'dom7', 4], [0, 1, 'maj', 8]],
          expect: { symbols: ['C', 'G7', 'C'], numerals: ['I 6/4', 'V7', 'I'], cadence: 'perfect authentic cadence' },
        },
      },
      {
        heading: 'Why the position matters',
        body: [
          `Play the same three chords with the first in root position and the effect is
           gone. It is a tonic going to a dominant going back to the tonic — three
           harmonies, one after another, rather than a dominant with a decoration on the
           front of it.`,
        ],
        example: {
          caption: 'The same chords, root position — not the same figure',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4], [7, 5, 'dom7', 4], [0, 1, 'maj', 8]],
          expect: { symbols: ['C', 'G7', 'C'], numerals: ['I', 'V7', 'I'], cadence: 'perfect authentic cadence' },
        },
      },
      {
        heading: 'In minor, and in the app',
        body: [
          `The same figure works identically in a minor key. Open either example in the
           studio and the analysis panel colours the first chord as a dominant and prints
           "V 6/4" underneath it — because Picardy reads it the way this lesson does.`,
          `It also has to fall on a strong beat. A 6/4 on a weak beat between two positions
           of the same chord is a passing chord, which is a different thing entirely — the
           next lesson.`,
        ],
        example: {
          caption: 'i 6/4 in A minor',
          tonic: 'A', mode: 'minor',
          chords: [[0, 1, 'min', 4, 2], [7, 5, 'dom7', 4], [0, 1, 'min', 8]],
          expect: { symbols: ['Am', 'E7', 'Am'], numerals: ['i 6/4', 'V7', 'i'], cadence: 'perfect authentic cadence' },
        },
      },
    ],
  },

  {
    id: 'contrapuntal-chords',
    title: 'Chords that are not harmonies',
    blurb: 'Some chords carry the structure and some decorate it. Telling them apart changes what a progression is.',
    minutes: 7,
    sections: [
      {
        heading: 'Three chords, one harmony',
        body: [
          `Here is a tonic, then a diminished chord, then the tonic again in first
           inversion. It looks like three chords. It is one: the bass walks C–D–E and the
           chord in the middle exists to carry it there.`,
          `Nothing has left the tonic. The vii°6 is a passing chord, and an analysis writes
           it in parentheses to say so.`,
        ],
        example: {
          caption: 'I–(vii°6)–I6, one tonic prolonged',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4], [11, 7, 'dim', 2, 1], [0, 1, 'maj', 4, 1], [7, 5, 'dom7', 4], [0, 1, 'maj', 8]],
          expect: {
            symbols: ['C', 'B°', 'C', 'G7', 'C'],
            numerals: ['I', 'vii° 6', 'I 6', 'V7', 'I'],
            cadence: 'perfect authentic cadence',
          },
        },
      },
      {
        heading: 'The pedal version',
        body: [
          `The same idea with a bass that does not move at all. The upper voices step away
           and come back; for one beat they spell a IV chord, but no subdominant has
           arrived — the tonic is still in force underneath.`,
        ],
        example: {
          caption: 'I–(IV 6/4)–I over a held bass',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4], [5, 4, 'maj', 4, 2], [0, 1, 'maj', 8]],
          expect: { symbols: ['C', 'F', 'C'], numerals: ['I', 'IV 6/4', 'I'], cadence: 'plagal cadence' },
        },
      },
      {
        heading: 'How to tell',
        body: [
          `Two questions. Does the bass step through, or hold? And is the chord standing on
           its own root, or borrowing a bass from the harmony either side of it?`,
          `A chord on its own root is almost always a real harmony. C–Dm–C is I–ii–I, not a
           tonic with a decoration inside it. Every contrapuntal chord in the textbooks is
           an inversion, and that is not a coincidence — sitting over a borrowed bass is
           what makes it subordinate.`,
        ],
        points: [
          'Passing: the bass walks by step from one position of a chord to another',
          'Neighbour: the harmony either side is the same and the bass steps away and back',
          'Pedal: the bass holds while the voices above it move and return',
          'On its own root, in root position: almost certainly a harmony, not decoration',
        ],
      },
    ],
  },

  {
    id: 'suspensions',
    title: 'Suspensions',
    blurb: 'Prepare, suspend, resolve — the oldest way of making a line pull against its chord.',
    minutes: 5,
    sections: [
      {
        heading: 'Three parts',
        body: [
          `A suspension is a note that was consonant, stayed where it was while the harmony
           changed underneath it, and then fell by step into the new chord. The three
           stages have names: preparation, suspension, resolution.`,
          `The middle stage is the point. For a moment the note is wrong, and everyone can
           hear where it has to go.`,
        ],
      },
      {
        heading: 'As a chord',
        body: [
          `The commonest one is the 4–3 over a dominant: the fourth above the bass held
           from the chord before, resolving down to the third. It is common enough to have
           its own chord symbol.`,
        ],
        example: {
          caption: 'A 4–3 suspension over the dominant',
          tonic: 'C', mode: 'major',
          chords: [[7, 5, 'sevenSus4', 4], [7, 5, 'dom7', 4], [0, 1, 'maj', 8]],
          expect: { symbols: ['G7sus4', 'G7', 'C'], numerals: ['V7sus4', 'V7', 'I'], cadence: 'perfect authentic cadence' },
        },
      },
      {
        heading: 'As a melody',
        body: [
          `Written into a line rather than a chord symbol, it is a note that overlaps the
           bar. Open the Melody tab, draw a note that starts under one chord and is still
           sounding under the next, then step it down — Picardy will mark it "sus" and say
           what it is.`,
          `Resolve it upward instead and it becomes a retardation, which is rarer and
           sounds like a held breath rather than a sigh.`,
        ],
      },
    ],
  },

  {
    id: 'tonicisation-and-modulation',
    title: 'Tonicisation and modulation',
    blurb: 'When does a borrowed dominant become a new key? The answer is about how long you stay.',
    minutes: 6,
    sections: [
      {
        heading: 'Visiting',
        body: [
          `An applied dominant points at a chord that is not the tonic and makes it feel,
           briefly, like home. A7 in C major has a C♯ in it — a note from outside the key —
           and it resolves to D minor.`,
          `But nothing has changed key. The next chord is a plain V7 in C and the phrase
           closes in C. The visit lasted one chord.`,
        ],
        example: {
          caption: 'A tonicisation of ii — still C major throughout',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4], [9, 6, 'dom7', 4], [2, 2, 'min', 4], [7, 5, 'dom7', 4], [0, 1, 'maj', 8]],
          expect: {
            symbols: ['C', 'A7', 'Dm', 'G7', 'C'],
            numerals: ['I', 'V7/ii', 'ii', 'V7', 'I'],
            cadence: 'perfect authentic cadence',
          },
        },
      },
      {
        heading: 'Moving in',
        body: [
          `Now the same idea, held. Four bars establish C, and then the music goes to G and
           stays: its own dominant, its own tonic, twice over. By the end, G is not a chord
           in C major any more — it is where the music lives.`,
          `Open this one in the studio. The analysis panel reads the first half in C and the
           second in G, marks the join, and names the pivot — because the difference between
           the two examples on this page is exactly the difference the engine had to learn.`,
        ],
        example: {
          caption: 'A modulation to the dominant',
          tonic: 'C', mode: 'major',
          chords: [
            [0, 1, 'maj', 4], [5, 4, 'maj', 4], [7, 5, 'maj', 4], [0, 1, 'maj', 4],
            [2, 2, 'dom7', 4], [7, 5, 'maj', 4], [2, 2, 'dom7', 4], [7, 5, 'maj', 8],
          ],
          expect: {
            symbols: ['C', 'F', 'G', 'C', 'D7', 'G', 'D7', 'G'],
            numerals: ['I', 'IV', 'V', 'I', 'V7/V', 'V', 'V7/V', 'V'],
            cadence: 'half cadence',
          },
        },
      },
      {
        heading: 'Where the line is',
        body: [
          `There is no bar count that settles it, and reasonable analysts disagree about
           particular passages. What everyone agrees on is the principle: a tonicisation is
           a chord borrowing a dominant, a modulation is a key you stay in long enough to
           be confirmed — usually by a cadence in the new key.`,
          `Notice also that the numerals above change meaning halfway through. The same G
           chord is V in the first half and I in the second. That is not the engine being
           inconsistent; it is what modulating means.`,
        ],
      },
    ],
  },

  {
    id: 'sequences',
    title: 'Sequences',
    blurb: 'One pattern, moved. Four of them generate an enormous amount of tonal music.',
    minutes: 6,
    sections: [
      {
        heading: 'The falling fifths',
        body: [
          `Take a root motion and repeat it down the scale. The commonest by far is the
           descending fifth: every chord is the dominant of the next, all the way round the
           key and back to where it started.`,
          `One link is not a perfect fifth — in C major, F to B is a tritone, because the
           scale has only the notes it has. That is why a sequence is counted in scale
           steps rather than in semitones.`,
        ],
        example: {
          caption: 'Descending fifths, all seven diatonic chords',
          tonic: 'C', mode: 'major',
          chords: [
            [0, 1, 'maj', 4], [5, 4, 'maj', 4], [11, 7, 'dim', 4], [4, 3, 'min', 4],
            [9, 6, 'min', 4], [2, 2, 'min', 4], [7, 5, 'maj', 4], [0, 1, 'maj', 8],
          ],
          expect: {
            symbols: ['C', 'F', 'B°', 'Em', 'Am', 'Dm', 'G', 'C'],
            numerals: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
            cadence: 'authentic cadence',
          },
        },
      },
      {
        heading: 'Falling thirds',
        body: [
          `Up a fifth, then up a step, repeated — which lands the roots a third lower each
           time round. Pachelbel, and about half of everything written since.`,
        ],
        example: {
          caption: 'The falling-thirds sequence',
          tonic: 'C', mode: 'major',
          chords: [
            [0, 1, 'maj', 4], [7, 5, 'maj', 4], [9, 6, 'min', 4],
            [4, 3, 'min', 4], [5, 4, 'maj', 4], [0, 1, 'maj', 8],
          ],
          expect: {
            symbols: ['C', 'G', 'Am', 'Em', 'F', 'C'],
            numerals: ['I', 'V', 'vi', 'iii', 'IV', 'I'],
            cadence: 'plagal cadence',
          },
        },
      },
      {
        heading: 'What they are for',
        body: [
          `A sequence is how tonal music covers ground. It takes you somewhere without
           requiring a new idea at every step, and because the pattern is audible the ear
           will follow it a long way before it tires.`,
          `Both examples above are named by the studio's analysis panel rather than
           described as a count of falling fifths — which is what it used to say.`,
        ],
        points: [
          'Descending fifths — every chord the dominant of the next; the strongest pull',
          'Ascending fifths — the same motion reversed, and much rarer',
          'Ascending 5–6 — down a third, up a fourth; a rising line without parallel fifths',
          'Descending 5–6 — up a fifth, up a step; the roots fall in thirds',
        ],
      },
    ],
  },

  {
    id: 'parallel-fifths',
    title: 'Why parallel fifths',
    blurb: 'The rule everyone has heard and few can justify. It is a style constraint, not a law.',
    minutes: 5,
    sections: [
      {
        heading: 'What the rule says',
        body: [
          `If two voices are a fifth apart and both move to another fifth in the same
           direction, they stop sounding like two voices. The interval is stable enough,
           and the motion parallel enough, that the ear fuses them into one line with a
           bright edge.`,
          `Common-practice writing avoids it for exactly that reason: the whole point of
           four-part texture is four independent parts, and a parallel fifth spends two of
           them on one line.`,
        ],
        example: {
          caption: 'V–IV in root position — the classic trap',
          tonic: 'C', mode: 'major',
          chords: [[7, 5, 'maj', 4], [5, 4, 'maj', 4]],
          expect: { symbols: ['G', 'F'], numerals: ['V', 'IV'], cadence: null },
        },
      },
      {
        heading: 'Why that example',
        body: [
          `Two root-position triads a step apart have no notes in common, so every voice
           has to move, and if they all move the same way the fifth between the outer two
           moves with them. This is why textbooks teach V–IV as a special case: it is
           hard to write without parallels unless the upper voices come down.`,
          `Open it in the studio, turn on the Voice leading reading in the analysis panel,
           and it will tell you. Then press Smooth voicing and watch it fix itself by
           choosing an inversion instead.`,
        ],
      },
      {
        heading: 'And when it is not a fault',
        body: [
          `Rock guitar is built on parallel fifths. So is organum, so is a great deal of
           film music, and so is every power chord ever played. The rule belongs to a
           style, and outside that style it describes a sound rather than a mistake.`,
          `Picardy reports them only when you ask, and says so on the panel. It is a
           writing tool, not a homework marker.`,
        ],
      },
    ],
  },

  {
    id: 'leading-tone-sevenths',
    title: 'Leading-tone sevenths',
    blurb: 'Dominants with the root taken away — and the one chord that resolves in four directions.',
    minutes: 5,
    sections: [
      {
        heading: 'A dominant without its root',
        body: [
          `Take G7 in C — G B D F — and remove the G. What is left is B D F, a diminished
           triad, and it still contains the tritone that made the chord pull. Add another
           third on top and you have B D F A♭: a fully diminished seventh.`,
          `It behaves like a dominant because it is one, minus its root.`,
        ],
        example: {
          caption: 'vii°7 resolving to the tonic',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4], [11, 7, 'dim7', 4], [0, 1, 'maj', 8]],
          expect: { symbols: ['C', 'B°7', 'C'], numerals: ['I', 'vii°7', 'I'], cadence: null },
        },
      },
      {
        heading: 'Applied to anything',
        body: [
          `Because it is a dominant, it can be aimed at any chord, the same way an applied
           V7 can. A diminished seventh a half step below a chord will lead to it.`,
        ],
        example: {
          caption: 'vii°7/V, aimed at the dominant',
          tonic: 'C', mode: 'major',
          chords: [[0, 1, 'maj', 4], [6, 4, 'dim7', 4], [7, 5, 'maj', 4], [0, 1, 'maj', 8]],
          expect: {
            symbols: ['C', 'F♯°7', 'G', 'C'],
            numerals: ['I', 'vii°7/V', 'V', 'I'],
            cadence: 'authentic cadence',
          },
        },
      },
      {
        heading: 'The half-diminished one',
        body: [
          `Half-diminished — a diminished triad with a minor seventh rather than a
           diminished one — is a softer chord and usually has a different job. Away from
           home it is nearly always the ii of a minor ii–V, which is how Picardy labels it
           when it appears.`,
        ],
        example: {
          caption: 'iiø7–V7–i in C minor',
          tonic: 'C', mode: 'minor',
          chords: [[2, 2, 'm7b5', 4], [7, 5, 'dom7', 4], [0, 1, 'min', 8]],
          bpm: 120, style: 'swing',
          expect: { symbols: ['Dm7♭5', 'G7', 'Cm'], numerals: ['iiø7', 'V7', 'i'], cadence: 'perfect authentic cadence' },
        },
      },
    ],
  },

  {
    id: 'neapolitan',
    title: 'The Neapolitan',
    blurb: 'A major chord on the flattened second degree, and the most dramatic way into a cadence.',
    minutes: 5,
    sections: [
      {
        heading: 'A predominant from outside the key',
        body: [
          `♭II is a major triad built on the lowered second degree — D♭ major in C. It is
           not in either C major or C minor, and it functions as a predominant: it leads to
           the dominant, and then home.`,
          `The effect is heavy and a little theatrical, which is why it turns up at the ends
           of slow movements and in a great deal of nineteenth-century opera.`,
        ],
        example: {
          caption: 'The Neapolitan in first inversion, its usual form',
          tonic: 'C', mode: 'minor',
          chords: [[0, 1, 'min', 4], [1, 2, 'maj', 4, 1], [7, 5, 'dom7', 4], [0, 1, 'min', 8]],
          expect: {
            symbols: ['Cm', 'D♭', 'G7', 'Cm'],
            numerals: ['i', '♭II 6', 'V7', 'i'],
            cadence: 'perfect authentic cadence',
          },
        },
      },
      {
        heading: 'Why first inversion',
        body: [
          `Almost always ♭II6 rather than ♭II, which is why it is often called the
           Neapolitan sixth. In first inversion its bass is the fourth degree — F in C
           minor — which is where a predominant normally sits, so the chord arrives in a
           familiar place wearing an unfamiliar colour.`,
          `Root position is possible and sounds heavier still.`,
        ],
        example: {
          caption: 'Root position, for comparison',
          tonic: 'C', mode: 'minor',
          chords: [[0, 1, 'min', 4], [1, 2, 'maj', 4], [7, 5, 'dom7', 4], [0, 1, 'min', 8]],
          expect: {
            symbols: ['Cm', 'D♭', 'G7', 'Cm'],
            numerals: ['i', '♭II', 'V7', 'i'],
            cadence: 'perfect authentic cadence',
          },
        },
      },
      {
        heading: 'Spelling',
        body: [
          `It is spelled as a flattened second, not a raised first: D♭ in C, not C♯. That is
           not pedantry — the chord's function is to fall to the dominant, and a flat that
           falls is a different musical idea from a sharp that rises, whatever the piano
           does about it.`,
        ],
      },
    ],
  },

  {
    id: 'augmented-sixths',
    title: 'Augmented sixths',
    blurb: 'Three chords named after countries none of them come from, all doing the same job.',
    minutes: 6,
    sections: [
      {
        heading: 'An interval, not a root',
        body: [
          `An augmented sixth chord is named for the interval inside it: a ♭6 at the bottom
           and a ♯4 above it, six letter-names apart but a whole step wider than a normal
           sixth. Both notes want to move outward by a half step, and where they land is
           the dominant.`,
          `That is the whole chord. Everything else is which notes fill the middle.`,
        ],
        example: {
          caption: 'Italian: just the two outer notes and the tonic',
          tonic: 'C', mode: 'minor',
          chords: [[0, 1, 'min', 4], [8, 6, 'it6', 4], [7, 5, 'maj', 8]],
          expect: { symbols: ['Cm', 'A♭+6(It)', 'G'], numerals: ['i', 'It+6', 'V'], cadence: 'half cadence' },
        },
      },
      {
        heading: 'The other two',
        body: [
          `The French adds the second degree, which gives it a whole-tone brightness. The
           German adds the third degree instead, which makes it sound exactly like a
           dominant seventh on ♭VI — and that resemblance is the most useful thing about
           it.`,
        ],
        example: {
          caption: 'French',
          tonic: 'C', mode: 'minor',
          chords: [[0, 1, 'min', 4], [8, 6, 'fr6', 4], [7, 5, 'maj', 8]],
          expect: { symbols: ['Cm', 'A♭+6(Fr)', 'G'], numerals: ['i', 'Fr+6', 'V'], cadence: 'half cadence' },
        },
      },
      {
        heading: null,
        body: [
          `The German, and then the chord it sounds identical to. Same pitches on a
           keyboard; different spelling, and so a different obligation. The augmented sixth
           expands outward to the dominant; the dominant seventh falls a fifth to D♭.`,
          `This is the clearest case in the whole language for why Picardy spells notes
           rather than storing pitch numbers. These two chords are the same sound and
           different music, and only the spelling knows which one you meant.`,
        ],
        example: {
          caption: 'German sixth, then ♭VI7 — the same keys, different chords',
          tonic: 'C', mode: 'minor',
          chords: [[8, 6, 'ger6', 4], [8, 6, 'dom7', 4]],
          expect: { symbols: ['A♭+6(Ger)', 'A♭7'], numerals: ['Ger+6', '♭VI7'], cadence: null },
        },
      },
      {
        heading: 'Where they go',
        body: [
          `To the dominant, usually via a cadential 6/4 — which is the first lesson in this
           second group, and worth reading before this one if you have not.`,
        ],
      },
    ],
  },
)

export const lessonById = (id) => LESSONS.find((lesson) => lesson.id === id) ?? null

export const LESSONS_PATH = '/lessons'

export const lessonPath = (id) => `${LESSONS_PATH}/${id}`

/** Every example in every lesson, flattened — what the check suite walks. */
export function allExamples() {
  const out = []
  for (const lesson of LESSONS) {
    for (const section of lesson.sections) {
      if (section.example) out.push({ lesson: lesson.id, heading: section.heading, example: section.example })
    }
  }
  return out
}
