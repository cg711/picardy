// One colour per chord-tone function, shared by the piano and the fretboard so
// a "3" is the same colour wherever you look.

const BY_DEGREE = {
  1: 'var(--tone-root)',
  2: 'var(--tone-ext)',
  3: 'var(--tone-third)',
  4: 'var(--tone-ext)',
  5: 'var(--tone-fifth)',
  6: 'var(--tone-sixth)',
  7: 'var(--tone-seventh)',
  9: 'var(--tone-ninth)',
  11: 'var(--tone-eleventh)',
  13: 'var(--tone-thirteenth)',
}

export function toneColor(entry) {
  if (!entry) return 'var(--surface-3)'
  if (entry.upper) return 'var(--tone-upper)'
  return BY_DEGREE[entry.degree] ?? 'var(--tone-ext)'
}

export function categoryStyle(hue) {
  return {
    '--cat-h': hue,
    background: `hsl(${hue} 60% 16%)`,
    borderColor: `hsl(${hue} 55% 34%)`,
    color: `hsl(${hue} 85% 78%)`,
  }
}
