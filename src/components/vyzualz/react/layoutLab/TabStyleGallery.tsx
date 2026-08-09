import { useState } from 'react'

// ── TabStyleGallery ──────────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. A tab-strip treatment shown here so
// restyling the app's real tab strips (RailTabs' PRESETS/DESIGN/REACT/
// OUTPUT, PanelSubtabs, etc.) can be judged against a real alternative
// instead of the current bordered-pill-button baseline. Fully local,
// disconnected — owns its own active-tab state — styled in the app's
// existing cyan/dark palette, using the same sample labels as the real
// right-rail tab strip for a direct comparison.

const SAMPLE_TABS = ['Presets', 'Design', 'React', 'Output']
const SAMPLE_NESTED_TABS = ['Routing', 'Analysis']

// 1 — Underline tabs: borderless, a cyan underline grows in under the active
// tab. When React is selected, the secondary nested tab strip that lives
// under the real React tab (ROUTING / ANALYSIS, marker + pipe divider) shows
// beneath it, matching how the two levels actually stack in production.
function UnderlineTabs() {
  const [active, setActive] = useState(SAMPLE_TABS[1])
  const [activeNested, setActiveNested] = useState(SAMPLE_NESTED_TABS[0])
  return (
    <div className="lltb-underline-demo">
      <div className="lltb-underline" role="tablist" aria-label="Underline tabs">
        {SAMPLE_TABS.map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === active}
            className={`lltb-underline-tab${tab === active ? ' is-active' : ''}`}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {active === 'React' && (
        <div className="lltb-nested" role="tablist" aria-label="React nested tabs">
          {SAMPLE_NESTED_TABS.map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === activeNested}
              className={`lltb-nested-tab${tab === activeNested ? ' is-active' : ''}`}
              onClick={() => setActiveNested(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'underline', title: '01 · Underline Tabs', blurb: 'Borderless labels — a cyan underline grows in under the active tab.', Tabs: UnderlineTabs },
]

export function TabStyleGallery() {
  return (
    <div className="lltb-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Tabs />
          </div>
        </div>
      ))}
    </div>
  )
}
