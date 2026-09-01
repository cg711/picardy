# Picardy

A fretboard and keyboard progression explorer. Enter chords, get ranked suggestions for what
could come next — from plain diatonic moves through extensions, borrowed chords, applied
dominants, tritone subs, augmented sixths, passing diminished chords and upper-structure
polychords — each with a roman numeral, a plain-English reason, and a live view on both
instruments.

Named for the Picardy third: the major chord that ends a minor piece, where you expected the sad
one. It is the whole idea of the app in one device — the unexpected chord that turns out to work,
and a reason why.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run check` runs the theory regression suite —
spelling, roman numerals, key detection, guitar voicing search, chord identification — and
prints the ranked suggestions for a handful of progressions so the musical judgements can be
eyeballed rather than only asserted.

## What it does

**Suggestions with context.** The engine generates ~90–100 candidate next chords per step, then
scores each one against the progression you have actually built: the previous chord's harmonic
function, root motion, unresolved tendency tones (a dominant seventh's tritone, a °7's leading
tone, a ø7 acting as a ii), voice-leading smoothness, and how far into the phrase you are.
Candidates are grouped into tiers from *Very common* down to *Rare*.

Because a single chord can be several things at once — A♭ in C major is ♭VI borrowed from the
parallel minor *and* a chromatic mediant of the tonic — the strongest reading becomes the
headline and the others are kept as "also…" notes in the expanded explanation. The category
filter matches any of a chord's readings, so nothing disappears from the list.

**Surprise me.** Generates a whole progression in the current key and plays it. The body is a
weighted random walk through the ranked suggestions — so every step is still a move the engine
rates as idiomatic — and the last two or three chords come from a cadence template, which is what
makes the result *end* rather than just stop. Fifteen cadences are on offer (perfect, plagal,
minor plagal, half, deceptive, ii–V–I, tritone-sub ii–subV–I, backdoor, Neapolitan, German sixth,
cadential 6/4, Picardy third, Phrygian half, Aeolian), weighted so the resolving ones dominate
and the exotic ones stay special.

A style setting picks which slice of the vocabulary is in play and how far down the ranked list
the walk is willing to reach: *Pop / folk* stays near the top of the diatonic list, *Jazz* opens
up secondary dominants and tritone subs, *Modal / rock* leans on mixture, *Chromatic / romantic*
brings in Neapolitans, augmented sixths and chromatic mediants, *Cinematic* favours mediants and
pedal points. The result is captioned with the style and the cadence it landed on.

**Rhythm.** Every chord carries a length, from a 16th note to a whole note (dotted values
included), and each section has its own time signature. The progression strip marks where bars
start and warns when the last bar is short; playback follows the actual durations.

**Sections and songs.** Save the current progression as a named section — Verse, Chorus, Bridge,
or anything you type. A section stores its own chords, lengths, inversions, key and metre, so a
song can modulate: a chorus a minor third up from the verse keeps its own roman numerals. Arrange
sections into a song with repeat counts, reorder them, and play the whole thing end to end. The
instruments follow along and the numerals switch key as each section arrives.

**PDF chart.** One click produces a lead sheet: chords laid out in bars with roman numerals
underneath, tied continuations bracketed where a chord crosses a bar line, and a legend of
fingering diagrams for every distinct chord. Choose guitar, piano, both, or symbols only at export
time; guitar boxes honour the left-handed setting. Everything is drawn with vector primitives, so
it prints sharp and the file stays small — and jsPDF is loaded on demand, so the export costs
nothing until you use it.

**What to play over the chords.** A scale layer derives the fitting scales from the chord's
function rather than a lookup table: any scale containing every chord tone is a candidate, ranked
by how much of it stays inside the key, with the conventional choice breaking ties. That gets
Dorian over `ii`, Lydian over `IV`, Phrygian over `iii`, Phrygian dominant over a minor-key `V7`,
and Lydian dominant over a tritone sub — without any of them being special-cased. Alternates are
listed with reasons, because chord-scale choices are genuinely contested. Guide tones (the 3rd and
7th that spell the chord) and the notes held in common with the next chord are marked on both
instruments.

**Reharmonisation.** Point the engine at a chord already written and it offers substitutions in
place — tritone subs, rootless dominants, third swaps, borrowed variants, richer extensions, bass
inversions — and chords to slip in before it: applied dominants, related ii chords, chromatic
approach diminished chords.

**Smooth voicing.** One button picks inversions across the whole progression to minimise voice
movement, using dynamic programming over every inversion of every chord. Typically cuts movement
by 75–80%. Slash chords keep the bass you gave them.

**Transpose.** Move the music, not just the label. Spelling carries the *generic
interval* across from the source key rather than being re-derived from the pitch, so B♭ in C
becomes C in D — the lowered 7th in both — instead of B♯, and repeated transposition doesn't drift
into double accidentals. Where the functional spelling would be unreadable (♭6 of D♭ is B𝄫), the
cleanest enharmonic wins instead; that trades the roman numeral for legibility, which is the
choice a real chart makes.

**Import and analysis.** Paste a chart like `| Cmaj7 | Am7 | Dm7 G7 |` and it parses into a
section, splitting shared bars. Then it reads the progression back: names the cadence, finds
complete ii–V–Is, flags applied chords and borrowed colour, and describes the root motion.

**MIDI export.** A Format 1 `.mid` file — tempo, metre, per-chord durations, voiced chords, and a
marker at each section so a DAW shows the arrangement on its ruler. Written byte by byte with no
dependency.

**Backing tracks.** Four band styles — pop/rock, jazz swing, ballad and bossa nova — put drums,
bass and comping behind the progression, so you can play over it rather than only read it. The kit
is synthesised (`src/audio/drums.js`): a few oscillators and filtered noise, because shipping
megabytes of samples would undo the thing the app is fastest at.

Grooves live in `src/audio/styles.js` as data, free of Web Audio, so `npm run check` can hold them
to the bar in every metre the app offers — nothing past the bar line, nothing on a beat 3/4 does not
have, a downbeat in every bar, and a fill that differs from the groove it interrupts. That check
found a ride cymbal swinging off the end of a 7/8 bar. Swing is applied inside `barFor` rather than
by the scheduler, because it *moves* events, and an event moved past the bar line is a note in the
wrong bar; doing it in one place makes the returned bar in-bounds by construction.

The groove runs on a bar-level timeline beside the chord timeline, and the two do not line up — a
chord can straddle a bar line and a bar can hold three chords — so the bass and comp resolve their
harmony by beat rather than by index. The bass reads `bassOf`, so a slash chord puts its own bass
note down there rather than the root. Fills land in the bar before each section change and before
the loop comes round, with a crash on the downbeat after.

Landing on `/backing` with nothing in the link shows a shelf of ten standards — blues, minor blues,
rhythm changes, ii–V–I major and minor, the pop and fifties turnarounds, an Andalusian cadence, a
bossa and a Dorian vamp. They are stored in `src/lib/backings.js` as scale degrees rather than chord
symbols, the same `[semitones, generic, quality]` triples the exercise generator uses, so each one
builds in any of twelve keys with the spelling coming out right and the numerals derived from the
same engine as everywhere else.

Some keys are theoretical for some shapes: a ii–V–i in D♭ minor wants a B♭♭, and a blues in G♭ needs
a C♭7 which contains one. Rather than curate a key list per preset — which would go stale the moment
a preset was added — `buildBacking` retries the same pitch under its other name and offers C♯ minor
or F♯ major instead. `npm run check` asserts the property directly: every preset, in every key, with
no double accidentals and whole bars.

The chart prints a roman numeral over every chord, read from that chord's *own* section key. An
arrangement can change key between sections, and a numeral measured from the wrong tonic is worse
than no numeral — in the Verse/Chorus/Verse test the E♭ chorus reads `Imaj7 vi7 ii7 V7`, not the
`♭IIImaj7 i7 iv7 ♭VII7` it would be if read from the verse's C.

## Exporting

Everything that leaves the app lives on the studio's **Export** tab: the whole song as a headline
row, then one row per section used in the arrangement, each offering a backing track, a PDF chart
and a MIDI file. Sections are listed in first-appearance order and deduplicated — a section used
three times is one thing you can export, not three, since the file would be identical.

The three exports were previously scattered — a link in the top bar, two buttons under the
arrangement — and all three could only ever act on the whole song. Gathering them made the missing
option obvious, because a backing track of just the chorus is the one people actually ask for.

It works because everything already operated on a `(song, segments)` pair, so a scope — the whole
song, one section, or what is in the editor — is just a different subset. `entriesFor()` does that
translation once and all three exporters gained per-section output without any of them learning a
new shape. A section taken alone keeps its own key and rebases its melody to its own beat zero
rather than staying where it sat in the arrangement; both are asserted.

A whole arrangement can travel too. `Backing track` in the song actions flattens the song with
`flattenSong` and encodes it, which is safe across sections in different keys because chord symbols
are absolute — a section written in E♭ contributes E♭ chords, not degrees. Section boundaries ride
along in a `g` parameter as `index:name` pairs, so the player shows section headings and the band
puts a fill in the bar before each change. Verified on a Verse/Chorus/Verse arrangement in C and E♭:
the toms appear in bars 3, 7 and 11 and nowhere else.

The player lives at `/backing`, decoupled from the studio on purpose: it exists to be followed while
your hands are busy, so the chart is large, the current bar is unmissable, and nothing is editable.
The whole track arrives in the URL — `encodeState` carries tempo and style alongside the chords —
which means the link is also the save button. `Backing track` in the studio's top bar opens the
current progression there, forcing a band style if the studio was on a chord-only one.

Looping is sample-accurate. A loop that re-arms *at* the end never is: the timer fires late and the
next pass starts relative to whenever that happened. `runPass` instead schedules the following pass
a quarter-second early against the exact AudioContext time the current one ends, so the join is
placed before it is needed. Measured at 120bpm over a 16-beat loop, events land at 7.75s, exactly
8.0000s, then 8.25s — the same spacing across the boundary as everywhere else. Tempo and style are
read once per pass through a `settings` callback rather than captured at play time, so nudging
either lands next time round instead of restarting and losing your place.

**Melody, explained.** A piano roll on its own Melody tab, drawn as one SVG rather than a grid of
elements — sixteen bars at eighth resolution is a couple of thousand cells, and the browser should
not lay out two thousand divs so someone can click four of them.

The roll is worth having because the app already knows what chord is sounding at every beat, so
`src/theory/melody.js` can say what each note is *doing*: a chord tone (named, with why the third
matters more than the fifth), a tension the chord invites (9, ♯11, ♭13…), a note from outside the
key, or the one note that will fight — a natural 11th sitting a half step above a major third. That
last rule asks whether the chord actually has that third rather than assuming, which is why **F over
Cmaj7 is an avoid note and G over Dm7 is just the eleventh**: same interval, different chord, and
only one of them clashes.

Colour carries the role, using the same green/amber/purple the analysis panel uses, so "chromatic"
means one thing across the whole app. Hovering reads the note back in a sentence. The line travels
in the URL as `beat:length:midi` triples and plays back on a brighter lead voice over whatever the
band is doing.

The line is saved onto the section, alongside its lyrics and shapes, so it travels into the
arrangement, the chart and the MIDI with the chords it was written against. Both exports carry it,
governed by one switch next to the two buttons it applies to — shown only when there is a melody to
include, because a toggle for something that does not exist is a question asked for nothing.

In the PDF it is a contour lane under each row of bars, with note names on the notes wide enough to
hold one. A contour rather than notation, because engraving a stave is a different project and a
shaped line you can read at a glance is what actually helps: the vertical scale is fixed per section
rather than per row, so the same pitch is drawn at the same height all the way down. In the MIDI it
is its own track on its own channel, which is what makes a DAW open it as a separate part rather
than a lump of notes inside the comping.

**Practice transport.** Loop, a count-in bar of clicks, and playback feels beyond block chords:
strum, arpeggio, and bass + comp.

**Lyrics under their chords.** Each chord owns a box holding the words sung on it, plus a lead-in
for whatever comes before the first chord of a line. A chord change mid-word is two boxes —
`wait` under one and `ing` under the next, no space between — which is the case every
proportional scheme handles badly. Pasting a line splits it across that line's chords at word
boundaries, since typing a lyric box at a time is slow and lyrics usually arrive as whole lines.

Alignment is stored as an association rather than a position: this chord goes with these syllables.
There is no x, no width and no fraction anywhere in the model, and that is the point. The earlier
design stored proportional widths, which meant the editor and the printed chart were two
reconstructions of the same geometry under different widths and fonts — and they drifted, exactly as
that arrangement invites. Both now render the same pairs, so the chart cannot disagree with the
screen it came from.

The PDF draws each chord at the measured start of its own words, in the face the lyric is drawn in.
Where a chord's label is wider than the syllable under it, the lyric is padded so the next chord
starts clear of it rather than on top — the one thing a chord sheet does that ordinary text does
not.

**Tunings.** Twenty-two presets — standard and flattened, the dropped family, six open
tunings, DADGAD and Orkney, plus 7- and 8-string, baritone and bass — or build your own, string by
string, from four to eight strings anywhere in a playable range. Nothing in the voicing search, the
neck or the chord boxes assumes six strings; they all read the tuning's length.

A custom tuning is identified by its *notes* rather than by the word custom, which is what makes
pinned shapes safe: retune one string and every shape found on the old tuning is quietly dropped
rather than drawn against strings that now sound something else.

**Pinned voicings.** The guitar shape you choose is remembered against that chord, survives
leaving and returning to it, rides along in the share link, and is the shape drawn in the PDF.
A shape is only valid in the tuning it was chosen in, so it is ignored rather than drawn wrong
after a tuning change. The same chord pinned to two different shapes gets two diagrams in the
legend rather than one silently winning.

**Undo/redo.** ⌘Z and ⇧⌘Z, or the buttons by the progression. It watches the editor state rather
than being wired into each action, so transposing, reharmonising, smoothing voicings and
generating are all undoable without having been taught about it. Typing a lyric collapses into a
single step instead of one per keystroke.

**Four ways in.** Type a chord symbol with autocomplete (`Cmaj7`, `F#m7b5`, `Bb13`, `D/F#`,
`C7#9`, `Abger6`), click roman numerals from a grid organised by function, click suggestions to
extend the chain, or click notes on the piano/fretboard and let the app identify what you played.

