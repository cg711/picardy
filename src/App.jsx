import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeKey, keyName, detectKey, romanNumeral } from './theory/keys.js'
import { chordSymbol, chordName, chordNotes, voiceChord, inversionLabel, chordId, parseChord, bassOf } from './theory/chords.js'
import { pcOf, prettyName, noteName } from './theory/notes.js'
import { suggestNext, analyzeChord } from './theory/suggest.js'
import { generateProgression, FLAVOURS } from './theory/generate.js'
import { DURATIONS, DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE, TIME_SIGNATURES, toBeats, timeSignatureOf, snapBeat, MIN_BEATS } from './theory/rhythm.js'
import { transposeChord, transposeKey, keyPrefersFlats } from './theory/transpose.js'
import { optimiseInversions, progressionMovement } from './theory/voicelead.js'
import { scalesForChord, guideTones, commonTones } from './theory/scales.js'
import { reharmonise } from './theory/reharm.js'
import {
  findVoicings, TUNINGS, voicingLabel, encodeShape, decodeShape, shapeFromFrets,
  CUSTOM_TUNING, tuningKey, normaliseTuning,
} from './theory/guitar.js'
import { identifyChord } from './theory/identify.js'
import { playChord, playProgression, stopPlayback, setVolume, resumeAudio } from './audio/synth.js'
import { isBand } from './audio/styles.js'
import { buildMidi, songToEvents, progressionToEvents, downloadMidi } from './lib/midi.js'
import {
  decodeState, encodeState, writeHash, shareUrl, loadHistory, saveToHistory, clearHistory, historyToState,
  loadPrefs, savePref,
} from './lib/share.js'
import { toneColor } from './lib/colors.js'
import { useUndo } from './lib/useUndo.js'
import {
  makeSegment, readSegment, flattenSong, flattenMelody, loadSegments, saveSegments, loadSong, saveSong, uniqueName,
} from './lib/song.js'

import { Lockup } from './brand/Mark.jsx'
import KeyPicker from './components/KeyPicker.jsx'
import TuningPicker from './components/TuningPicker.jsx'
import ProgressionBar from './components/ProgressionBar.jsx'
import Piano from './components/Piano.jsx'
import Fretboard, { ChordBox } from './components/Fretboard.jsx'
import Transport from './components/Transport.jsx'
import Arrangement, { SaveSectionRow } from './components/Arrangement.jsx'
import AddChordDialog from './components/AddChordDialog.jsx'
import AddSectionDialog from './components/AddSectionDialog.jsx'
import ExportDialog from './components/ExportDialog.jsx'
import AnalysisPanel from './components/AnalysisPanel.jsx'
import ScalePanel from './components/ScalePanel.jsx'
import ReharmDialog from './components/ReharmDialog.jsx'
import LyricTimeline from './components/LyricTimeline.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import MelodyRoll from './components/MelodyRoll.jsx'
import { exportChart } from './lib/pdf.js'
import { useRoute, linkProps } from './lib/router.js'
import { legacyToolPath, pageFor, BACKING_PATH } from './lib/routes.js'
import Menu from './components/Menu.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import LegalPage from './pages/LegalPage.jsx'
import ExercisesPage from './pages/ExercisesPage.jsx'
import HomePage from './pages/HomePage.jsx'
import BackingPage from './pages/BackingPage.jsx'

