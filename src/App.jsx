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
import ChordInput from './components/ChordInput.jsx'
import RomanPicker from './components/RomanPicker.jsx'
import ProgressionBar from './components/ProgressionBar.jsx'
import Suggestions from './components/Suggestions.jsx'
import Piano from './components/Piano.jsx'
import Fretboard, { ChordBox } from './components/Fretboard.jsx'
import Transport from './components/Transport.jsx'
import Arrangement from './components/Arrangement.jsx'
import ExportDialog from './components/ExportDialog.jsx'
import ScalePanel from './components/ScalePanel.jsx'
import ReharmPanel from './components/ReharmPanel.jsx'
import ImportPanel from './components/ImportPanel.jsx'
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
  const [lyricLines, setLyricLines] = useState(initial?.lyricLines ?? [''])
  const [editorView, setEditorView] = useState('chips')
  const [timeSignature, setTimeSignature] = useState(initial?.timeSignature ?? DEFAULT_TIME_SIGNATURE)
  const [newChordDuration, setNewChordDuration] = useState(DEFAULT_DURATION)
  const [activeIndex, setActiveIndex] = useState((initial?.progression?.length ?? 1) - 1)
  const [preview, setPreview] = useState(null)
  const [selection, setSelection] = useState(() => new Set())
  const [inputMode, setInputMode] = useState('text')

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
  const [detailTab, setDetailTab] = useState('voicing')
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
    lyricLines,
    key: `${noteName(musicKey.tonic)}${musicKey.mode === 'minor' ? 'm' : ''}`,
    timeSignature,
  }), [progression, inversions, durations, shapes, lines, lyricLines, musicKey, timeSignature])

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
    writeHash({ key: musicKey, progression, inversions, durations, timeSignature, shapes, lyricLines, lines })
  }, [route, musicKey, progression, inversions, durations, timeSignature, shapes, lyricLines, lines])

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

  const removeChord = (i) => {
    setProgression((p) => p.filter((_, j) => j !== i))
    setInversions((iv) => iv.filter((_, j) => j !== i))
    setDurations((d) => d.filter((_, j) => j !== i))
    setShapes((sh) => sh.filter((_, j) => j !== i))
    setLines((ln) => ln.filter((_, j) => j !== i))
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
   * Ripple drag: moving chord `i` later lengthens the chord before it and
   * carries everything after along unchanged, so only one duration changes.
   * That is what makes it behave like sliding a divider.
   */
  const dragChord = (i, deltaBeats) => {
    if (i <= 0 || !Number.isFinite(deltaBeats)) return
    setDurations((d) => {
      const next = [...d]
      while (next.length < progression.length) next.push(DEFAULT_DURATION)
      const previous = toBeats(next[i - 1])
      // The previous chord absorbs the move, and can never vanish entirely.
      const grown = Math.max(MIN_BEATS, previous + deltaBeats)
      if (Math.abs(grown - previous) < 1e-9) return d
      next[i - 1] = grown
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
    setLyricLines([''])
    setActiveIndex(parsed.chords.length - 1)
    setPreview(null)
    setGenerated(null)
  }

  // --- segments and song -----------------------------------------------------

  const saveSegment = (baseName) => {
    if (!progression.length) return
    const segment = makeSegment({
      name: uniqueName(baseName, segments),
      key: musicKey,
      progression,
      inversions,
      durations,
      timeSignature,
      shapes,
      lines,
      lyricLines,
    })
    setSegments((list) => [...list, segment])
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
              <h2>Progression</h2>
              <div className="head-right">
                <select
                  className="flavour"
                  value={flavour}
                  onChange={(e) => setFlavour(e.target.value)}
                  aria-label="Generator style"
                  title="Which harmonic vocabulary the generator draws on"
                >
                  <option value="any">Any style</option>
                  {Object.entries(FLAVOURS).map(([id, f]) => (
                    <option key={id} value={id}>{f.label}</option>
                  ))}
                </select>
                <button className="btn surprise" onClick={surprise} title="Generate a progression that ends on a cadence">
                  🎲 Surprise me
                </button>
              </div>
            </div>

            {/* Both of these read or rewrite the progression below: which key the
                numerals are measured against, and moving the music to a new one.
                The muted key name that used to sit in the head is gone — the
                picker is the key name now. */}
            <div className="setup-bar">
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
              ].map(([id, label]) => (
                <button key={id} className={editorView === id ? 'on' : ''} onClick={() => setEditorView(id)}>
                  {label}
                </button>
              ))}
            </div>

            {editorView === 'lyrics' && progression.length > 0 && (
              <LyricTimeline
                progression={progression}
                durations={durations}
                lines={lines}
                lyricLines={lyricLines}
                musicKey={musicKey}
                timeSignature={timeSignature}
                activeIndex={activeIndex}
                playingIndex={playingIndex}
                onSelect={selectChord}
                onLyricLines={setLyricLines}
                onDragChord={dragChord}
                onMoveChordToLine={moveChordToLine}
                onRemove={removeChord}
              />
            )}

            <ProgressionBar
              progression={editorView === 'chips' ? progression : []}
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
              onSmooth={smoothVoicing}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              hideWhenEmpty={editorView === 'lyrics'}
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
                setLyricLines([''])
                setActiveIndex(-1)
                setPreview(null)
                setGenerated(null)
                stop()
              }}
            />
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
            />
          </div>

          {/* Typing a chord, picking a numeral, spelling one on the instruments,
              pasting a chart and taking a suggestion are five routes to the same
              destination — a chord in the progression. They were two panels; the
              suggestion list stays below the input rather than becoming a sixth
              tab, so you can type and still see what the engine would pick. */}
          <div className="panel grow p-add">
            <div className="panel-head">
              <h2>Add a chord</h2>
              <div className="tabs">
                {[
                  ['text', 'Type'],
                  ['roman', 'Numerals'],
                  ['notes', 'From notes'],
                  ['import', 'Paste chart'],
                ].map(([id, label]) => (
                  <button key={id} className={inputMode === id ? 'on' : ''} onClick={() => setInputMode(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {inputMode === 'text' && <ChordInput onAdd={addChord} musicKey={musicKey} />}
            {inputMode === 'roman' && <RomanPicker musicKey={musicKey} onAdd={addChord} />}
            {inputMode === 'import' && (
              <ImportPanel timeSignature={timeSignature} onLoad={loadChart} />
            )}
            {inputMode === 'notes' && (
              <div className="from-notes">
                <p className="muted">
                  Click notes on the piano or the fretboard in Instruments. The lowest note is treated as the bass.
                </p>
                <div className="sel-notes">
                  {[...selection].sort((a, b) => a - b).map((m) => (
                    <span key={m} className="pill tiny">{m}</span>
                  ))}
                  {selection.size > 0 && (
                    <button className="btn ghost tiny" onClick={() => setSelection(new Set())}>Clear notes</button>
                  )}
                </div>
                {identified.length > 0 ? (
                  <ul className="ident-list">
                    {identified.map((r, i) => (
                      <li key={r.symbol}>
                        <span className="ident-symbol">{r.symbol}</span>
                        <span className="ident-roman">{romanNumeral(r.chord, musicKey)}</span>
                        <span className="muted">
                          {[
                            r.missing ? `${r.missing} tone missing` : null,
                            r.extra ? `${r.extra} extra note` : null,
                          ].filter(Boolean).join(', ') || 'exact match'}
                        </span>
                        <button className="btn tiny primary" onClick={() => addChord(r.chord)}>Add</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{selection.size < 2 ? 'Pick at least two notes.' : 'No chord matches those notes.'}</p>
                )}
              </div>
            )}

            <div className="sub-head">
              <h3>What comes next</h3>
              <span className="muted">
                {progression.length && activeIndex >= 0
                  ? `after ${chordSymbol(progression[activeIndex])}`
                  : 'opening chord'}
              </span>
            </div>
            <Suggestions suggestions={suggestions} onAdd={addChord} onPreview={previewChord} />
          </div>
          <div className="panel p-arrange">
            <div className="panel-head">
              <h2>Sections &amp; song</h2>
              <span className="muted">
                {segments.length ? `${segments.length} saved` : 'build a song from named sections'}
              </span>
            </div>
            <Arrangement
              segments={segments}
              song={song}
              bpm={bpm}
              canSave={progression.length > 0}
              playingSongIndex={playingSongIndex}
              playingSong={playingSong}
              onSave={saveSegment}
              onLoad={loadSegment}
              onRename={renameSegment}
              onDeleteSegment={deleteSegment}
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

            {/* Named sections are work you saved; Recent is work you didn't. Both
                answer "get me back to something I had", so they belong together
                rather than at opposite corners of the screen. */}
            {history.length > 0 && (
              <>
                <div className="sub-head">
                  <h3>Recent</h3>
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
              </>
            )}
          </div>

        </section>

        <section className="col col-right">
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
                    ['voicing', 'Voicing'],
                    ['scale', 'What to play'],
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

          {/* One panel, not two: both are the same chord seen from a different
              instrument, both respond to the same selection, and the "From
              notes" input treats clicks on either as one pool of notes. */}
          <div className="panel p-instruments">
            <div className="panel-head">
              <h2>Instruments</h2>
              <span className="muted">click keys or frets to select notes</span>
            </div>

            <div className="sub-head">
              <h3>Piano</h3>
            </div>
            <Piano
              chord={activeChord}
              voicing={pianoVoicing}
              selection={selection}
              onToggleNote={toggleNote}
              scalePcs={showScale && activeScale ? activeScale.pcs : null}
              guideTonePcs={showScale && activeChord ? guideTones(activeChord).map((e) => pcOf(e.note)) : null}
            />

            <div className="sub-head">
              <h3>Guitar</h3>
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
          </div>

        </section>
      </main>

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
