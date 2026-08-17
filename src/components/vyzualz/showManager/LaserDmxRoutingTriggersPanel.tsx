// Live "which trigger is firing right now" readout for Show Manager's
// LaserDMX Analysis tab. Reuses Audio Intelligence's own ref-driven
// requestAnimationFrame update pattern (no React re-renders during playback)
// so it reads as part of the same system, while using its own row/dot
// styling per the requested label-left / dot-right layout.

import { useEffect, useRef } from 'react'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import { Collapsible } from '../react/ReactControlRows'

// The exact trigger vocabulary a LaserDMX fixture can be configured to fire
// from (LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS in LaserDmxShowManagerDomain.ts),
// minus 'none' since that isn't a real signal to light up. Grouped by trigger
// mode: beat/downbeat/bar-interval triggers vs. audio-onset (kick/snare) hits.
function isFiring(label: string, r: MusicIntelligenceFrame['rhythm']): boolean {
  switch (label) {
    case 'Beat': return r.beatHit
    case 'Downbeat': return r.downbeatHit
    case '4 Bars': return r.downbeatHit && r.barIndex % 4 === 0
    case '8 Bars': return r.downbeatHit && r.barIndex % 8 === 0
    case '16 Bars': return r.downbeatHit && r.barIndex % 16 === 0
    case '24 Bars': return r.downbeatHit && r.barIndex % 24 === 0
    case 'Kick Hit': return r.kickHit
    case 'Snare Hit': return r.snareHit
    default: return false
  }
}

const TRIGGER_GROUPS: { title: string; labels: string[] }[] = [
  { title: 'Beat & Bar', labels: ['Beat', 'Downbeat', '4 Bars', '8 Bars', '16 Bars', '24 Bars'] },
  { title: 'Hits', labels: ['Kick Hit', 'Snare Hit'] },
]

interface Row {
  label: string
  dotEl: HTMLSpanElement | null
}

export function LaserDmxRoutingTriggersPanel() {
  const animRef = useRef<number>(0)
  const rows = useRef<Row[]>(TRIGGER_GROUPS.flatMap(group => group.labels).map(label => ({ label, dotEl: null })))

  useEffect(() => {
    function tick() {
      const f: MusicIntelligenceFrame = AudioFeatureBus.getFrame()
      rows.current.forEach(row => {
        if (row.dotEl) row.dotEl.className = `vz-mi-trigger-dot${isFiring(row.label, f.rhythm) ? ' vz-mi-trigger-dot--active' : ''}`
      })
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="vz-mi-panel">
      <Collapsible label="Routing Triggers" defaultOpen>
        {TRIGGER_GROUPS.map(group => (
          <div key={group.title} className="vz-mi-section">
            <div className="vz-mi-section-title">{group.title}</div>
            <div className="vz-mi-trigger-grid">
              {group.labels.map(label => {
                const row = rows.current.find(candidate => candidate.label === label)!
                return (
                  <div key={label} className="vz-mi-trigger-row">
                    <span className="vz-mi-trigger-row-label">{label}</span>
                    <span ref={el => { row.dotEl = el }} className="vz-mi-trigger-dot" />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </Collapsible>
    </div>
  )
}