**Both instruments, with inversions.** Every chord shows its guitar shapes (searched, not looked
up — so alternate tunings and odd chords work), the full neck map of chord tones, and a piano
voicing. Selecting an inversion re-searches the guitar for shapes with the right note in the
bass and updates the figured bass on the roman numeral (`V7` → `V7 6/5`).

**Audio and sharing.** Web Audio playback of single chords or the whole progression with tempo,
metre, and timbre control. The progression lives in the URL hash, so the *Share link* button
produces a bookmarkable link; recent progressions are kept in `localStorage`.

## How the screen is organised

Three panels, grouped by the job they do rather than by the feature that built them.
Left column is the work; right column is whatever chord is selected.

```
PROGRESSION      key & transpose, then one of three views —
                   Chords          the strip, with an add card and insert slots
                   Lyrics & timing the timeline
                   Sections & song saved sections, song order, recent
                 then Save as section, then the transport

INSTRUMENTS      piano or guitar, one at a time
[Cmaj7]          the selected chord — voicing · what to play · reharmonise
```

**Adding a chord is a raised panel, not a section.** The strip ends in a dashed
card with a plus, and every gap between chords holds a narrow insert slot, so where
a chord goes is chosen by pointing at the gap rather than by selecting a chord first
and reasoning about "after". Both open the same panel.

