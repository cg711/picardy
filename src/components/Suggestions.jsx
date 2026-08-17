import React, { useMemo, useState } from 'react'
import { CATEGORIES } from '../theory/suggest.js'
import { chordNotes } from '../theory/chords.js'
import { prettyName } from '../theory/notes.js'
import { categoryStyle } from '../lib/colors.js'

const TIER_ORDER = ['vcommon', 'common', 'occasional', 'uncommon', 'rare']

export default function Suggestions({ suggestions, onAdd, onPreview, limit = 40 }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const counts = useMemo(() => {
    const m = new Map()
    for (const s of suggestions) {
      for (const c of s.categories ?? [s.category]) m.set(c, (m.get(c) ?? 0) + 1)
    }
    return m
  }, [suggestions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return suggestions.filter((s) => {
      if (filter !== 'all' && !(s.categories ?? [s.category]).includes(filter)) return false
      if (!q) return true
      return s.symbol.toLowerCase().includes(q) || s.roman.toLowerCase().includes(q)
    })
  }, [suggestions, filter, query])

  const shown = showAll ? filtered : filtered.slice(0, limit)

  const grouped = useMemo(() => {
    const g = new Map(TIER_ORDER.map((k) => [k, []]))
    for (const s of shown) g.get(s.tier.key)?.push(s)
    return g
  }, [shown])

  return (
    <div className="suggestions">
      <div className="sug-controls">
        <input
          className="sug-search"
          placeholder="Filter by symbol or numeral…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="cat-chips">
          <button className={`cat-chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            All <em>{suggestions.length}</em>
          </button>
          {Object.entries(CATEGORIES).map(([id, c]) => {
            const n = counts.get(id) ?? 0
            if (!n) return null
            return (
              <button
                key={id}
                className={`cat-chip ${filter === id ? 'on' : ''}`}
                style={filter === id ? categoryStyle(c.hue) : { borderColor: `hsl(${c.hue} 40% 26%)` }}
                onClick={() => setFilter(filter === id ? 'all' : id)}
              >
                {c.label} <em>{n}</em>
              </button>
            )
          })}
        </div>
      </div>

      {TIER_ORDER.map((tierKey) => {
        const items = grouped.get(tierKey) ?? []
        if (!items.length) return null
        return (
          <section key={tierKey} className={`tier tier-${tierKey}`}>
            <h4 className="tier-head">
              <span className={`tier-dot ${tierKey}`} />
              {items[0].tier.label}
              <span className="tier-count">{items.length}</span>
            </h4>
            <ul className="sug-list">
              {items.map((s) => {
                const cat = CATEGORIES[s.category]
                const isOpen = expanded === s.id
                return (
                  <li key={s.id} className={`sug ${isOpen ? 'open' : ''}`}>
                    <div className="sug-main" onClick={() => setExpanded(isOpen ? null : s.id)}>
                      <div className="sug-ident">
                        <span className="sug-roman">{s.roman}</span>
                        <span className="sug-symbol">{s.symbol}</span>
                      </div>
                      <span className="sug-cat" style={categoryStyle(cat.hue)}>{cat.label}</span>
                      <div className="sug-score" title={`Commonality ${Math.round(s.score)} / 100`}>
                        <span style={{ width: `${Math.max(4, s.score)}%` }} />
                      </div>
                      <div className="sug-buttons">
                        <button
                          className="btn tiny"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPreview(s.chord)
                          }}
                          title="Hear it and show it on the instruments"
                        >
                          ▶
                        </button>
                        <button
                          className="btn tiny primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAdd(s.chord)
                          }}
                          title="Append to the progression"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="sug-why">
                        <p>{s.why}</p>
                        {s.contextWhy && (
                          <p className="ctx">
                            <strong>In this context:</strong> it {s.contextWhy}.
                          </p>
                        )}
                        {s.alsoKnownAs?.map((alt, i) => (
                          <p key={i} className="alt">
                            <span className="sug-cat" style={categoryStyle(CATEGORIES[alt.category].hue)}>
                              also {CATEGORIES[alt.category].label}
                            </span>{' '}
                            {alt.why}
                          </p>
                        ))}
                        <p className="tones">
                          {chordNotes(s.chord).map((e, i) => (
                            <span key={i}>{prettyName(e.note)}</span>
                          ))}
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {!showAll && filtered.length > limit && (
        <button className="btn ghost wide" onClick={() => setShowAll(true)}>
          Show all {filtered.length} candidates — down to the rare ones
        </button>
      )}
      {showAll && (
        <button className="btn ghost wide" onClick={() => setShowAll(false)}>
          Collapse back to the top {limit}
        </button>
      )}
      {!filtered.length && <p className="muted pad">No candidates match that filter.</p>}
    </div>
  )
}
