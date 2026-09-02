import { useEffect, useState } from 'react'
import { routeFor } from './routes.js'

// A router in forty lines, because the alternative is a dependency that exists
// to solve problems this app does not have — nested layouts, loaders, guards.
//
// What is tracked is the path, not the route it maps to. Lessons made that
// distinction load-bearing: /lessons/cadences and /lessons/ii-v-i are both the
// route 'lesson', so a router that stored the route would see no change between
// them and leave the reader on the article they had just navigated away from.

const listeners = new Set()

const announce = () => {
  const path = window.location.pathname
  listeners.forEach((notify) => notify(path))
}

export function navigate(path) {
  if (window.location.pathname === path) return
  // Pushing without the hash is deliberate: a legal URL should be clean. The App
  // component stays mounted across the change, so nothing is lost — its
  // writeHash effect simply rewrites the fragment from memory on the way back.
  window.history.pushState(null, '', path)
  announce()
  window.scrollTo(0, 0)
}

/** Subscribe to the current pathname. */
export function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    listeners.add(setPath)
    return () => {
      window.removeEventListener('popstate', onPop)
      listeners.delete(setPath)
    }
  }, [])

  return path
}

export function useRoute() {
  return routeFor(usePathname())
}

/**
 * Props for an in-app link.
 *
 * A real href, so middle-click, ⌘-click, "open in new tab" and "copy link
 * address" all behave — an onClick-only div would break every one of them.
 */
export function linkProps(path) {
  return {
    href: path,
    onClick: (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(path)
    },
  }
}