That panel is deliberately **not a modal**. One of the five ways in is "click notes
on the instruments", and a backdrop that swallowed pointer events would make that
tab impossible to use — so there is no backdrop, and the panel sits over the left
column, leaving the instruments live. It also stays open after each add, because
adding is usually a run rather than a single act.

Where it will insert is not stored anywhere. It is always `activeIndex + 1` — which
`addChord` and the suggestion engine already agree on, so the ranked list reads
"what follows the chord to the left of this gap" for free and the two cannot drift.

*Save as section* stays outside the Sections tab on purpose: it acts on the
progression, not on the library, so it should not hide behind the tab that lists
what you have already saved.

Stacked below 1100px the columns stop being a spatial grouping and become a reading
order, so `display: contents` drops the wrappers and the panels re-flow into
workflow order instead of column order.

Inside a panel, `.sub-head` names each part — a hairline and a quiet label, not a
second run of panel chrome, which would just rebuild the borders that grouping
removed.

## Brand

The identity is a single number. Every surface colour is the brand hue — amber, 36° — at a fixed
saturation and lightness, so `src/brand/theme.js` can generate the whole palette from one input and
any of the ten hues in `HUES` produces a usable theme rather than only the shipped one. The CSS
carries literal hex for speed, which means it can drift from the recipe silently, so `npm run check`
recomputes the palette and asserts each custom property still matches, along with the contrast
ratios the recipe is supposed to guarantee — AAA for body text and AA for ink on the accent, across
all ten hues, not just amber.

