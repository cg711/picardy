// Undo/redo for the progression editor.
//
// Rather than instrumenting every mutating action, this watches the composite
// editor state and records a snapshot whenever it changes. That way any new
// action — a transpose, a reharmonisation, a generated progression — becomes
// undoable without being taught about it.

import { useCallback, useEffect, useRef, useState } from 'react'

const LIMIT = 100
// Consecutive edits of the same field within this window collapse into one
// entry, so typing a lyric is not one undo step per keystroke.
const COALESCE_MS = 800

/**
 * @param snapshot  a plain object of the state to track; must be cheap to
 *                  compare with JSON.stringify
 * @param apply     called with a snapshot to restore it
 */
export function useUndo(snapshot, apply) {
  const undoStack = useRef([])
  const redoStack = useRef([])
  const last = useRef(snapshot)
  const applying = useRef(false)
  const lastPushAt = useRef(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const sync = () => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }

  useEffect(() => {
    // A restore is not itself an edit.
    if (applying.current) {
      applying.current = false
      last.current = snapshot
      return
    }
    const before = last.current
    if (JSON.stringify(before) === JSON.stringify(snapshot)) return

    // Which fields changed? If it is only the free-text one and the last entry
    // was moments ago, replace that entry rather than stacking another.
    const changed = Object.keys(snapshot).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(snapshot[k]),
    )
    const textOnly = changed.length === 1 && changed[0] === 'lyricLines'
    const recent = Date.now() - lastPushAt.current < COALESCE_MS

    if (!(textOnly && recent && undoStack.current.length)) {
      undoStack.current.push(before)
      if (undoStack.current.length > LIMIT) undoStack.current.shift()
      lastPushAt.current = Date.now()
    }

    redoStack.current = []
    last.current = snapshot
    sync()
  }, [snapshot])

  const undo = useCallback(() => {
    const previous = undoStack.current.pop()
    if (!previous) return
    redoStack.current.push(last.current)
    applying.current = true
    last.current = previous
    apply(previous)
    sync()
  }, [apply])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(last.current)
    applying.current = true
    last.current = next
    apply(next)
    sync()
  }, [apply])

  useEffect(() => {
    const onKey = (e) => {
      // Leave the browser's own text undo alone while typing.
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return { undo, redo, canUndo, canRedo }
}
