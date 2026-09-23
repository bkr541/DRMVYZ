import { useState } from 'react'
import type { CSSProperties } from 'react'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { Collapsible } from '../ReactControlRows'
import { Cinema2StillPreview } from './Cinema2StillPreview'
import type { Cinema2MockState } from './useCinema2MockState'

// ── Cinema2RightRailMockup ──────────────────────────────────────────────────
//
// Right rail, Cinema 2.0 engine. PRESETS: a dummy concept-preset record per
// reference image supplied for review (see cinema2ConceptSamples.ts) — click
// one to load its 10 stills into the left rail. DESIGN: the four production
// parent-group shells (Master Controls/Design/Effects/Palette), left
// deliberately empty until specific stills are approved and parameters get
// assigned to each group.

const RIGHT_TABS: RailTabOption<'presets' | 'design'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
]

const DESIGN_PARENT_GROUP_LABELS = ['Master Controls', 'Design', 'Effects', 'Palette']

export function Cinema2RightRailMockup({ state }: { state: Cinema2MockState }) {
  const [tab, setTab] = useState<'presets' | 'design'>('presets')

  return (
    <>
      <RailTabs tabs={RIGHT_TABS} activeTab={tab} onChange={setTab} ariaLabel="Cinema 2.0 inspector tabs (mockup)" />
      <div className="vz-panel-body">
        {tab === 'presets' ? (
          <div className="rv-inspector rv-inspector-scroll">
            <div className="llpc-filmstrip-list" role="list" aria-label="Cinema 2.0 concept presets (mockup)">
              {state.presets.map(preset => {
                const active = state.selectedPreset?.id === preset.id
                return (
                  <button
                    type="button"
                    key={preset.id}
                    className={`llpc-filmstrip-card${active ? ' is-active' : ''}`}
                    onClick={() => state.selectPreset(preset.id)}
                    title={preset.blurb}
                  >
                    <span className="llpc-filmstrip-thumb ll-c2-preset-thumb" style={{ '--llpc-tone': '#4ac7db' } as CSSProperties} aria-hidden="true">
                      <Cinema2StillPreview still={preset.stills[Math.floor(preset.stills.length / 2)]!} uid={`llpc-${preset.id}`} />
                    </span>
                    <span className="llpc-filmstrip-body">
                      <span className="llpc-filmstrip-name">{preset.name}</span>
                      <span className="llpc-filmstrip-meta">
                        <span className="ll-c2-preset-blurb">{preset.blurb}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rv-inspector rv-inspector-scroll">
            <div className="rv-ctrl-group" data-cinema2-design-parent-groups="master-controls design effects palette">
              {DESIGN_PARENT_GROUP_LABELS.map(label => (
                <Collapsible key={label} label={label}>
                  <div className="rv-ctrl-info">No controls yet.</div>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