The mark is a P that is an upside-down half note: stem on the left, notehead as the bowl, the
counter of the letter doing double duty as the hole in the note. It is drawn in `src/brand/Mark.jsx`
for the app and re-drawn with jsPDF primitives in `src/lib/pdf.js` for the footer of every exported
chart — the notehead as a 30-segment rotated polyline, because jsPDF has no rotated-ellipse
primitive and a plain thick line does not read as a note.

`public/` holds the favicon, the touch icon and the 1200×630 link preview. The preview is composed
by `scripts/og-image.py` from the brand kit's own rendered lockup — the kit ships a square app icon
under that name, which every scraper crops. The result is committed, so the build never reaches for
the sibling directory.

Chord-tone colours are deliberately *not* brand colours: they have to be told apart from each
other, which is a different problem from matching an identity. Making amber the accent crowded them,
since the accent paints scale dots on the same fretboard as the tone dots, so the 6th, the 13th and
the polychord upper structure were moved out of its way. WCAG contrast is the wrong instrument for
that check — it only sees luminance, so it scores an orange and a blue of equal lightness as
identical. The suite measures perceptual distance in Lab instead (`deltaE`), and holds every tone to
a minimum ΔE from the accent and from every other tone. Retune those by the numbers, not by eye.

## Pages

`/` is the landing page — what Picardy is, the tools, and links into them. `/tool` is the studio,
`/backing` the backing-track player, `/exercises` the drills, `/privacy` and `/terms` the legal
text. The menu in the
top bar and the footer are both generated from `PAGES` in `src/lib/routes.js`, so a new page appears
in both by adding one entry.

