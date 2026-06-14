import { useState, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'

const KEY_MAP: Record<string, string> = {
  '1': 'pad-1',  '2': 'pad-2',  '3': 'pad-3',  '4': 'pad-4',
  'q': 'pad-5',  'w': 'pad-6',  'e': 'pad-7',  'r': 'pad-8',
  'a': 'pad-9',  's': 'pad-10', 'd': 'pad-11', 'f': 'pad-12',
  'z': 'pad-13', 'x': 'pad-14', 'c': 'pad-15', 'v': 'pad-16',
}

export function ReactPerformancePads() {
  const [collapsed, setCollapsed] = useState(false)

  const { performancePads, activePadId, setActivePadId } = useReactStore(
    useShallow((s) => ({
      performancePads: s.performancePads,
      activePadId:     s.activePadId,
      setActivePadId:  s.setActivePadId,
    })),
  )

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const padId = KEY_MAP[e.key.toLowerCase()]
      if (!padId) return
      e.preventDefault()
      setActivePadId(padId)
    },
    [setActivePadId],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div className="rv-pads-section">
      <div
        className="rv-panel-header rv-panel-header--toggle"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(v => !v) } }}
      >
        <span className="rv-panel-icon">▦</span>
        <span className="rv-panel-title">Performance Pads</span>
        <span className="rv-pads-hint">1–4 · Q–R · A–F · Z–V</span>
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="rv-pads-grid">
          {performancePads.map((pad) => {
            const isActive = pad.id === activePadId
            return (
              <button
                key={pad.id}
                className={`rv-pad${isActive ? ' rv-pad--active' : ''}${!pad.presetId ? ' rv-pad--empty' : ''}`}
                onClick={() => pad.presetId && setActivePadId(pad.id)}
                disabled={!pad.presetId}
                title={pad.presetId ? `${pad.label} [${pad.keyBinding.toUpperCase()}]` : 'Empty pad'}
                style={{
                  '--pad-color': pad.color,
                } as React.CSSProperties}
              >
                <span className="rv-pad-label">{pad.label}</span>
                <span className="rv-pad-key">{pad.keyBinding.toUpperCase()}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
