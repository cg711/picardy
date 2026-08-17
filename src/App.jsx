import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { makeKey, keyName, detectKey, romanNumeral } from './theory/keys.js'
import { chordSymbol, chordName, chordNotes, voiceChord, inversionLabel, chordId } from './theory/chords.js'
import { pcOf, prettyName } from './theory/notes.js'
import { suggestNext, analyzeChord } from './theory/suggest.js'
import { generateProgression, FLAVOURS } from './theory/generate.js'
import { DURATIONS, DEFAULT_DURATION, DEFAULT_TIME_SIGNATURE, TIME_SIGNATURES, beatsOf, timeSignatureOf } from './theory/rhythm.js'
import { transposeChord, transposeKey, keyPrefersFlats } from './theory/transpose.js'
import { optimiseInversions, progressionMovement } from './theory/voicelead.js'
import { scalesForChord, guideTones, commonTones } from './theory/scales.js'
import { reharmonise } from './theory/reharm.js'
import { findVoicings, TUNINGS, voicingLabel } from './theory/guitar.js'
import { identifyChord } from './theory/identify.js'
import { playChord, playProgression, stopPlayback, setVolume, resumeAudio, PATTERNS } from './audio/synth.js'
import { buildMidi, songToEvents, progressionToEvents, downloadMidi } from './lib/midi.js'
import {
  decodeState, writeHash, shareUrl, loadHistory, saveToHistory, clearHistory, historyToState,
  loadPrefs, savePref,
} from './lib/share.js'
import { toneColor } from './lib/colors.js'
import {
  makeSegment, readSegment, flattenSong, loadSegments, saveSegments, loadSong, saveSong, uniqueName,
} from './lib/song.js'

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
import { exportChart } from './lib/pdf.js'

const initial = decodeState(window.location.hash)

/** Stable identity for a fretboard shape, used to keep it selected as lists change. */
const shapeKey = (s) => s.frets.map((f) => (f === null ? 'x' : f)).join('-')