The tool used to live at `/`, and every progression ever shared is a `/#k=…` link. Moving it would
have broken all of them, so `legacyToolPath()` forwards a state fragment arriving at the front door
to `/tool`, carrying the hash, with `replaceState` — no round trip and no back-history entry. It is
pure and lives in `routes.js` so the check suite holds it to that promise.

## Legal pages

`/privacy` and `/terms`, reachable from the menu in the top bar and from the footer. They are
drafts written to describe what the app actually does, and they have not been reviewed by a lawyer.

Three facts have to come from you — who is legally responsible, a contact address, and which state's
law governs. They live in `src/pages/site.js`. While any of them is still a placeholder the pages
render a banner saying so and `npm run check` prints a warning, because a policy with
`[your state]` still in it is worse than no policy at all.

Both documents lean on the same architectural fact: there is no backend, so nothing you write is
ever received, stored, or transmitted. That is worth keeping true. **Adding cloud sync or public
song sharing would make the app a host of user-submitted lyrics**, which is a different legal
posture entirely — DMCA safe harbour, a registered agent, a takedown process. Worth deciding
deliberately rather than arriving at by accident.

These are real paths rather than hash routes, because the hash is already the app's state channel
and a legal URL needs to be something you can hand to an app store or a payment provider. A direct
load of `/privacy` works because the host serves `index.html` for unknown paths — that is what
`not_found_handling` is doing in `wrangler.jsonc`, and the check suite asserts it stays set. The
router is thirty lines in `src/lib/router.js`; five pages, none of them with parameters, do not
justify a dependency.

