// Keeping something visible inside a horizontal scroller.
//
// Pulled out of the progression strip so the rule can be asserted without a DOM.
// It is worth that on its own: twice now the strip has parked the add-a-chord
// card a few pixels past its right edge, where it is still painted — clipped, so
// clicks fall through to whatever is behind the strip — and looks perfectly
// present while doing nothing.

/**
 * Where to scroll so the span `[left, right)` sits inside the viewport, or null
 * to stay where it is.
 *
 * `right` is deliberately the caller's choice rather than "the element's right
 * edge": what has to stay in view is often a region ending past the thing being
 * focused. That is the whole fix — the region around the last chord has to
 * include the card that follows it, because that card is what you reach for
 * next.
 */
export function keepInView({ scrollLeft, clientWidth, left, right, pad = 12 }) {
  if (left < scrollLeft) return Math.max(0, left - pad)
  if (right > scrollLeft + clientWidth) return right - clientWidth + pad
  return null
}

/** Is `[left, right)` fully visible at this scroll offset? */
export const isFullyVisible = ({ scrollLeft, clientWidth, left, right }) =>
  left >= scrollLeft && right <= scrollLeft + clientWidth