// Before anything reads the URL: a shared progression that arrives at '/' is
// forwarded to the tool, carrying its fragment. Every link ever generated points
// at the old address, and replaceState keeps them working without a round trip
// or an entry in the back history.
{
  const forwarded = legacyToolPath(window.location.pathname, window.location.hash)
  if (forwarded) window.history.replaceState(null, '', `${forwarded}${window.location.hash}`)
}

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
  // The words sung under each chord, and the words before the first chord of
  // each line. Alignment is this association, not a position — which is what
  // keeps the editor and the printed chart from ever disagreeing.
  const [lyrics, setLyrics] = useState(initial?.lyrics ?? [])
  const [leadIns, setLeadIns] = useState(initial?.leadIns ?? [''])
  // A melody line over the progression: { at, beats, midi } in quarter-note
  // beats from the start, independent of which chord happens to be underneath.
  const [melody, setMelody] = useState(initial?.melody ?? [])
  const [noteLength, setNoteLength] = useState(1)
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

  const [tuningId, setTuningId] = useState(() => loadPrefs().tuningId ?? 'standard')
  // The notes behind 'custom'. Kept separately from tuningId so switching to a
  // preset and back does not lose what you built.
  const [customStrings, setCustomStrings] = useState(() => normaliseTuning(loadPrefs().customStrings ?? TUNINGS.standard.strings))
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
  // What the PDF dialog is about to export: null when shut, otherwise the scope.
  const [exporting, setExporting] = useState(null)
  // Whether exports carry the melody. One switch for both, sitting next to the
  // two buttons it governs — the PDF dialog mirrors it, MIDI has no dialog.
  const [includeMelody, setIncludeMelody] = useState(true)
  const [songTitle, setSongTitle] = useState('Untitled')
  const [pattern, setPattern] = useState('block')
  const [countIn, setCountIn] = useState(false)
  const [loop, setLoop] = useState(false)
  const [showScale, setShowScale] = useState(false)
  const [scaleId, setScaleId] = useState(null)
  // Which chord the reharmonise sidebar is open on, or null when it is shut.
  const [reharmAt, setReharmAt] = useState(null)
  const prevLen = useRef(progression.length)
  const activeIndexRef = useRef(activeIndex)
  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const tuning = tuningId === CUSTOM_TUNING ? customStrings : (TUNINGS[tuningId]?.strings ?? TUNINGS.standard.strings)
  // What a pinned shape is stamped with. For a custom tuning this is its notes,
  // so retuning one string correctly invalidates shapes found on the old one.
  const shapeTuningKey = tuningKey(tuningId, customStrings)

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
    lyrics,
    leadIns,
    key: `${noteName(musicKey.tonic)}${musicKey.mode === 'minor' ? 'm' : ''}`,
    timeSignature,
  }), [progression, inversions, durations, shapes, lines, lyrics, leadIns, musicKey, timeSignature])

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
    setLyrics(snap.lyrics ?? [])
    setLeadIns(snap.leadIns ?? [''])
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
    const frets = decodeShape(shapes[focusIndex], shapeTuningKey)
    return frets ? shapeFromFrets(frets, tuning) : null
  }, [shapes, focusIndex, shapeTuningKey, tuning, preview])

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
    writeHash({ key: musicKey, progression, inversions, durations, timeSignature, shapes, leadIns, lines, lyrics, melody })
  }, [route, musicKey, progression, inversions, durations, timeSignature, shapes, leadIns, lines, lyrics, melody])

  // One place sets the tab title, for every route. Per-page effects that each
  // restored "the app's title" on unmount meant a cold load and a navigation
  // could disagree about what the same page is called.
  useEffect(() => { document.title = pageFor(route).title }, [route])

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
    setReharmAt(null)
    setAddOpen(true)
  }

  /**
   * Reharmonise the chord at `i`.
   *
   * Selecting it first is what makes reharmOptions describe the right chord —
   * and it is also what you want anyway, since the analysis below then reads the
   * chord you are about to change.
   */
  const openReharm = (i) => {
    if (i < 0 || i >= progression.length) return
    setAddOpen(false)
    setPreview(null)
    setActiveIndex(i)
    setReharmAt(i)
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
      // A new chord starts with no words under it.
      setLyrics((w) => [...w.slice(0, insertAt), '', ...w.slice(insertAt)])
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
    setLyrics((w) => w.filter((_, j) => j !== i))
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
    setLyrics((w) => {
      const padded = [...w]
      while (padded.length < progression.length) padded.push('')
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

  /**
   * Move a chord to another slot outright, for dragging.
   *
   * Everything about a chord lives in a parallel array beside it — its
   * inversion, its length, its pinned shape, its words, its lyric line — so all
   * six move together or the chord arrives wearing someone else's voicing.
   */
  const reorderChord = (from, to) => {
    if (from === to || from < 0 || from >= progression.length || to < 0 || to >= progression.length) return
    const move = (arr, pad) => {
      const next = [...arr]
      while (next.length < progression.length) next.push(pad)
      const [taken] = next.splice(from, 1)
      next.splice(to, 0, taken)
      return next
    }
    setProgression((p) => move(p, null))
    setInversions((iv) => move(iv, 0))
    setDurations((d) => move(d, DEFAULT_DURATION))
    setShapes((sh) => move(sh, null))
    setLyrics((w) => move(w, ''))
    setLines((ln) => move(ln, 0))
    setActiveIndex(to)
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

  /** The words sung under one chord. */
  const setLyricAt = (i, text) => {
    setLyrics((list) => {
      const next = [...list]
      while (next.length < progression.length) next.push('')
      next[i] = text
      return next
    })
  }

  /** The words before the first chord of a line. */
  const setLeadInAt = (line, text) => {
    setLeadIns((list) => {
      const next = [...list]
      while (next.length <= line) next.push('')
      next[line] = text
      return next
    })
  }

  /**
   * Start a new lyric line at chord `i`, or fold it back into the line above.
   *
   * A line break lives *between two chords*, so this is what the editor should
   * expose — not "move a chord to another line", which is the same idea stated
   * backwards and leaves everything after it behind. Every chord from here on
   * shifts, because a break moves the rest of the lyric down with it.
   */
  const setLineBreakAt = (i, on) => {
    setLines((ln) => {
      const next = [...ln]
      while (next.length < progression.length) next.push(0)
      if (!on && (next[i] ?? 0) <= 0) return next
      const delta = on ? 1 : -1
      for (let j = i; j < progression.length; j++) next[j] = Math.max(0, (next[j] ?? 0) + delta)
      return next
    })
    // A new line needs a lead-in slot; folding one away leaves a harmless spare.
    if (on) setLeadIns((ls) => [...ls, ''])
  }

  const moveChordToLine = (i, line) => {
    if (line < 0) return
    setLines((ln) => {
      const next = [...ln]
      while (next.length < progression.length) next.push(0)
      next[i] = line
      return next
    })
    setLeadIns((ls) => {
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

  /**
   * What the transport should be playing *now*, read once a bar by the
   * scheduler. Held in a ref rather than passed by value because the whole point
   * is that it is newer than whatever was true when Play was pressed.
   */
  const liveRef = useRef(null)
  liveRef.current = {
    bpm,
    pattern,
    timbre,
    melody,
    items: progression.map((c, i) => ({
      midis: voiceChord(c, { inversion: inversions[i] ?? 0, bottom: 48 }),
      beats: toBeats(durations[i]),
      bassPc: pcOf(bassOf(c, inversions[i] ?? 0).note),
    })),
  }

  /**
   * @param live when true the scheduler follows the editor as it changes; false
   *   for one-off auditions of something that is not the progression.
   */
  const playChords = (chords, invs, durs = [], { live = false } = {}) => {
    if (!chords.length) return
    const voiced = chords.map((c, i) => ({
      midis: voiceChord(c, { inversion: invs[i] ?? 0, bottom: 48 }),
      beats: toBeats(durs[i]),
      // What the bass player plays. bassOf honours a slash chord's own symbol,
      // so D/F♯ puts F♯ down there rather than the root.
      bassPc: pcOf(bassOf(c, invs[i] ?? 0).note),
    }))
    setPlaying(true)
    playProgression(voiced, {
      bpm,
      timbre,
      pattern,
      loop,
      countIn: countIn ? timeSignatureOf(timeSignature).beatsPerBar : 0,
      beatsPerBar: timeSignatureOf(timeSignature).beatsPerBar,
      timeSignature: timeSignatureOf(timeSignature),
      melody,
      settings: live ? () => liveRef.current : null,
      strum: timbre === 'guitar' ? 0.02 : 0.008,
      onStep: (i) => setPlayingIndex(i),
      onDone: () => {
        setPlaying(false)
        setPlayingIndex(-1)
      },
    })
  }

  const play = () => playChords(progression, inversions, durations, { live: true })

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
    setLyrics(result.progression.map(() => ''))
    setLeadIns([''])
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

  /** A readable name for whatever is being exported. */
  const nameFor = (scope) => {
    if (scope?.kind === 'section') return segments.find((s) => s.id === scope.id)?.name ?? 'Section'
    return songTitle || 'Untitled'
  }

  const exportMidi = (scope = { kind: 'song' }) => {
    const entries = entriesFor(scope)
    const fromSong = entries.length > 0
    const events = fromSong
      ? songToEvents(entries, segments)
      : progressionToEvents(progression, inversions, durations)
    if (!events.length) return
    // A song's melody is every section's line laid end to end; the editor's is
    // simply the one on the roll.
    const line = fromSong ? flattenMelody(entries, segments) : melody
    const name = nameFor(scope)
    const bytes = buildMidi(events, {
      bpm,
      timeSignature,
      trackName: name,
      melody: includeMelody ? line : [],
    })
    downloadMidi(bytes, name)
  }

  const loadChart = (parsed, detectedKey) => {
    stopEverything()
    if (detectedKey) setMusicKey(detectedKey)
    setProgression(parsed.chords)
    setInversions(parsed.chords.map(() => 0))
    setDurations(parsed.durations)
    setShapes(parsed.chords.map(() => null))
    setLines(parsed.chords.map(() => 0))
    setLyrics(parsed.chords.map(() => ''))
    setLeadIns([''])
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
      lyrics,
      leadIns,
      melody,
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
    setLyrics(live.lyrics ?? live.progression.map(() => ''))
    setLeadIns(live.leadIns.length ? live.leadIns : [''])
    setMelody(live.melody ?? [])
    setTimeSignature(live.timeSignature)
    setActiveIndex(live.progression.length - 1)
    setPreview(null)
    setGenerated(null)
    // Go where the thing you just loaded actually is. Loading a section only to
    // stay on the song tab left the chords invisible — and the progression
    // controls are hidden there, so there was nothing to edit them with either.
    setEditorView('chips')
  }

  const renameSegment = (id, name) =>
    setSegments((list) => list.map((s) => (s.id === id ? { ...s, name } : s)))

  const deleteSegment = (id) => {
    setSegments((list) => list.filter((s) => s.id !== id))
    // Drop any arrangement entries that pointed at it.
    setSong((list) => list.filter((e) => e.segmentId !== id))
  }

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

  /**
   * Move an entry to another position outright, for dragging.
   *
   * Distinct from moveEntry, which swaps with a neighbour: dropping four rows
   * down should land where you dropped it, not swap with whatever happens to be
   * there.
   */
  const reorderEntry = (from, to) => {
    setSong((list) => {
      if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  /**
   * The whole arrangement as a backing-track link.
   *
   * Flattening is safe across sections in different keys because chord symbols
   * are absolute — a section written in E♭ contributes E♭ chords, not degrees —
   * so the only thing lost is which key each section was *thought* in, and the
   * player shows section names instead of roman numerals anyway.
   */
  /**
   * A scope — the whole song, one section, or what is in the editor — as the
   * (song, segments) pair every exporter already takes. Doing the translation
   * once is what lets the backing track, the chart and the MIDI all gain
   * per-section export without any of them learning a new shape.
   */
  const entriesFor = useCallback((scope) => {
    if (scope?.kind === 'section') return [{ segmentId: scope.id, repeats: 1 }]
    if (scope?.kind === 'progression') return []
    return song
  }, [song])

  /** Does the arrangement carry a melody at all? Governs whether the option shows. */
  const songHasMelody = useMemo(
    () => (song.length ? flattenMelody(song, segments).length > 0 : melody.length > 0),
    [song, segments, melody],
  )

  const backingHrefFor = useCallback((scope) => {
    const entries = entriesFor(scope)
    // No arrangement to draw on: hand over whatever is in the editor.
    if (!entries.length) {
      if (!progression.length) return BACKING_PATH
      return `${BACKING_PATH}#${encodeState({
        key: musicKey, progression, inversions, durations, timeSignature,
        bpm, style: isBand(pattern) ? pattern : 'pop', melody,
      })}`
    }
    const items = flattenSong(entries, segments)
    if (!items.length) return BACKING_PATH

    const sections = []
    let lastEntry = null
    items.forEach((item, i) => {
      if (item.entryIndex !== lastEntry) {
        sections.push({
          at: i,
          name: item.segmentName,
          key: item.key ? `${noteName(item.key.tonic)}${item.key.mode === 'minor' ? 'm' : ''}` : null,
        })
        lastEntry = item.entryIndex
      }
    })

    return `${BACKING_PATH}#${encodeState({
      key: items[0].key,
      progression: items.map((i) => i.chord),
      inversions: items.map((i) => i.inversion ?? 0),
      durations: items.map((i) => i.durationId),
      timeSignature: items[0].timeSignature ?? timeSignature,
      bpm,
      style: isBand(pattern) ? pattern : 'pop',
      melody: flattenMelody(entries, segments),
      sections,
    })}`
  }, [entriesFor, segments, progression, inversions, durations, musicKey, timeSignature, bpm, pattern, melody])

  const playSong = () => {
    const items = flattenSong(song, segments)
    if (!items.length) return
    stopEverything()
    setPlayingSong(true)
    // Where each section begins, in beats — the band puts a fill in the bar
    // before each one, so an arrangement announces its own changes.
    const sectionStartBeats = []
    let beatCursor = 0
    let lastEntry = null
    for (const item of items) {
      if (item.entryIndex !== lastEntry) {
        sectionStartBeats.push(beatCursor)
        lastEntry = item.entryIndex
      }
      beatCursor += toBeats(item.durationId)
    }

    playProgression(
      items.map((item) => ({
        midis: voiceChord(item.chord, { inversion: item.inversion, bottom: 48 }),
        beats: toBeats(item.durationId),
        bassPc: pcOf(bassOf(item.chord, item.inversion).note),
      })),
      {
        bpm,
        timbre,
        pattern,
        loop,
        countIn: countIn ? timeSignatureOf(timeSignature).beatsPerBar : 0,
        beatsPerBar: timeSignatureOf(timeSignature).beatsPerBar,
        timeSignature: timeSignatureOf(timeSignature),
        sectionStartBeats,
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
        {route === 'home' ? <HomePage />
          : route === 'backing' ? <BackingPage />
            : route === 'exercises' ? <ExercisesPage />
              : <LegalPage route={route} />}
        <SiteFooter route={route} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        {/* A link now that there is a front page to go back to. */}
        <a className="brand" {...linkProps('/')}>
          <h1><Lockup /></h1>
          <span className="tagline">fretboard &amp; keyboard progression explorer</span>
        </a>
        {/* The key and transpose controls moved down to the progression they act
            on. Share stays: it copies a link to the whole app state, not to one
            panel, so a bar that lyrics the app is where it belongs. */}
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
              <h2>Studio</h2>
            </div>

            {/* Both of these read or rewrite the progression below: which key the
                numerals are measured against, and moving the music to a new one.
                The muted key name that used to sit in the head is gone — the
                picker is the key name now.

                Only on the Chords tab, because that is the only place these act
                on what is in front of you. Above an arrangement or a page of
                lyrics they are an invitation to change the wrong thing. */}
            <div className="setup-bar" hidden={editorView !== 'chips'}>
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
                ['melody', 'Melody'],
                ['lyrics', 'Lyrics & timing'],
                ['sections', 'Song structure'],
                ['export', 'Export'],
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

            {editorView === 'export' && (
              <ExportPanel
                song={song}
                segments={segments}
                songTitle={songTitle}
                onSongTitle={setSongTitle}
                progression={progression}
                timeSignature={timeSignature}
                musicKey={musicKey}
                bpm={bpm}
                hasMelody={songHasMelody}
                includeMelody={includeMelody}
                onIncludeMelody={setIncludeMelody}
                backingHrefFor={backingHrefFor}
                onExportPdf={(scope) => setExporting(scope)}
                onExportMidi={exportMidi}
              />
            )}

            {editorView === 'melody' && progression.length === 0 && (
              <div className="progression empty">
                <p className="muted">
                  A melody is written against chords. Add a couple on the Chords tab
                  and the roll will have something to explain your notes against.
                </p>
              </div>
            )}

            {editorView === 'melody' && progression.length > 0 && (
              <>
                <div className="melody-controls">
                  <label className="ctl">
                    <span className="lbl">Note length</span>
                    <select value={noteLength} onChange={(e) => setNoteLength(Number(e.target.value))}>
                      <option value={0.5}>1/8</option>
                      <option value={1}>1/4</option>
                      <option value={2}>1/2</option>
                      <option value={4}>1/1</option>
                    </select>
                  </label>
                  <button className="btn ghost" onClick={() => setMelody([])} disabled={!melody.length}>
                    Clear melody
                  </button>
                  <span className="muted small">
                    {melody.length} note{melody.length === 1 ? '' : 's'}
                  </span>
                </div>
                <MelodyRoll
                  progression={progression}
                  durations={progression.map((_, i) => toBeats(durations[i]))}
                  timeSignature={timeSignature}
                  musicKey={displayKey}
                  melody={melody}
                  onChange={setMelody}
                  playingIndex={playingIndex}
                  noteLength={noteLength}
                />
              </>
            )}

            {/* The timeline lays words out against chords, so with no chords it
                has nothing to lay them against — say so rather than render an
                empty box that looks broken. */}
            {editorView === 'lyrics' && progression.length === 0 && (
              <div className="progression empty">
                <p className="muted">
                  No chords yet. Every chord holds the words sung on it, so write the progression
                  on the Chords tab first and each chord will turn up here with a box beneath it.
                </p>
              </div>
            )}

            {editorView === 'lyrics' && progression.length > 0 && (
              <LyricTimeline
                progression={progression}
                lines={lines}
                lyrics={lyrics}
                leadIns={leadIns}
                musicKey={musicKey}
                activeIndex={activeIndex}
                playingIndex={playingIndex}
                onSelect={selectChord}
                onLyric={setLyricAt}
                onLeadIn={setLeadInAt}
                onSetLineBreak={setLineBreakAt}
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
                onSetRepeats={setRepeats}
                onMoveEntry={moveEntry}
                onReorder={reorderEntry}
                onRemoveEntry={removeEntry}
                onClearSong={() => setSong([])}
                onPlaySong={playSong}

                onStopSong={stopEverything}

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
              onReorder={reorderChord}
              onReharm={openReharm}
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
              tuningId={shapeTuningKey}
              durations={durations}
              timeSignature={timeSignature}
              onClear={() => {
                setProgression([])
                setInversions([])
                setDurations([])
                setShapes([])
                setLines([])
                setLyrics([])
                setLeadIns([''])
                setActiveIndex(-1)
                setPreview(null)
                setGenerated(null)
                stop()
              }}
            />

            {editorView !== 'sections' && editorView !== 'export' && (
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
              hideNewChord={editorView !== 'chips'}
              hideMetre={editorView === 'lyrics'}
            />
            )}

            {/* Down with the transport rather than floating between the strip and
                it, where it had none of the panel's padding and read as loose.
                Still outside the Sections tab on purpose: it acts on the
                progression, not on the library, so it should not hide behind the
                tab that lists what you have already saved. */}
            {/* Both act on the progression. The export tab is about what leaves
                the app, so a transport and a save-as-section field there are two
                controls for a thing you are not doing. */}
            {editorView !== 'sections' && editorView !== 'export' && (
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
                        setLyrics(s.progression.map(() => ''))
                        setLeadIns([''])
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
                <TuningPicker
                  tuningId={tuningId}
                  strings={tuning}
                  customStrings={customStrings}
                  preferFlats={keyPrefersFlats(musicKey)}
                  onSelect={(id) => {
                    setTuningId(id)
                    savePref('tuningId', id)
                  }}
                  onCustom={(next) => {
                    const clean = normaliseTuning(next)
                    setCustomStrings(clean)
                    savePref('customStrings', clean)
                    if (tuningId !== CUSTOM_TUNING) {
                      setTuningId(CUSTOM_TUNING)
                      savePref('tuningId', CUSTOM_TUNING)
                    }
                  }}
                />
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
                            next[focusIndex] = encodeShape(s, shapeTuningKey)
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

          {/* The chord you are on comes first inside this panel, then the whole
              progression underneath it — see AnalysisPanel. */}
          <AnalysisPanel
            progression={progression}
            musicKey={musicKey}
            activeIndex={activeIndex}
            playingIndex={playingIndex}
            onSelect={setActiveIndex}
            onUseKey={setMusicKey}
          >
            {/* The chord readout, merged into the analysis panel rather than
                sitting in one of its own. They answer the same question at two
                scales — what is this, and what is it doing — and a chart the
                width of the column between them was mostly border. */}
            {activeChord && (
              <>
                <div className="sub-head">
                  <h3>{chordSymbol(activeChord)}</h3>
                  <span className="muted small">
                    {chordName(activeChord)} · {romanNumeral(activeChord, displayKey, activeInversion)} · {analysis.fnLabel}
                    {preview ? ' · preview' : ''}
                    {followingPlayback ? ` · bar ${playingBar}` : ''}
                  </span>
                  {followingPlayback && <span className="playing-dot" title="Following playback" />}
                </div>

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
                          // focusIndex, not activeIndex: what you edit is the
                          // chord named above the button, which during playback
                          // is the sounding one.
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

                {/* Reharmonise used to be the other half of a tab pair here. It
                    opens from the chord in the strip now, so this is just the
                    scales — no tabs, nothing hidden behind the one you left
                    selected last time. */}
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
              </>
            )}
          </AnalysisPanel>

          {/* One instrument at a time. Both show the same chord and both feed the
              same pool of selected notes, so the toggle changes the view rather
              than the state — switching mid-selection keeps the notes you picked
              on the other instrument. */}

        </section>
      </main>

      <ReharmDialog
        open={reharmAt !== null}
        chord={reharmAt !== null ? progression[reharmAt] : null}
        index={reharmAt ?? 0}
        musicKey={musicKey}
        options={reharmOptions}
        onClose={() => setReharmAt(null)}
        onPreview={previewChord}
        onReplace={(chord) => {
          if (reharmAt !== null) replaceChordAt(reharmAt, chord)
          setReharmAt(null)
        }}
        onInsert={(chord) => {
          if (reharmAt !== null) insertChordAt(reharmAt, chord)
          setReharmAt(null)
        }}
      />

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
          defaultTitle={nameFor(exporting)}
          lefty={lefty}
          hasMelody={songHasMelody}
          onCancel={() => setExporting(null)}
          onExport={({ title, instrument, includeMelody: withMelody }) => {
            const entries = entriesFor(exporting)
            // A section keeps its own name on the chart; the whole song takes
            // the title, and typing one here is also how you rename the song.
            if (exporting?.kind !== 'section') setSongTitle(title)
            exportChart({
              song: entries,
              segments,
              title,
              bpm,
              instrument,
              tuning,
              tuningId: shapeTuningKey,
              lefty,
              includeMelody: withMelody,
            })
            setExporting(null)
          }}
        />
      )}

      <SiteFooter route={route} />
    </div>
  )
}
