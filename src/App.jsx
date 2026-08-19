import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeKey, keyName, detectKey, romanNumeral } from './theory/keys.js'
import { chordSymbol, chordName, chordNotes, voiceChord, inversionLabel, chordId, parseChord } from './theory/chords.js'
import { pcOf, prettyName, noteName } from './theory/notes.js'
import { suggestNext, analyzeChord } from './theory/suggest.js'
import { generateProgression, FLAVOURS } from './theory/generate.js'
import { DURATIONS, DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE, TIME_SIGNATURES, toBeats, timeSignatureOf, snapBeat, MIN_BEATS } from './theory/rhythm.js'
import { transposeChord, transposeKey } from './theory/transpose.js'
import { optimiseInversions, progressionMovement } from './theory/voicelead.js'
import { scalesForChord, guideTones, commonTones } from './theory/scales.js'
import { reharmonise } from './theory/reharm.js'
import { findVoicings, TUNINGS, voicingLabel, encodeShape, decodeShape, shapeFromFrets } from './theory/guitar.js'
import { identifyChord } from './theory/identify.js'
import { playChord, playProgression, stopPlayback, setVolume, resumeAudio, PATTERNS } from './audio/synth.js'
import { buildMidi, songToEvents, progressionToEvents, downloadMidi } from './lib/midi.js'
import {
  decodeState, writeHash, shareUrl, loadHistory, saveToHistory, clearHistory, historyToState,
  loadPrefs, savePref,
} from './lib/share.js'
import { toneColor } from './lib/colors.js'
import { useUndo } from './lib/useUndo.js'
import {
  makeSegment, readSegment, flattenSong, loadSegments, saveSegments, loadSong, saveSong, uniqueName,
} from './lib/song.js'

import { Lockup } from './brand/Mark.jsx'
import KeyPicker from './components/KeyPicker.jsx'
import ProgressionBar from './components/ProgressionBar.jsx'
import Piano from './components/Piano.jsx'
import Fretboard, { ChordBox } from './components/Fretboard.jsx'
import Transport from './components/Transport.jsx'
import Arrangement, { SaveSectionRow } from './components/Arrangement.jsx'
import AddChordDialog from './components/AddChordDialog.jsx'
import AddSectionDialog from './components/AddSectionDialog.jsx'
import ExportDialog from './components/ExportDialog.jsx'
import ScalePanel from './components/ScalePanel.jsx'
import ReharmPanel from './components/ReharmPanel.jsx'
import LyricTimeline from './components/LyricTimeline.jsx'
import { exportChart } from './lib/pdf.js'
import { useRoute, linkProps } from './lib/router.js'
import Menu from './components/Menu.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import LegalPage from './pages/LegalPage.jsx'

const initial = decodeState(window.location.hash)

/** Stable identity for a fretboard shape, used to keep it selected as lists change. */
const shapeKey = (s) => s.frets.map((f) => (f === null ? 'x' : f)).join('-')