## Exercises

`/exercises` is a drill page. Six topics: harmony (roman numerals, function, chord spelling,
cadences, resolution, spotting the chord that left the key), intervals written and by ear, chords by
ear, and finding notes and intervals on a real keyboard and fretboard.

Nothing is authored. `src/theory/exercises.js` builds each question from the engine and takes the
right answer from whatever the engine says — `romanNumeral()` names the numeral, `cadenceAt()` names
the cadence, `harmonicFunction()` names the function. A hand-written question bank would go stale
the first time the engine was corrected and then contradict the app in front of someone trying to
learn; this cannot. When the minor-plagal shadowing bug was fixed in `analyze.js`, the drill started
asking about minor plagal cadences the same day, with no content change.

Six topics gate the vocabulary — keys, seventh chords, chromatic harmony, and which cadence names
are even offered as wrong answers. Distractors have to come from the same world as the answer: a
Phrygian half cadence against a plain V–I in Basics is eliminable without knowing any theory.

Two rules matter more than they look. A listening question must never print what it is about to
play, and its options must never contain two things that sound the same — an augmented 4th and a
diminished 5th are one sound and two spellings, so offering both makes the question unanswerable by
any ear. And a find-the-note question plays only the note you measure *from* until it is over;
playing the target would answer it. Both are asserted, not just intended.

Instrument questions reuse the app's own `Piano` and `Fretboard`, which gained a `marks` prop —
`midi -> 'ref' | 'right' | 'wrong'` — so a drill can point at a note without it being confused with
one the player clicked. "Find any B♭" has a dozen right answers and lights up all of them. String
numbers are flipped on the way out: the arrays run lowest-first, guitarists count from the thinnest.

`src/theory/intervals.js` names the distance between two notes, keeping letter span and semitone
count apart — C–E♭ and C–D♯ are the same keyboard distance and different intervals. Roots are
redrawn until the upper note spells without a double accidental, because a diminished 5th above E♭
is B𝄫 and nobody learns anything from being asked about it.

The generator takes a seeded RNG, which is what makes it testable. `npm run check` builds 8,640
questions across every topic and asserts each has exactly one correct answer, no duplicate options,
no placeholder text, that every instrument answer is reachable on the instrument drawn, that no
listening question leaks or is ambiguous — and, re-deriving from the engine rather than trusting the
generator, that the marked answer is the right one. A generator that produces a broken question one
draw in five hundred is exactly the failure that needs a seed to pin down.

Progress is per level in `localStorage` (`picardy.exercises.v1`): streak, accuracy, and per-type
accuracy so the weakest topics surface. No accounts, so nothing to sync and nothing to store.

The App component stays mounted across the switch and only swaps its body, so reading the terms
halfway through writing a progression doesn't cost you the progression. The state fragment is
stripped from the URL while you are on a legal page and rewritten from memory when you come back.

## Deploying

`npm run build` emits a fully static `dist/` — no server, no environment variables, no secrets in
the bundle. State lives in the URL hash and `localStorage`, so there is no backend to host.
`vite.config.js` sets `base: './'`, so the same build works at a domain root or under a subpath.

`npm run preview` serves the built bundle locally on port 4173 to check it before shipping.

The deployed setup is Cloudflare's git integration: it builds on push to `main` and serves `dist/`
from an assets-only Worker. `wrangler.jsonc` declares that explicitly rather than letting Wrangler
infer a framework — auto-detection sees Vite and demands 6.0+, which is a version bump this app has
no other reason to make. Set the build command to `npm run check && npm run build` so a broken
theory suite fails the deploy instead of shipping.

`.github/workflows/ci.yml` runs the install, the check suite and the build on pull requests. It
deliberately does not deploy: two publishers racing on the same branch is how a stale bundle wins.

Other hosts work from the same `dist/`:

```bash
npx vercel deploy dist --prod           # Vercel
npx netlify deploy --dir=dist --prod    # Netlify CLI
```

## Layout

