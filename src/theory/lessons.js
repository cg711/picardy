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
  for (const [semis, generic, qualityId, beats] of example.chords) {
    const chord = makeChord(spellDegree(key, semis, generic), qualityId)
    if (!chord) return null
    progression.push(chord)
    durations.push(beats ?? 4)
  }

  const cadence = cadenceAt(progression, progression.length - 1, key)

  return {
    key,
    progression,
    durations,
    inversions: progression.map(() => 0),
    timeSignature: example.timeSignature ?? '4/4',
    bpm: example.bpm ?? 96,
    style: example.style ?? 'block',
    symbols: progression.map((chord) => chordSymbol(chord)),
    numerals: progression.map((chord) => romanNumeral(chord, key)),
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
