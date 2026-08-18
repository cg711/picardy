import React, { useEffect, useRef, useState } from 'react'
import { PAGES } from '../lib/routes.js'
import { linkProps } from '../lib/router.js'

/**
 * The site menu.
 *
 * Built as a real menu rather than a styled div: the trigger reports its state to
 * assistive tech, Escape closes it and hands focus back, arrow keys move between
 * items, and the items are anchors so ⌘-click still opens a new tab. That is most
 * of the code here — the dropdown itself is four lines.
 */
export default function Menu({ route }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])

  const close = (returnFocus) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    // pointerdown rather than click: a menu that stays open until mouseup feels
    // stuck when you click straight through to something behind it.
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Opening moves focus into the menu, so it is usable without a mouse.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  const onMenuKeyDown = (event) => {
    const items = itemRefs.current.filter(Boolean)
    const here = items.indexOf(document.activeElement)
    const go = (i) => {
      event.preventDefault()
      items[(i + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(here + 1)
    else if (event.key === 'ArrowUp') go(here - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(items.length - 1)
    else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`btn ghost menu-btn${open ? ' on' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="site-menu"
        aria-label="Menu"
        onClick={() => setOpen((was) => !was)}
      >
        <span className="hamburger" aria-hidden="true">
          <i /><i /><i />
        </span>
      </button>

      {open && (
        <div className="menu-pop" id="site-menu" role="menu" onKeyDown={onMenuKeyDown}>
          {PAGES.map((page, i) => (
            <a
              key={page.path}
              {...linkProps(page.path)}
              ref={(el) => { itemRefs.current[i] = el }}
              role="menuitem"
              className="menu-item"
              aria-current={page.route === route ? 'page' : undefined}
              onClick={(event) => {
                linkProps(page.path).onClick(event)
                close(false)
              }}
            >
              {page.route === 'app' ? 'The app' : page.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
