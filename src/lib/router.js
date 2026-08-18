import { useEffect, useState } from 'react'
import { routeFor } from './routes.js'

// A router in thirty lines, because the alternative is a dependency that exists
// to solve problems this app does not have — nested layouts, loaders, params.
// There are three pages and none of them take arguments.

const listeners = new Set()

export function navigate(path) {
  if (window.location.pathname === path) return
  // Pushing without the hash is deliberate: a legal URL should be clean. The App
  // component stays mounted across the change, so nothing is lost — its
  // writeHash effect simply rewrites the fragment from memory on the way back.
  window.history.pushState(null, '', path)
  const route = routeFor(path)
  listeners.forEach((notify) => notify(route))
  window.scrollTo(0, 0)
}

export function useRoute() {
  const [route, setRoute] = useState(() => routeFor(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(routeFor(window.location.pathname))
    window.addEventListener('popstate', onPop)
    listeners.add(setRoute)
    return () => {
      window.removeEventListener('popstate', onPop)
      listeners.delete(setRoute)
    }
  }, [])

  return route
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