```
src/
  theory/
    notes.js      pitch spelling — letters and accidentals kept separate from pitch classes,
                  so Cb, E#, and Fx come out right
    chords.js     quality table, symbol parser, chord spelling, piano voicings, inversions
    keys.js       scales, roman numerals (incl. applied-dominant and figured-bass notation),
                  harmonic function, key detection
    suggest.js    the suggestion engine: generators + context-aware scoring
    generate.js   "Surprise me" — styles, cadence templates, whole-progression walk
    rhythm.js     note durations, time signatures, grouping chords into bars with ties
    scales.js     chord-scales derived from function, guide tones, common tones
    reharm.js     in-place substitutions and approach chords
    transpose.js  transposition with sane spelling
    voicelead.js  inversion search that minimises voice movement
    analyze.js    cadence detection and prose analysis of a progression
    guitar.js     fretboard voicing search and playability filtering
    identify.js   reverse lookup — notes to chord symbol
    melody.js     what a melody note is doing against the chord underneath
    exercises.js  question generator — every answer comes from the engine
    intervals.js  naming the distance between two notes
  components/     React UI (Piano, Fretboard, Suggestions, ChordInput, RomanPicker, …)
  audio/
    synth.js      Web Audio polysynth and the playback scheduler
    drums.js      synthesised kit — oscillators and filtered noise, no samples
    styles.js     what the band plays for one bar, as checkable data
  brand/
    theme.js      the palette recipe — one hue in, every colour out; plus the
                  contrast and perceptual-distance maths the check suite asserts
    Mark.jsx      the mark and the lockup
  pages/
    HomePage.jsx  the landing page at /
    BackingPage.jsx    the backing-track player at /backing
    site.js       the operator/contact/jurisdiction the legal pages need
    Privacy.jsx   privacy policy — draft, describes the app's actual behaviour
    Terms.jsx     terms of service — draft
    ExercisesPage.jsx  the drill page at /exercises
  lib/            URL/share encoding, colour tokens, segment + song model,
                  ready-made backing tracks (backings.js),
                  PDF export, MIDI writer, chart text import
```

### How chords are represented

A chord is a root note plus a list of `[genericDegree, semitones]` pairs. Carrying the generic
degree alongside the semitone is what lets `C7#9` spell as C E G B♭ **D♯** rather than E♭, and
what makes a German sixth on A♭ come out as A♭ C E♭ **F♯** — spelled as a sixth, which is why it
resolves outward to the dominant instead of down a fifth like a real dominant seventh.

### How guitar shapes are found

For each four-fret window, every combination of open/fretted/muted strings is tested against the
chord's pitch classes, then filtered for playability: span, required bass note, all essential
chord tones present, at most one interior muted string, and two fingering models — one finger per
note (max four), or barre the lowest fret and finger the rest, which costs one finger but cannot
have an open string ringing underneath it. A shape passes if either model works, which is why
open A (`x02220`, three fingers at one fret, no barre) and Bb (`x13331`, a two-string barre) are
both playable. Grips needing a finger to reach *back* behind fingers already further up the neck
are rejected.

Typically 30–150 grips survive. Showing them by score alone is useless — the top of the list is
the same open shape with different strings dropped, all at the bottom of the neck. So near-
duplicates are removed (a shape whose sounding notes are a subset of a better one), and selection
is greedy with a penalty for reusing a neck position. C major ends up spanning positions 1, 2, 3,
5, 8, 10 and 12 instead of 1–3.

The panel shows twelve of those by default and says how many exist — **Show all N** expands to
every one of them, laid out in a wrapping grid sorted by fret position rather than by score. A
shape chosen from the full list stays pinned to the front of the short list when you collapse
again, so collapsing never silently swaps the voicing on the neck.

`npm run check` asserts that 22 canonical grips — the open chords, the E- and A-shape barres, the
common sevenths — all survive and appear in the shown list.

### Handedness

A Right/Left toggle in the Guitar panel mirrors the neck and the chord boxes **together**: the
nut moves to the right, the frets ascend leftward, low E moves to the right-hand column of each
box, and the string order stays put. Coordinates are mirrored rather than an SVG transform being
applied, so fret numbers and interval labels stay the right way round; the neck also scrolls to
whichever end the nut is on. The preference is stored in `localStorage` and the check suite
asserts the two diagrams agree in both modes.
