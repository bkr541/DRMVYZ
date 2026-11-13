import { useEffect, useRef, useState, type CSSProperties } from 'react'
import studyStyles from './performancePadStudies.css?inline'

const DESIGNS = [
  { id: 'signal', name: 'Full', compact: false },
  { id: 'compact', name: 'Compact', compact: true },
  { id: 'underline', name: 'Underline', compact: true },
  { id: 'accent-rail', name: 'Accent Rail', compact: true },
  { id: 'glow', name: 'Glow', compact: true },
] as const
const PADS = [
  { id: 'reactor', name: 'Reactor', key: '1', color: '#5993e8' },
  { id: 'drop-cage', name: 'Drop Cage', key: '2', color: '#df706d' },
  { id: 'infinity', name: 'Infinity', key: '3', color: '#64b98b' },
  { id: 'tunnel', name: 'Tunnel', key: '4', color: '#d9a35e' },
] as const

/** Visual studies only; selection stays local and never triggers a production pad. */
export function PerformancePadStudies() {
  const [selected, setSelected] = useState<Record<string, string>>(Object.fromEntries(DESIGNS.map(design => [design.id, 'reactor'])))
  const [hits, setHits] = useState<Set<string>>(new Set())
  const releaseTimers = useRef(new Map<string, number>())
  const rootRef = useRef<HTMLDivElement>(null)
  const strike = (id: string) => {
    window.clearTimeout(releaseTimers.current.get(id))
    releaseTimers.current.delete(id)
    setHits(current => new Set(current).add(id))
  }
  const release = (id: string) => {
    window.clearTimeout(releaseTimers.current.get(id))
    releaseTimers.current.delete(id)
    setHits(current => { const next = new Set(current); next.delete(id); return next })
  }
  useEffect(() => {
    const timers = releaseTimers.current
    const popup = rootRef.current?.ownerDocument.defaultView
    const reset = () => { timers.forEach(timer => window.clearTimeout(timer)); timers.clear(); setHits(new Set()) }
    popup?.addEventListener('blur', reset)
    return () => { timers.forEach(timer => window.clearTimeout(timer)); popup?.removeEventListener('blur', reset) }
  }, [])
  return <div ref={rootRef} className="ll-pad-studies" aria-label="Performance pad design studies">
    <style>{studyStyles}</style>
    {DESIGNS.map(design => <section className={`ll-pad-study ll-pad-study--${design.id}${design.compact ? ' ll-pad-study--compact' : ''}`} key={design.id} data-pad-study={design.id} aria-labelledby={`ll-pad-study-${design.id}`}>
      <header className="ll-pad-study-heading">
        <h2 id={`ll-pad-study-${design.id}`}><svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor"><rect x="2" y="2" width="5" height="5" /><rect x="12" y="2" width="5" height="5" /><rect x="2" y="12" width="5" height="5" /><rect x="12" y="12" width="5" height="5" /></svg>{design.name}</h2>
      </header>
      <div className="ll-pad-study-row" role="group" aria-label={`${design.name} performance pads`}>
        {PADS.map(pad => <button key={pad.id} type="button" className="ll-study-pad" aria-pressed={selected[design.id] === pad.id} aria-label={`${design.name}: ${pad.name}, shortcut ${pad.key}`} style={{ '--study-pad-color': pad.color } as CSSProperties} data-pad-study-item={`${design.id}-${pad.id}`} data-hit={hits.has(`${design.id}-${pad.id}`) || undefined}
          onPointerDown={event => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture?.(event.pointerId)
            strike(`${design.id}-${pad.id}`)
          }}
          onPointerUp={() => release(`${design.id}-${pad.id}`)}
          onPointerCancel={() => release(`${design.id}-${pad.id}`)}
          onBlur={() => release(`${design.id}-${pad.id}`)}
          onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); strike(`${design.id}-${pad.id}`) } }}
          onKeyUp={event => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault()
              setSelected(current => ({ ...current, [design.id]: pad.id }))
              release(`${design.id}-${pad.id}`)
            }
          }}
          onClick={event => {
            setSelected(current => ({ ...current, [design.id]: pad.id }))
            // Pointer/keyboard release already ended their strike. Only a
            // standalone assistive click needs its own brief visual pulse.
            if (event.detail === 0) {
              const id = `${design.id}-${pad.id}`
              strike(id)
              releaseTimers.current.set(id, window.setTimeout(() => release(id), 40))
            }
          }}>
          <span className="ll-study-pad-indicator" aria-hidden="true" />
          <span className="ll-study-pad-label">{pad.name}</span>
          <span className="ll-study-pad-key" aria-hidden="true">{pad.key}</span>
        </button>)}
      </div>
    </section>)}
  </div>
}
