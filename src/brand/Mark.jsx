import React from 'react'

/**
 * The Picardy mark: a P that is an upside-down half note.
 *
 * Stem on the left, oval bowl at the top right — turn a minim over and the
 * letterform is already there. One shape doing both jobs: the counter of the P
 * *is* the hole in the notehead. Two-tone by default because the name comes from
 * the Picardy third, the chord you did not expect — so the surprise is the part
 * with the colour in it.
 *
 * Three numbers are load-bearing and copied exactly from the brand kit:
 *   • the ellipse overlaps the stem — with a gap it reads as a bar beside an O
 *   • the stroke is 13.5 — heavier closes the counter below about 18px
 *   • the tilt is −20° — less and it stops reading as music, more and it stops
 *     reading as a letter
 */
export default function Mark({ size = 28, stem = 'var(--ink)', head = 'var(--accent)', title = 'Picardy' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className="brand-mark"
    >
      <g fill="none" strokeLinecap="round">
        <path d="M 28 24 L 28 89" stroke={stem} strokeWidth="13.5" />
        <ellipse
          cx="53"
          cy="34"
          rx="21.5"
          ry="17"
          transform="rotate(-20 53 34)"
          stroke={head}
          strokeWidth="13.5"
        />
      </g>
    </svg>
  )
}

/** Mark plus wordmark, as the app header uses it. */
export function Lockup({ size = 30 }) {
  return (
    <span className="brand-lockup">
      <Mark size={size} />
      <span className="brand-word">PICARDY</span>
    </span>
  )
}