export default function App() {
  const [musicKey, setMusicKey] = useState(initial?.key ?? makeKey('C', 'major'))
  const [progression, setProgression] = useState(initial?.progression ?? [])
  const [inversions, setInversions] = useState(initial?.inversions ?? [])
  const [durations, setDurations] = useState(initial?.durations ?? [])
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

  const tuning = TUNINGS[tuningId].strings

  // --- derived ---------------------------------------------------------------

  const activeChord = preview ?? progression[activeIndex] ?? null
  const activeInversion = preview ? displayInversion : (inversions[activeIndex] ?? 0)

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

  const shapes = useMemo(() => {
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
      ? [...shapes].sort((a, b) => a.position - b.position || b.score - a.score)
      : shapes
    if (voicingPick && !base.some((s) => shapeKey(s) === shapeKey(voicingPick))) {
      return [voicingPick, ...base]
    }
    return base
  }, [shapes, showAllShapes, voicingPick])

  const shape = voicingPick ?? shownShapes[0] ?? null
  const displayKey = playbackKey ?? musicKey
  const analysis = activeChord ? analyzeChord(activeChord, displayKey) : null

  const scales = useMemo(
    () => (activeChord ? scalesForChord(activeChord, displayKey) : []),
    [activeChord, displayKey],
  )
  const activeScale = scales.find((s) => s.id === scaleId) ?? scales[0] ?? null
  const nextChord = activeIndex >= 0 ? progression[activeIndex + 1] ?? null : null
  const reharmOptions = useMemo(
    () => (activeIndex >= 0 && progression[activeIndex] ? reharmonise(progression, activeIndex, musicKey) : { replace: [], insert: [] }),
    [progression, activeIndex, musicKey],
  )

  const identified = useMemo(
    () => (selection.size >= 2 ? identifyChord([...selection], musicKey) : []),
    [selection, musicKey],
  )

  // --- effects ---------------------------------------------------------------

  useEffect(() => {
    writeHash({ key: musicKey, progression, inversions, durations, timeSignature })
  }, [musicKey, progression, inversions, durations, timeSignature])

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
      beats: beatsOf(durs[i] ?? DEFAULT_DURATION),
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
    const flats = keyPrefersFlats(target)
    setMusicKey(target)
    setProgression((p) => p.map((c) => transposeChord(c, semitones, flats)))
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
        beats: beatsOf(item.durationId),
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Picardy</h1>
          <span className="tagline">fretboard &amp; keyboard progression explorer</span>
        </div>
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
        <div className="topbar-right">
          <button className="btn ghost" onClick={copyShare} disabled={!progression.length}>
            {copied ? 'Link copied' : 'Share link'}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="col col-left">
          <div className="panel">
            <div className="panel-head">
              <h2>Progression</h2>
              <div className="head-right">
                <span className="muted">{keyName(musicKey)}</span>
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
            {generated && (
              <p className="gen-note">
                <strong>{generated.flavourLabel}</strong> in {keyName(musicKey)}, ending on {generated.cadenceLabel}.
              </p>
            )}
            <ProgressionBar
              progression={progression}
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
              durations={durations}
              timeSignature={timeSignature}
              onClear={() => {
                setProgression([])
                setInversions([])
                setDurations([])
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

          <div className="panel">
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
          </div>

          <div className="panel">
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
                  Click notes on the piano or the fretboard below. The lowest note is treated as the bass.
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
          </div>

          <div className="panel grow">
            <div className="panel-head">
              <h2>What comes next</h2>
              <span className="muted">
                {progression.length && activeIndex >= 0
                  ? `after ${chordSymbol(progression[activeIndex])}`
                  : 'opening chord'}
              </span>
            </div>
            <Suggestions suggestions={suggestions} onAdd={addChord} onPreview={previewChord} />
          </div>
        </section>

        <section className="col col-right">
          <div className="panel">
            <div className="panel-head">
              <h2>{activeChord ? chordSymbol(activeChord) : 'No chord selected'}</h2>
              {activeChord && (
                <span className="muted">
                  {chordName(activeChord)} · {romanNumeral(activeChord, displayKey, activeInversion)} · {analysis.fnLabel}
                  {preview ? ' · preview' : ''}
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
                        if (preview) setDisplayInversion(i)
                        else if (activeIndex >= 0) setInversionAt(activeIndex, i)
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
                      disabled={id === 'reharm' && (preview || activeIndex < 0)}
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

                {detailTab === 'reharm' && !preview && activeIndex >= 0 && (
                  <ReharmPanel
                    chord={progression[activeIndex]}
                    options={reharmOptions}
                    onPreview={previewChord}
                    onReplace={(chord) => replaceChordAt(activeIndex, chord)}
                    onInsert={(chord) => insertChordAt(activeIndex, chord)}
                  />
                )}
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Piano</h2>
              <span className="muted">click keys to select notes</span>
            </div>
            <Piano
              chord={activeChord}
              voicing={pianoVoicing}
              selection={selection}
              onToggleNote={toggleNote}
              scalePcs={showScale && activeScale ? activeScale.pcs : null}
              guideTonePcs={showScale && activeChord ? guideTones(activeChord).map((e) => pcOf(e.note)) : null}
            />
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Guitar</h2>
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
                    {shapes.length
                      ? showAllShapes
                        ? `all ${shapes.length} playable shapes, in fret order${shape ? ` — ${voicingLabel(shape)}` : ''}`
                        : `${shapes.length}${shapes.total > shapes.length ? ` of ${shapes.total}` : ''} playable shape${shapes.total === 1 ? '' : 's'}, spread across the neck${shape ? ` — ${voicingLabel(shape)}` : ''}`
                      : 'no playable shape found in this tuning'}
                  </span>
                  {shapes.total > 12 && (
                    <button className="btn ghost tiny" onClick={() => setShowAllShapes((v) => !v)}>
                      {showAllShapes ? 'Show fewer' : `Show all ${shapes.total}`}
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
                        playChord(s.midis, { timbre: 'guitar', strum: 0.03, duration: 2 })
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <h2>Recent</h2>
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
      </main>

      {exporting && (
        <ExportDialog
          defaultTitle={songTitle}
          lefty={lefty}
          onCancel={() => setExporting(false)}
          onExport={({ title, instrument }) => {
            setSongTitle(title)
            exportChart({ song, segments, title, bpm, instrument, tuning, lefty })
            setExporting(false)
          }}
        />
      )}

      <footer className="foot">
        <span className="muted">
          Suggestions are ranked by how often each move appears in common-practice and jazz repertoire, then reweighted
          against your actual progression — root motion, unresolved tendency tones, and voice leading.
        </span>
      </footer>
    </div>
  )
}
