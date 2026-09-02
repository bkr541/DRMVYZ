import { useState } from 'react'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { IconChipButton } from './controls/IconChipButton'
import { IconMorphToggle } from './controls/IconMorphToggle'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'

// ── LyricManagerLayoutMockup ───────────────────────────────────────────────
//
// A disconnected preview: the Lyric Manager header on top, then an empty
// three-pane body whose sizing and padding are borrowed from the Media
// Manager shell (`mmv-*` / `vz-content` classes), not from the production
// Lyric Manager layout. No production stores, services, renderers, or lyric
// feature modules are mounted — only shared presentational controls.

export function LyricManagerLayoutMockup() {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  return (
    <main className="mmv-root" aria-label="Lyric Manager layout mockup">
      {/* Same header the Lyric Manager UI carries: title + supporting text
          left-justified; Show Lyrics toggle, Save, Save + Make Active, the
          Settings icon and the profile avatar right-justified. */}
      <header className="lmv-header">
        <div className="lmv-header-left">
          <div className="lmv-header-title-group">
            <span className="lmv-header-title">LYRIC MANAGER</span>
            <span className="lmv-header-subtitle">
              Select or upload a track, then manage its lyric versions
            </span>
          </div>
        </div>

        <div className="lmv-header-right">
          <label className="lmv-toggle-row" title="Show or hide active lyrics in the visualizer">
            <span className="lmv-toggle-label">Show Lyrics</span>
            <IconMorphToggle
              checked={false}
              onCheckedChange={() => {}}
              className="lmv-toggle-track"
              aria-label="Show Lyrics"
            />
          </label>

          <IconChipButton onClick={() => {}} disabled title="Save lyric document">
            Save
          </IconChipButton>

          <IconChipButton
            tone="primary"
            onClick={() => {}}
            disabled
            title="Save this version and make it the active runtime version"
          >
            Save + Make Active
          </IconChipButton>

          <VyzualzHeaderActions />
        </div>
      </header>

      <section className="mmv-workspace" aria-label="Lyric Manager layout workspace">
        <div
          className="vz-content mmv-content"
          data-left-collapsed={leftCollapsed ? 'true' : 'false'}
          data-right-collapsed={rightCollapsed ? 'true' : 'false'}
        >
          <WorkspaceRail
            side="left"
            label="Lyric Manager layout — left rail"
            collapsed={leftCollapsed}
            onToggleCollapsed={() => setLeftCollapsed(value => !value)}
          >
            {null}
          </WorkspaceRail>

          <div className="mmv-stage-area" aria-label="Lyric Manager layout — visualizer" />

          <WorkspaceRail
            side="right"
            label="Lyric Manager layout — right rail"
            collapsed={rightCollapsed}
            onToggleCollapsed={() => setRightCollapsed(value => !value)}
          >
            {null}
          </WorkspaceRail>
        </div>
      </section>
    </main>
  )
}