export default function App() {
  // App stays mounted on the legal pages — it just renders a different body. That
  // is what keeps a half-written progression alive while someone reads the terms.
  const route = useRoute()
  const [musicKey, setMusicKey] = useState(initial?.key ?? makeKey('C', 'major'))
  const [progression, setProgression] = useState(initial?.progression ?? [])
  const [inversions, setInversions] = useState(initial?.inversions ?? [])
  const [durations, setDurations] = useState(initial?.durations ?? [])
  // Parallel to `progression`: the voicing the user picked for each chord, and
  // the words sung on it. Both are per-slot, so they move with the chord.
  const [shapes, setShapes] = useState(initial?.shapes ?? [])
  // Which lyric line each chord sits over, and the lines of plain text.
  const [lines, setLines] = useState(initial?.lines ?? [])
  // Lyric-lane width per chord, independent of its beat length.
  const [spans, setSpans] = useState(initial?.spans ?? [])
  const [lyricLines, setLyricLines] = useState(initial?.lyricLines ?? [''])
  const [editorView, setEditorView] = useState('chips')
  const [timeSignature, setTimeSignature] = useState(initial?.timeSignature ?? DEFAULT_TIME_SIGNATURE)
  const [newChordDuration, setNewChordDuration] = useState(DEFAULT_DURATION)
  const [activeIndex, setActiveIndex] = useState((initial?.progression?.length ?? 1) - 1)
  const [preview, setPreview] = useState(null)
  const [selection, setSelection] = useState(() => new Set())
  const [inputMode, setInputMode] = useState('suggest')
  // Whether the add-a-chord panel is open. Where it will insert is not stored
  // separately — it is always activeIndex + 1, which addChord and the suggestion
  // engine already agree on, so the two cannot drift apart.
  const [addOpen, setAddOpen] = useState(false)
  // Instruments show one at a time now, so this is which one.
  const [instrument, setInstrument] = useState('piano')
  // Name of the section just saved, shown briefly as confirmation.
  const [savedNote, setSavedNote] = useState(null)
  const savedTimer = useRef(null)
  // A separate, shorter flag: the confirmation text reads for a couple of
  // seconds, but the tab should only pulse once — about a second — or it turns
  // into a distraction sitting next to the tab you are working in.
  const [justSaved, setJustSaved] = useState(false)
  const glowTimer = useRef(null)
  useEffect(() => () => { clearTimeout(savedTimer.current); clearTimeout(glowTimer.current) }, [])
  // Whether the "add a section to the song" sidebar is open.
  // Where in the song a picked section will land, or null when the sidebar is
  // shut. Mirrors how the chord sidebar targets a gap in the strip.
  const [addSectionAt, setAddSectionAt] = useState(null)

  const [tuningId, setTuningId] = useState('standard')
  const [lefty, setLefty] = useState(() => !!loadPrefs().lefty)
  const [showAllTones, setShowAllTones] = useState(true)
  const [voicingPick, setVoicingPick] = useState(null)
  const [showAllShapes, setShowAllShapes] = useState(false)
  const [displayInversion, setDisplayInversion] = useState(0)

  const [bpm, setBpm] = useState(84)
  const [timbre, setTimbre] = useState('piano')
  const [volume, setVol] = useState(55)
  const [playing, setPlaying] = useState(false)
  const [playingIndex, setPlayingIndex] = useState(-1)

  const [history, setHistory] = useState(() => loadHistory())
  const [copied, setCopied] = useState(false)
  const [flavour, setFlavour] = useState('any')
  const [generated, setGenerated] = useState(null)

  const [segments, setSegments] = useState(() => loadSegments())
  const [song, setSong] = useState(() => loadSong())
  const [playingSong, setPlayingSong] = useState(false)
  const [playingSongIndex, setPlayingSongIndex] = useState(-1)
  // While a song plays, roman numerals follow the section's own key.
  const [playbackKey, setPlaybackKey] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [songTitle, setSongTitle] = useState('Untitled')
  const [pattern, setPattern] = useState('block')
  const [countIn, setCountIn] = useState(false)
  const [loop, setLoop] = useState(false)
  const [showScale, setShowScale] = useState(false)
  const [scaleId, setScaleId] = useState(null)
  const [detailTab, setDetailTab] = useState('scale')
  const prevLen = useRef(progression.length)
  const activeIndexRef = useRef(activeIndex)
  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const tuning = TUNINGS[tuningId].strings

  // --- undo / redo -----------------------------------------------------------
  //
  // Everything the editor can change is snapshotted together, so any action
  // becomes undoable without having to be wired up individually. Chords are
  // stored as symbols because chord objects are not worth deep-comparing.

  const snapshot = useMemo(() => ({
    chords: progression.map(chordId),
    inversions,
    durations,
    shapes,
    lines,
    spans,
    lyricLines,
    key: `${noteName(musicKey.tonic)}${musicKey.mode === 'minor' ? 'm' : ''}`,
    timeSignature,
  }), [progression, inversions, durations, shapes, lines, spans, lyricLines, musicKey, timeSignature])

  const applySnapshot = useCallback((snap) => {
    const minor = /m$/.test(snap.key)
    const restored = makeKey(minor ? snap.key.slice(0, -1) : snap.key, minor ? 'minor' : 'major')
    if (restored) setMusicKey(restored)
    const chords = snap.chords.map(parseChord).filter(Boolean)
    setProgression(chords)
    setInversions(snap.inversions)
    setDurations(snap.durations)
    setShapes(snap.shapes)
    setLines(snap.lines ?? [])
    setSpans(snap.spans ?? [])
    setLyricLines(snap.lyricLines ?? [''])
    setTimeSignature(snap.timeSignature)
    setActiveIndex(Math.min(activeIndexRef.current, chords.length - 1))
    setPreview(null)
    setGenerated(null)
  }, [])

  const { undo, redo, canUndo, canRedo } = useUndo(snapshot, applySnapshot)

  // --- derived ---------------------------------------------------------------

  // Which chord the right-hand column is describing. Normally the one you
  // clicked — but while the progression plays it follows the sounding chord,
  // because instruments showing a chord you are not hearing is just wrong.
  // Playback wins over selection and reverts to it on stop, since playingIndex
  // is -1 whenever nothing is sounding (including during the count-in bar).
  //
  // Song playback gets there another way: those chords come from a section and
  // are not in this progression at all, so it sets `preview` instead.
  const focusIndex = playingIndex >= 0 ? playingIndex : activeIndex
  // Whenever the playhead is driving the panel — not only when it has landed
  // somewhere other than the selection. Tying it to a difference made the cue
  // blink off for the one chord that happened to be selected, which reads as a
  // glitch rather than as information.
  const followingPlayback = playingIndex >= 0

  const activeChord = preview ?? progression[focusIndex] ?? null
  const activeInversion = preview ? displayInversion : (inversions[focusIndex] ?? 0)

  const suggestions = useMemo(
    () => suggestNext(musicKey, progression.slice(0, activeIndex + 1)),
    [musicKey, progression, activeIndex],
  )

  const pianoVoicing = useMemo(
    () => (activeChord ? voiceChord(activeChord, { inversion: activeInversion, bottom: 48 }) : []),
    [activeChord, activeInversion],
  )

  const bassPc = useMemo(() => {
    if (!activeChord) return null
    if (activeChord.bass) return pcOf(activeChord.bass)
    const notes = chordNotes(activeChord)
    if (!notes.length) return null
    return pcOf(notes[activeInversion % notes.length].note)
  }, [activeChord, activeInversion])

  const voicings = useMemo(() => {
    if (!activeChord) return []
    const limit = showAllShapes ? Infinity : 12
    const withBass = findVoicings(activeChord, { tuning, bassPc, limit })
    if (withBass.length) return withBass
    // Some inversions are simply unplayable on six strings — fall back to any bass.
    return findVoicings(activeChord, { tuning, bassPc: null, limit })
  }, [activeChord, tuning, bassPc, showAllShapes])

  // The short list is ordered for spread across the neck; the full list is
  // easier to browse in fret order. A shape picked out of the full list stays
  // pinned to the front when the list collapses, so collapsing never silently
  // changes which voicing is on the neck.
  const shownShapes = useMemo(() => {
    const base = showAllShapes
      ? [...voicings].sort((a, b) => a.position - b.position || b.score - a.score)
      : voicings
    if (voicingPick && !base.some((s) => shapeKey(s) === shapeKey(voicingPick))) {
      return [voicingPick, ...base]
    }
    return base
  }, [voicings, showAllShapes, voicingPick])

  // A shape stored against this chord slot wins over the search order, but only
  // in the tuning it was chosen in.
  const storedShape = useMemo(() => {
    if (preview || focusIndex < 0) return null
    const frets = decodeShape(shapes[focusIndex], tuningId)
    return frets ? shapeFromFrets(frets, tuning) : null
  }, [shapes, focusIndex, tuningId, tuning, preview])

  const shape = voicingPick ?? storedShape ?? shownShapes[0] ?? null
  const displayKey = playbackKey ?? musicKey
  const analysis = activeChord ? analyzeChord(activeChord, displayKey) : null

  const scales = useMemo(
    () => (activeChord ? scalesForChord(activeChord, displayKey) : []),
    [activeChord, displayKey],
  )
  const activeScale = scales.find((s) => s.id === scaleId) ?? scales[0] ?? null
  // Common tones are drawn against whatever comes after the chord on screen.
  const nextChord = focusIndex >= 0 ? progression[focusIndex + 1] ?? null : null

  // Which bar the playhead is in — the beats before it, over the bar length.
  // Counting from the durations rather than the chord index because a chord can
  // be shorter or longer than a bar, so the two are not the same number.
  const playingBar = useMemo(() => {
    if (focusIndex < 0) return 1
    const before = durations.slice(0, focusIndex).reduce((sum, d) => sum + toBeats(d), 0)
    return Math.floor(before / timeSignatureOf(timeSignature).beatsPerBar) + 1
  }, [durations, focusIndex, timeSignature])
  const reharmOptions = useMemo(
    () => (activeIndex >= 0 && progression[activeIndex] ? reharmonise(progression, activeIndex, musicKey) : { replace: [], insert: [] }),
    [progression, activeIndex, musicKey],
  )

  const identified = useMemo(
    () => (selection.size >= 2 ? identifyChord([...selection], musicKey) : []),
    [selection, musicKey],
  )

  // --- effects ---------------------------------------------------------------

  // Gated on the route so a legal URL stays clean. `route` is a dependency rather
  // than just a guard: coming back from /terms re-runs this and rewrites the
  // fragment from state that was never lost.
  useEffect(() => {
    if (route !== 'app') return
    writeHash({ key: musicKey, progression, inversions, durations, timeSignature, shapes, lyricLines, lines, spans })
  }, [route, musicKey, progression, inversions, durations, timeSignature, shapes, lyricLines, lines, spans])

  useEffect(() => setVolume(volume / 100), [volume])

  // Reset to the first shape whenever the chord, tuning, or required bass changes.
  useEffect(() => {
    setVoicingPick(null)
    setShowAllShapes(false)
    setScaleId(null)
  }, [chordId(activeChord), tuningId, bassPc])

  useEffect(() => {
    if (progression.length > prevLen.current) setHistory(saveToHistory({ key: musicKey, progression }))
    prevLen.current = progression.length
  }, [progression, musicKey])

  useEffect(() => () => stopPlayback(), [])

  // Braces matter: these persist helpers return the saved value, and an effect
  // that returns a non-function makes React try to call it as a cleanup.
  useEffect(() => {
    saveSegments(segments)
  }, [segments])
  useEffect(() => {
    saveSong(song)
  }, [song])

  // --- actions ---------------------------------------------------------------

  /**
   * Open the add-a-chord panel targeting a gap in the strip.
   *
   * addChord already inserts *after* activeIndex, and the suggestion engine
   * already reads the progression up to activeIndex — which is exactly the
   * context you want when inserting at `at`. So pointing activeIndex at the
   * preceding chord makes one variable do both jobs, and the ranked list becomes
   * "what follows the chord on the left of this gap" for free.
   */
  const openAddChord = (at) => {
    setActiveIndex(at - 1)
    setPreview(null)
    setAddOpen(true)
  }

  /**
   * Adding closes the sidebar. Once a chord has gone in, the panel has done its
   * job, and standing open only covers the progression you opened it to extend —
   * the "from notes" tab in particular selects notes on an instrument the panel
   * would otherwise be sitting on top of.
   */
  const addChordAndClose = (chord) => {
    addChord(chord)
    setAddOpen(false)
  }

  const addChord = useCallback(
    (chord) => {
      if (!chord) return
      setProgression((p) => {
        const insertAt = activeIndex + 1 >= p.length ? p.length : activeIndex + 1
        const next = [...p.slice(0, insertAt), chord, ...p.slice(insertAt)]
        setActiveIndex(insertAt)
        return next
      })
      const insertAt = activeIndex + 1 >= progression.length ? progression.length : activeIndex + 1
      setInversions((iv) => [...iv.slice(0, insertAt), 0, ...iv.slice(insertAt)])
      setDurations((d) => [...d.slice(0, insertAt), newChordDuration, ...d.slice(insertAt)])
      setShapes((sh) => [...sh.slice(0, insertAt), null, ...sh.slice(insertAt)])
      // A chord inserted mid-progression joins the line its neighbour is on.
      setLines((ln) => [...ln.slice(0, insertAt), ln[insertAt - 1] ?? ln[insertAt] ?? 0, ...ln.slice(insertAt)])
      // A new chord takes an even share of its lyric line.
      setSpans((w) => [...w.slice(0, insertAt), 1, ...w.slice(insertAt)])
      setPreview(null)
      setSelection(new Set())
      setGenerated(null)
      playChord(voiceChord(chord, { bottom: 48 }), { timbre, strum: timbre === 'guitar' ? 0.02 : 0 })
    },
    [activeIndex, progression.length, timbre, newChordDuration],
  )

  const previewChord = useCallback(
    (chord) => {
      setPreview(chord)
      setDisplayInversion(0)
      playChord(voiceChord(chord, { bottom: 48 }), { timbre, strum: timbre === 'guitar' ? 0.02 : 0 })
    },
    [timbre],
  )

  /**
   * Play the candidate in context: the chord before it, the candidate, and the
   * chord after it when inserting into the middle.
   *
   * Hearing a suggestion alone tells you what it *is*; hearing the move tells
   * you whether it lands, which is the only question the list is really asking.
   * The candidate is shown on the instruments as it sounds.
   */
  const playTransition = useCallback(
    (chord) => {
      const at = activeIndexRef.current + 1
      const before = progression[at - 1]
      const after = progression[at]
      const run = [before, chord, after].filter(Boolean)
      if (!run.length) return
      setPreview(chord)
      setDisplayInversion(0)
      resumeAudio()
      playProgression(
        run.map((c) => ({ midis: voiceChord(c, { bottom: 48 }), beats: 2 })),
        {
          bpm,
          timbre,
          pattern: 'block',
          beatsPerBar: timeSignatureOf(timeSignature).beatsPerBar,
          strum: timbre === 'guitar' ? 0.02 : 0.008,
        },
      )
    },
    [progression, bpm, timbre, timeSignature],
  )

  const removeChord = (i) => {
    setProgression((p) => p.filter((_, j) => j !== i))
    setInversions((iv) => iv.filter((_, j) => j !== i))
    setDurations((d) => d.filter((_, j) => j !== i))
    setShapes((sh) => sh.filter((_, j) => j !== i))
    setLines((ln) => ln.filter((_, j) => j !== i))
    setSpans((w) => w.filter((_, j) => j !== i))
    setActiveIndex((a) => Math.max(0, Math.min(a, progression.length - 2)))
    setPreview(null)
    setGenerated(null)
  }

  const moveChord = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= progression.length) return
    const swap = (arr) => {
      const next = [...arr]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    }
    setProgression(swap)
    setInversions((iv) => {
      const padded = [...iv]
      while (padded.length < progression.length) padded.push(0)
      return swap(padded)
    })
    setDurations((d) => {
      const padded = [...d]
      while (padded.length < progression.length) padded.push(DEFAULT_DURATION)
      return swap(padded)
    })
    setShapes((sh) => {
      const padded = [...sh]
      while (padded.length < progression.length) padded.push(null)
      return swap(padded)
    })
    setSpans((w) => {
      const padded = [...w]
      while (padded.length < progression.length) padded.push(1)
      return swap(padded)
    })
    setLines((ln) => {
      const padded = [...ln]
      while (padded.length < progression.length) padded.push(0)
      return swap(padded)
    })
    setActiveIndex(j)
    setGenerated(null)
  }

  const setInversionAt = (i, inv) => {
    setInversions((iv) => {
      const next = [...iv]
      while (next.length < progression.length) next.push(0)
      next[i] = inv
      return next
    })
    setActiveIndex(i)
    setPreview(null)
  }

  const selectChord = (i) => {
    setActiveIndex(i)
    setPreview(null)
    setSelection(new Set())
    const chord = progression[i]
    if (chord) playChord(voiceChord(chord, { inversion: inversions[i] ?? 0, bottom: 48 }), { timbre })
  }

  const toggleNote = (midi) => {
    setPreview(null)
    setSelection((s) => {
      const next = new Set(s)
      if (next.has(midi)) next.delete(midi)
      else next.add(midi)
      return next
    })
    resumeAudio()
    playChord([midi], { duration: 0.9, timbre })
  }

  /**
   * Move the lyric-lane boundary between two neighbouring chords.
   *
   * Only their two widths change and their sum is preserved, so the line stays
   * exactly full and nothing after it shifts. Durations are deliberately
   * untouched: aligning a chord to a syllable is a typographic decision, and it
   * used to silently rewrite the rhythm.
   */
  const resizeSpans = (leftIndex, leftSpan, rightIndex, rightSpan) => {
    if (!Number.isFinite(leftSpan) || !Number.isFinite(rightSpan)) return
    setSpans((list) => {
      const next = [...list]
      while (next.length < progression.length) next.push(1)
      next[leftIndex] = leftSpan
      next[rightIndex] = rightSpan
      return next
    })
  }

  const moveChordToLine = (i, line) => {
    if (line < 0) return
    setLines((ln) => {
      const next = [...ln]
      while (next.length < progression.length) next.push(0)
      next[i] = line
      return next
    })
    setLyricLines((ls) => {
      const next = [...ls]
      while (next.length <= line) next.push('')
      return next
    })
  }

  const clearShapeAt = (i) => {
    setShapes((sh) => {
      const next = [...sh]
      while (next.length < progression.length) next.push(null)
      next[i] = null
      return next
    })
    setVoicingPick(null)
  }

  const setDurationAt = (i, id) => {
    setDurations((d) => {
      const next = [...d]
      while (next.length < progression.length) next.push(DEFAULT_DURATION)
      next[i] = id
      return next
    })
  }

  const playChords = (chords, invs, durs = []) => {
    if (!chords.length) return
    const voiced = chords.map((c, i) => ({
      midis: voiceChord(c, { inversion: invs[i] ?? 0, bottom: 48 }),
      beats: toBeats(durs[i]),
    }))
    setPlaying(true)
    playProgression(voiced, {
      bpm,
      timbre,
      pattern,
      loop,
      countIn: countIn ? timeSignatureOf(timeSignature).beatsPerBar : 0,
      beatsPerBar: timeSignatureOf(timeSignature).beatsPerBar,
      strum: timbre === 'guitar' ? 0.02 : 0.008,
      onStep: (i) => setPlayingIndex(i),
      onDone: () => {
        setPlaying(false)
        setPlayingIndex(-1)
      },
    })
  }

  const play = () => playChords(progression, inversions, durations)

  /** Generate a whole progression that lands on a real cadence, and play it. */
  const surprise = () => {
    const result = generateProgression(musicKey, { flavour })
    const invs = result.progression.map(() => 0)
    const durs = result.progression.map(() => newChordDuration)
    setProgression(result.progression)
    setInversions(invs)
    setDurations(durs)
    setShapes(result.progression.map(() => null))
    setLines(result.progression.map(() => 0))
    setSpans(result.progression.map(() => 1))
    setLyricLines([''])
    setActiveIndex(result.progression.length - 1)
    setPreview(null)
    setSelection(new Set())
    setGenerated(result)
    playChords(result.progression, invs, durs)
  }

  // --- transpose, voice leading, reharmonisation ------------------------------

  const transpose = (semitones) => {
    if (!progression.length && !segments.length) return
    const target = transposeKey(musicKey, semitones)
    const source = musicKey
    setMusicKey(target)
    setProgression((p) => p.map((c) => transposeChord(c, source, target)))
    setPreview(null)
    setGenerated(null)
  }

  const smoothVoicing = () => {
    if (progression.length < 2) return
    const chosen = optimiseInversions(progression, { lockFirst: true, startInversion: inversions[0] ?? 0 })
    setInversions(chosen)
    playChords(progression, chosen, durations)
  }

  const replaceChordAt = (index, chord) => {
    setProgression((p) => p.map((c, i) => (i === index ? chord : c)))
    setInversions((iv) => iv.map((v, i) => (i === index ? 0 : v)))
    setPreview(null)
    setGenerated(null)
    playChord(voiceChord(chord, { bottom: 48 }), { timbre })
  }

  const insertChordAt = (index, chord) => {
    setProgression((p) => [...p.slice(0, index), chord, ...p.slice(index)])
    setInversions((iv) => [...iv.slice(0, index), 0, ...iv.slice(index)])
    setDurations((d) => [...d.slice(0, index), d[index] ?? newChordDuration, ...d.slice(index)])
    setActiveIndex(index)
    setPreview(null)
    setGenerated(null)
    playChord(voiceChord(chord, { bottom: 48 }), { timbre })
  }

  const exportMidi = () => {
    const hasSong = song.length > 0
    const events = hasSong
      ? songToEvents(song, segments)
      : progressionToEvents(progression, inversions, durations)
    if (!events.length) return
    const bytes = buildMidi(events, {
      bpm,
      timeSignature,
      trackName: hasSong ? songTitle : 'Progression',
    })
    downloadMidi(bytes, hasSong ? songTitle : 'progression')
  }

  const loadChart = (parsed, detectedKey) => {
    stopEverything()
    if (detectedKey) setMusicKey(detectedKey)
    setProgression(parsed.chords)
    setInversions(parsed.chords.map(() => 0))
    setDurations(parsed.durations)
    setShapes(parsed.chords.map(() => null))
    setLines(parsed.chords.map(() => 0))
    setSpans(parsed.chords.map(() => 1))
    setLyricLines([''])
    setActiveIndex(parsed.chords.length - 1)
    setPreview(null)
    setGenerated(null)
  }

  // --- segments and song -----------------------------------------------------

  const saveSegment = (baseName) => {
    if (!progression.length) return
    const name = uniqueName((baseName || '').trim() || 'Section', segments)
    const segment = makeSegment({
      name,
      key: musicKey,
      progression,
      inversions,
      durations,
      timeSignature,
      shapes,
      lines,
      spans,
      lyricLines,
    })
    setSegments((list) => [...list, segment])
    // Saving is otherwise silent — the section lands in a tab you may not be
    // looking at, so without this there is nothing at all to tell you it worked.
    setSavedNote(name)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedNote(null), 2600)
    setJustSaved(true)
    clearTimeout(glowTimer.current)
    glowTimer.current = setTimeout(() => setJustSaved(false), 1000)
  }

  const setSegmentHue = (id, hue) => {
    setSegments((list) => list.map((s) => (s.id === id ? { ...s, hue } : s)))
  }

  const loadSegment = (id) => {
    const segment = segments.find((s) => s.id === id)
    if (!segment) return
    const live = readSegment(segment)
    if (!live.key) return
    stopEverything()
    setMusicKey(live.key)
    setProgression(live.progression)
    setInversions(live.inversions)
    setDurations(live.durations)
    setShapes(live.shapes)
    setLines(live.lines)
    setSpans(live.spans ?? live.progression.map(() => 1))
    setLyricLines(live.lyricLines.length ? live.lyricLines : [''])
    setTimeSignature(live.timeSignature)
    setActiveIndex(live.progression.length - 1)
    setPreview(null)
    setGenerated(null)
  }

  const renameSegment = (id, name) =>
    setSegments((list) => list.map((s) => (s.id === id ? { ...s, name } : s)))

  const deleteSegment = (id) => {
    setSegments((list) => list.filter((s) => s.id !== id))
    // Drop any arrangement entries that pointed at it.
    setSong((list) => list.filter((e) => e.segmentId !== id))
  }

  const addToSong = (segmentId) => setSong((list) => [...list, { segmentId, repeats: 1 }])

  /** Same shape as inserting a chord: the index is a gap, not a position. */
  const insertIntoSong = (at, segmentId) => {
    setSong((list) => {
      const where = Math.max(0, Math.min(at ?? list.length, list.length))
      return [...list.slice(0, where), { segmentId, repeats: 1 }, ...list.slice(where)]
    })
  }

  const setRepeats = (i, repeats) =>
    setSong((list) => list.map((e, j) => (j === i ? { ...e, repeats } : e)))

  const moveEntry = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= song.length) return
    setSong((list) => {
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const removeEntry = (i) => setSong((list) => list.filter((_, j) => j !== i))

  const playSong = () => {
    const items = flattenSong(song, segments)
    if (!items.length) return
    stopEverything()
    setPlayingSong(true)
    playProgression(
      items.map((item) => ({
        midis: voiceChord(item.chord, { inversion: item.inversion, bottom: 48 }),
        beats: toBeats(item.durationId),
      })),
      {
        bpm,
        timbre,
        pattern,
        loop,
        countIn: countIn ? timeSignatureOf(timeSignature).beatsPerBar : 0,
        beatsPerBar: timeSignatureOf(timeSignature).beatsPerBar,
        strum: timbre === 'guitar' ? 0.02 : 0.008,
        onStep: (i) => {
          const item = items[i]
          setPlayingSongIndex(item.entryIndex)
          // Follow along on the instruments without touching the editor's own
          // progression: the chord is shown as a preview, in its section's key.
          setPreview(item.chord)
          setDisplayInversion(item.inversion)
          setPlaybackKey(item.key)
        },
        onDone: () => {
          setPlayingSong(false)
          setPlayingSongIndex(-1)
          setPreview(null)
          setPlaybackKey(null)
        },
      },
    )
  }

  const stopEverything = () => {
    stopPlayback()
    setPlaying(false)
    setPlayingIndex(-1)
    setPlayingSong(false)
    setPlayingSongIndex(-1)
    setPlaybackKey(null)
  }

  const stop = () => stopEverything()

  const copyShare = async () => {
    const url = shareUrl({ key: musicKey, progression, inversions })
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const nTones = activeChord ? chordNotes(activeChord).length : 0

  // --- render ----------------------------------------------------------------

  // Every hook above runs on every route; only the body below changes. Swapping
  // the returned tree does not unmount this component, so the progression, the
  // undo stack and the audio graph all survive a trip to the legal pages.
  if (route !== 'app') {
    return (
      <div className="app">
        <header className="topbar">
          <a className="brand" {...linkProps('/')}>
            <h1><Lockup /></h1>
          </a>
          <div className="topbar-right">
            <Menu route={route} />
          </div>
        </header>
        <LegalPage route={route} />
        <SiteFooter route={route} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1><Lockup /></h1>
          <span className="tagline">fretboard &amp; keyboard progression explorer</span>
        </div>
        {/* The key and transpose controls moved down to the progression they act
            on. Share stays: it copies a link to the whole app state, not to one
            panel, so a bar that spans the app is where it belongs. */}
        <div className="topbar-right">
          <button className="btn ghost share-btn" onClick={copyShare} disabled={!progression.length}>
            {copied ? 'Link copied' : 'Share link'}
          </button>
          <Menu route={route} />
        </div>
      </header>

      <main className="layout">
        <section className="col col-left">
          <div className="panel p-progression">
            <div className="panel-head">
              <h2>Progression tool</h2>
            </div>

            {/* Both of these read or rewrite the progression below: which key the
                numerals are measured against, and moving the music to a new one.
                The muted key name that used to sit in the head is gone — the
                picker is the key name now.

                Hidden on the song tab: nothing here acts on a song, and leaving
                a key picker above an arrangement invites you to change the wrong
                thing. */}
            <div className="setup-bar" hidden={editorView === 'sections'}>
              <KeyPicker
                musicKey={musicKey}
                onChange={(k) => k && setMusicKey(k)}
                canDetect={progression.length > 1}
                onTranspose={transpose}
                canTranspose={progression.length > 0}
                onDetect={() => {
                  const k = detectKey(progression)
                  if (k) setMusicKey(k)
                }}
              />
            </div>

            {generated && (
              <p className="gen-note">
                <strong>{generated.flavourLabel}</strong> in {keyName(musicKey)}, ending on {generated.cadenceLabel}.
              </p>
            )}
            <div className="view-tabs">
              {[
                ['chips', 'Chords'],
                ['lyrics', 'Lyrics & timing'],
                ['sections', 'Song structure'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`${editorView === id ? 'on' : ''}${id === 'sections' && justSaved ? ' just-saved' : ''}`}
                  onClick={() => setEditorView(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* The timeline lays words out against chords, so with no chords it
                has nothing to lay them against — say so rather than render an
                empty box that looks broken. */}
            {editorView === 'lyrics' && progression.length === 0 && (
              <div className="progression empty">
                <p className="muted">
                  No chords yet. Lyrics are placed against the progression, so add some chords
                  first — then type the words here and drag each chord to the syllable it lands on.
                </p>
                <div className="empty-actions">
                  <button className="btn primary" onClick={() => openAddChord(0)}>+ Add a chord</button>
                  <button className="btn" onClick={surprise}>🎲 Surprise me — generate one</button>
                </div>
              </div>
            )}

            {editorView === 'lyrics' && progression.length > 0 && (
              <LyricTimeline
                progression={progression}
                lines={lines}
                spans={spans}
                lyricLines={lyricLines}
                musicKey={musicKey}
                activeIndex={activeIndex}
                playingIndex={playingIndex}
                onSelect={selectChord}
                onLyricLines={setLyricLines}
                onResize={resizeSpans}
                onMoveChordToLine={moveChordToLine}
                onRemove={removeChord}
              />
            )}

            {editorView === 'sections' && (
              <>
              <Arrangement
                segments={segments}
                song={song}
                bpm={bpm}
                playingSongIndex={playingSongIndex}
                playingSong={playingSong}
                onLoad={loadSegment}
                onRename={renameSegment}
                onDeleteSegment={deleteSegment}
                onOpenAddSection={(at) => setAddSectionAt(at)}
                onSetHue={setSegmentHue}
                onAddToSong={addToSong}
                onSetRepeats={setRepeats}
                onMoveEntry={moveEntry}
                onRemoveEntry={removeEntry}
                onClearSong={() => setSong([])}
                onPlaySong={playSong}
                onStopSong={stopEverything}
                onExport={() => setExporting(true)}
                onExportMidi={exportMidi}
              />
              </>
            )}

            <ProgressionBar
              progression={editorView === 'chips' ? progression : []}
              onAddAt={openAddChord}
              inversions={inversions}
              musicKey={musicKey}
              activeIndex={activeIndex}
              playingIndex={playingIndex}
              onSelect={selectChord}
              onRemove={removeChord}
              onInvert={setInversionAt}
              onDuration={setDurationAt}
              onMove={moveChord}
              onSurprise={surprise}
              onFlavour={setFlavour}
              flavour={flavour}
              flavours={Object.entries(FLAVOURS)}
              onSmooth={smoothVoicing}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              hideWhenEmpty={editorView !== 'chips'}
              shapes={shapes}
              tuningId={tuningId}
              durations={durations}
              timeSignature={timeSignature}
              onClear={() => {
                setProgression([])
                setInversions([])
                setDurations([])
                setShapes([])
                setLines([])
                setSpans([])
                setLyricLines([''])
                setActiveIndex(-1)
                setPreview(null)
                setGenerated(null)
                stop()
              }}
            />

            {editorView !== 'sections' && (
            <Transport
              playing={playing}
              onPlay={play}
              onStop={stop}
              bpm={bpm}
              onBpm={setBpm}
              timeSignature={timeSignature}
              onTimeSignature={setTimeSignature}
              newChordDuration={newChordDuration}
              onNewChordDuration={setNewChordDuration}
              timbre={timbre}
              onTimbre={setTimbre}
              volume={volume}
              onVolume={setVol}
              pattern={pattern}
              onPattern={setPattern}
              countIn={countIn}
              onCountIn={setCountIn}
              loop={loop}
              onLoop={setLoop}
              disabled={!progression.length}
              hideChordDefaults={editorView === 'lyrics'}
            />
            )}

            {/* Down with the transport rather than floating between the strip and
                it, where it had none of the panel's padding and read as loose.
                Still outside the Sections tab on purpose: it acts on the
                progression, not on the library, so it should not hide behind the
                tab that lists what you have already saved. */}
            {editorView !== 'sections' && (
              <SaveSectionRow canSave={progression.length > 0} onSave={saveSegment} savedNote={savedNote} />
            )}
          </div>

          {/* Its own panel directly under the progression, rather than inside the
              Sections tab: reopening earlier work is a way to *start*, so it
              should be visible without first going looking for it. */}
          {history.length > 0 && (
            <div className="panel p-recent">
              <div className="panel-head">
                <h2>Recent</h2>
                <span className="muted">progressions you built earlier</span>
                <button className="btn ghost tiny" onClick={() => setHistory(clearHistory())}>Clear</button>
              </div>
              <ul className="history">
                {history.slice(0, 8).map((h, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        const s = historyToState(h)
                        if (!s.key) return
                        setMusicKey(s.key)
                        setProgression(s.progression)
                        setInversions(s.progression.map(() => 0))
                        setDurations(s.progression.map(() => DEFAULT_DURATION))
                        setShapes(s.progression.map(() => null))
                        setLines(s.progression.map(() => 0))
                        setSpans(s.progression.map(() => 1))
                        setLyricLines([''])
                        setActiveIndex(s.progression.length - 1)
                        setPreview(null)
                      }}
                    >
                      <span className="hist-key">{h.key}</span>
                      <span className="hist-chords">{h.chords.join(' – ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </section>

        <section className="col col-right">
          {/* One instrument at a time. Both show the same chord and both feed the
              same pool of selected notes, so the toggle changes the view rather
              than the state — switching mid-selection keeps the notes you picked
              on the other instrument. */}
          <div className="panel p-instruments">
            <div className="panel-head">
              <h2>Instruments</h2>
              <div className="tabs">
                {[['piano', 'Piano'], ['guitar', 'Guitar']].map(([id, label]) => (
                  <button key={id} className={instrument === id ? 'on' : ''} onClick={() => setInstrument(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {instrument === 'piano' && (
            <Piano
              chord={activeChord}
              voicing={pianoVoicing}
              selection={selection}
              onToggleNote={toggleNote}
              scalePcs={showScale && activeScale ? activeScale.pcs : null}
              guideTonePcs={showScale && activeChord ? guideTones(activeChord).map((e) => pcOf(e.note)) : null}
            />
            )}

            {instrument === 'guitar' && (
            <>
            <div className="sub-head">
              <div className="fb-controls">
                <select value={tuningId} onChange={(e) => setTuningId(e.target.value)}>
                  {Object.entries(TUNINGS).map(([id, t]) => (
                    <option key={id} value={id}>{t.name}</option>
                  ))}
                </select>
                <div className="hand-toggle" role="group" aria-label="Handedness">
                  {[[false, 'Right'], [true, 'Left']].map(([value, text]) => (
                    <button
                      key={text}
                      className={lefty === value ? 'on' : ''}
                      onClick={() => {
                        setLefty(value)
                        savePref('lefty', value)
                      }}
                      title={`${text}-handed — mirrors the neck and the chord boxes together`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <label className="check">
                  <input type="checkbox" checked={showAllTones} onChange={(e) => setShowAllTones(e.target.checked)} />
                  all chord tones
                </label>
                {shape && (
                  <button
                    className="btn ghost tiny"
                    onClick={() => playChord(shape.midis, { timbre: 'guitar', strum: 0.03, duration: 2 })}
                  >
                    ▶ strum
                  </button>
                )}
              </div>
            </div>

            <Fretboard
              chord={activeChord}
              tuning={tuning}
              shape={shape}
              showAllTones={showAllTones}
              selection={selection}
              onToggleNote={toggleNote}
              lefty={lefty}
              scalePcs={showScale && activeScale ? activeScale.pcs : null}
              guideTonePcs={showScale && activeChord ? guideTones(activeChord).map((e) => pcOf(e.note)) : null}
            />

            {activeChord && (
              <div className="voicings">
                <div className="voicings-head">
                  <span className="lbl">Voicings</span>
                  <span className="muted small">
                    {voicings.length
                      ? showAllShapes
                        ? `all ${voicings.length} playable shapes, in fret order${shape ? ` — ${voicingLabel(shape)}` : ''}`
                        : `${voicings.length}${voicings.total > voicings.length ? ` of ${voicings.total}` : ''} playable shape${voicings.total === 1 ? '' : 's'}, spread across the neck${shape ? ` — ${voicingLabel(shape)}` : ''}`
                      : 'no playable shape found in this tuning'}
                  </span>
                  {voicings.total > 12 && (
                    <button className="btn ghost tiny" onClick={() => setShowAllShapes((v) => !v)}>
                      {showAllShapes ? 'Show fewer' : `Show all ${voicings.total}`}
                    </button>
                  )}
                </div>
                <div className={`box-row ${showAllShapes ? 'expanded' : ''}`}>
                  {shownShapes.map((s) => (
                    <ChordBox
                      key={shapeKey(s)}
                      shape={s}
                      chord={activeChord}
                      tuning={tuning}
                      active={shape != null && shapeKey(s) === shapeKey(shape)}
                      label={voicingLabel(s)}
                      lefty={lefty}
                      onClick={() => {
                        setVoicingPick(s)
                        // Remember it against this chord so it survives leaving
                        // the chord, reloading, and reaches the PDF.
                        if (!preview && focusIndex >= 0) {
                          setShapes((sh) => {
                            const next = [...sh]
                            while (next.length < progression.length) next.push(null)
                            next[focusIndex] = encodeShape(s, tuningId)
                            return next
                          })
                        }
                        playChord(s.midis, { timbre: 'guitar', strum: 0.03, duration: 2 })
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>

          <div className="panel p-chord">
            <div className="panel-head">
              <h2>
                {activeChord ? chordSymbol(activeChord) : 'No chord selected'}
                {/* Say so when the panel has left your selection to follow the
                    playhead, or the change looks like the app losing your place. */}
                {followingPlayback && <span className="playing-dot" title="Following playback" />}
              </h2>
              {activeChord && (
                <span className="muted">
                  {chordName(activeChord)} · {romanNumeral(activeChord, displayKey, activeInversion)} · {analysis.fnLabel}
                  {preview ? ' · preview' : ''}
                  {followingPlayback ? ` · bar ${playingBar}` : ''}
                </span>
              )}
            </div>

            {activeChord && (
              <div className="chord-detail">
                <div className="tone-legend">
                  {chordNotes(activeChord).map((e, i) => (
                    <span key={i} className="tone-tag" style={{ background: toneColor(e) }}>
                      {prettyName(e.note)}
                    </span>
                  ))}
                </div>
                <div className="inv-row">
                  <span className="lbl">Inversion</span>
                  {Array.from({ length: nTones }, (_, i) => (
                    <button
                      key={i}
                      className={`inv-pill ${activeInversion === i ? 'on' : ''}`}
                      title={inversionLabel(activeChord, i)}
                      onClick={() => {
                        // focusIndex, not activeIndex: what you edit is the chord
                        // named above the button, which during playback is the
                        // sounding one.
                        if (preview) setDisplayInversion(i)
                        else if (focusIndex >= 0) setInversionAt(focusIndex, i)
                      }}
                    >
                      {i === 0 ? 'root' : ['1st', '2nd', '3rd', '4th', '5th'][i - 1] ?? `${i}th`}
                    </button>
                  ))}
                  <span className="muted small">{inversionLabel(activeChord, activeInversion)}</span>
                </div>
                {preview && (
                  <button className="btn primary tiny" onClick={() => addChord(preview)}>
                    Add {chordSymbol(preview)} to the progression
                  </button>
                )}
              </div>
            )}

            {activeChord && (
              <>
                <div className="detail-tabs">
                  {[
                    ['scale', 'Scale applications'],
                    ['reharm', 'Reharmonise'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={detailTab === id ? 'on' : ''}
                      onClick={() => setDetailTab(id)}
                      disabled={id === 'reharm' && (preview || focusIndex < 0)}
                      title={id === 'reharm' && preview ? 'Select a chord in the progression first' : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {detailTab === 'scale' && (
                  <ScalePanel
                    chord={activeChord}
                    scales={scales}
                    activeScaleId={activeScale?.id}
                    onSelectScale={setScaleId}
                    showScale={showScale}
                    onToggleShow={setShowScale}
                    guideTones={guideTones(activeChord)}
                    commonWithNext={nextChord ? commonTones(activeChord, nextChord) : []}
                    nextChord={nextChord}
                  />
                )}

                {detailTab === 'reharm' && !preview && focusIndex >= 0 && (
                  <ReharmPanel
                    chord={progression[focusIndex]}
                    options={reharmOptions}
                    onPreview={previewChord}
                    onReplace={(chord) => replaceChordAt(focusIndex, chord)}
                    onInsert={(chord) => insertChordAt(focusIndex, chord)}
                  />
                )}
              </>
            )}
          </div>

        </section>
      </main>

      <AddChordDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        insertAt={activeIndex + 1}
        progression={progression}
        musicKey={musicKey}
        inputMode={inputMode}
        onInputMode={setInputMode}
        onAdd={addChordAndClose}
        suggestions={suggestions}
        onPreview={previewChord}
        onPlayTransition={playTransition}
        timeSignature={timeSignature}
        onLoadChart={(parsed) => {
          loadChart(parsed)
          setAddOpen(false)
        }}
        selection={selection}
        onClearNotes={() => setSelection(new Set())}
        identified={identified}
      />

      <AddSectionDialog
        open={addSectionAt !== null}
        insertAt={addSectionAt}
        songLength={song.length}
        onClose={() => setAddSectionAt(null)}
        segments={segments}
        onAdd={(id) => insertIntoSong(addSectionAt ?? song.length, id)}
      />

      {exporting && (
        <ExportDialog
          defaultTitle={songTitle}
          lefty={lefty}
          onCancel={() => setExporting(false)}
          onExport={({ title, instrument }) => {
            setSongTitle(title)
            exportChart({ song, segments, title, bpm, instrument, tuning, tuningId, lefty })
            setExporting(false)
          }}
        />
      )}

      <SiteFooter route={route} />
    </div>
  )
}
