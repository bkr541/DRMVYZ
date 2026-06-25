import React, { useState, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { NeonLatticeTriggerType } from './ReactTypes'

// ── Key→pad mapping (unchanged) ──────────────────────────────────────────────

const KEY_MAP: Record<string, string> = {
  '1': 'pad-1',  '2': 'pad-2',  '3': 'pad-3',  '4': 'pad-4',
  'q': 'pad-5',  'w': 'pad-6',  'e': 'pad-7',  'r': 'pad-8',
  'a': 'pad-9',  's': 'pad-10', 'd': 'pad-11', 'f': 'pad-12',
  'z': 'pad-13', 'x': 'pad-14', 'c': 'pad-15', 'v': 'pad-16',
}

// ── Neon Lattice contextual pads (first 8 slots when engine is neonLattice) ──

export const NL_TRIGGER_PADS: Array<{
  padId:   string
  trigger: NeonLatticeTriggerType
  label:   string
  color:   string
}> = [
  { padId: 'pad-1', trigger: 'railBurst',    label: 'Rail Burst',  color: '#4ac7db' },
  { padId: 'pad-2', trigger: 'blockCascade', label: 'Cascade',     color: '#61d6aa' },
  { padId: 'pad-3', trigger: 'crossFlare',   label: 'Cross Flare', color: '#e8f4f8' },
  { padId: 'pad-4', trigger: 'whiteout',     label: 'Whiteout',    color: '#ffffff' },
  { padId: 'pad-5', trigger: 'blackout',     label: 'Blackout',    color: '#1a0a2e' },
  { padId: 'pad-6', trigger: 'reseed',       label: 'Reseed',      color: '#b84fc9' },
  { padId: 'pad-7', trigger: 'freezeTrails', label: 'Freeze',      color: '#80c8ff' },
  { padId: 'pad-8', trigger: 'cyanStrike',   label: 'Cyan Strike', color: '#00ffee' },
]

const NL_TRIGGER_PAD_IDS = new Set(NL_TRIGGER_PADS.map(p => p.padId))

const PRESSED_DURATION_MS = 150

export function ReactPerformancePads() {
  const [collapsed, setCollapsed] = useState(true)
  const [pressedNlPadId, setPressedNlPadId] = useState<string | null>(null)

  const {
    performancePads,
    activePadId,
    setActivePadId,
    activeReactEngineId,
    triggerNeonLattice,
  } = useReactStore(
    useShallow((s) => ({
      performancePads:      s.performancePads,
      activePadId:          s.activePadId,
      setActivePadId:       s.setActivePadId,
      activeReactEngineId:  s.activeReactEngineId,
      triggerNeonLattice:   s.triggerNeonLattice,
    })),
  )

  const isNeonLattice = activeReactEngineId === 'neonLattice'

  // Fire trigger + brief visual flash; does not persist state beyond the timeout
  const fireNlTrigger = useCallback(
    (padId: string, trigger: NeonLatticeTriggerType) => {
      triggerNeonLattice(trigger)
      setPressedNlPadId(padId)
      setTimeout(() => setPressedNlPadId(p => p === padId ? null : p), PRESSED_DURATION_MS)
    },
    [triggerNeonLattice],
  )

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return

      const padId = KEY_MAP[e.key.toLowerCase()]
      if (!padId) return
      e.preventDefault()

      // Contextual NL trigger pads (pads 1-8 when neonLattice is active)
      if (isNeonLattice && NL_TRIGGER_PAD_IDS.has(padId)) {
        const nlPad = NL_TRIGGER_PADS.find(p => p.padId === padId)
        if (nlPad) fireNlTrigger(nlPad.padId, nlPad.trigger)
        return
      }

      setActivePadId(padId)
    },
    [setActivePadId, fireNlTrigger, isNeonLattice],
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
        <svg width="14" height="14" viewBox="0 0 512 512" fill="#a78bfa" style={{ flexShrink: 0 }}>
          <path d="M217.043,0.001H16.696C7.515,0.001,0,7.479,0,16.697v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V16.697C233.739,7.479,226.224,0.001,217.043,0.001z"/>
          <path d="M495.304,0.001H294.957c-9.18,0-16.696,7.477-16.696,16.696v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V16.697C512,7.479,504.485,0.001,495.304,0.001z"/>
          <path d="M217.043,278.262H16.696C7.515,278.262,0,285.739,0,294.958v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V294.958C233.739,285.739,226.224,278.262,217.043,278.262z"/>
          <path d="M495.304,278.262H294.957c-9.18,0-16.696,7.477-16.696,16.696v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V294.958C512,285.739,504.485,278.262,495.304,278.262z"/>
        </svg>
        <span className="rv-panel-title">Performance Pads</span>
        <span className="rv-pads-hint">
          {isNeonLattice ? '1–4 · Q–R = NL Triggers · A–F · Z–V' : '1–4 · Q–R · A–F · Z–V'}
        </span>
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="rv-pads-grid">
          {performancePads.map((pad) => {
            const isActive = pad.id === activePadId

            // Contextual NL trigger pads override the first 8 slots
            if (isNeonLattice) {
              const nlPad = NL_TRIGGER_PADS.find(p => p.padId === pad.id)
              if (nlPad) {
                const isPressed = pressedNlPadId === nlPad.padId
                return (
                  <button
                    key={pad.id}
                    className={`rv-pad rv-pad--nl-trigger${isPressed ? ' rv-pad--pressed' : ''}`}
                    onClick={() => fireNlTrigger(nlPad.padId, nlPad.trigger)}
                    title={`${nlPad.label} [${pad.keyBinding.toUpperCase()}]`}
                    style={{ '--pad-color': nlPad.color } as React.CSSProperties}
                  >
                    <span className="rv-pad-label">{nlPad.label}</span>
                    <span className="rv-pad-key">{pad.keyBinding.toUpperCase()}</span>
                  </button>
                )
              }
            }

            // Default preset pad behavior for remaining slots
            return (
              <button
                key={pad.id}
                className={`rv-pad${isActive ? ' rv-pad--active' : ''}${!pad.presetId ? ' rv-pad--empty' : ''}`}
                onClick={() => pad.presetId && setActivePadId(pad.id)}
                disabled={!pad.presetId}
                title={pad.presetId ? `${pad.label} [${pad.keyBinding.toUpperCase()}]` : 'Empty pad'}
                style={{ '--pad-color': pad.color } as React.CSSProperties}
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
