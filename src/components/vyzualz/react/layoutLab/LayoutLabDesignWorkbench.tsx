import { useState, type ReactNode } from 'react'
import { FloatingWorkspaceFrame, WorkspaceRegion, WorkspaceSurface } from '../../layout/FloatingWorkspace'
import { WorkspaceRail } from '../../layout/WorkspaceRail'
import { IconChipButton } from '../controls/IconChipButton'
import { LAYOUT_LAB_DESIGNS, type LayoutLabDesignId } from './layoutLabDesignCatalog'
import { LayoutLabElectricStormLeftWindow } from './LayoutLabElectricStormLeftWindow'
import { LayoutLabMarqueeRightWindow } from './LayoutLabMarqueeRightWindow'
import { LayoutLabReactAudioDock } from './LayoutLabReactAudioDock'
import { LayoutLabReactHeader } from './LayoutLabReactHeader'
import { LayoutLabReactNav } from './LayoutLabReactNav'
import { LayoutLabLyricManagerWindows } from './LayoutLabLyricManagerWindows'
import { LayoutLabReactTrackMap } from './LayoutLabReactTrackMap'
import { LayoutLabPopupsWindow } from './LayoutLabPopupsWindow'
import { LayoutLabSettingsWindow } from './LayoutLabSettingsWindow'
import { TemplateAudioDockMockup } from './TemplateAudioDockMockup'
import './layoutLabDesignWorkbench.css'

interface DesignWindows {
  header: ReactNode
  /** Receives the A–E design switcher so the design can place it among its own navigation. */
  nav: (switcher: ReactNode) => ReactNode
  left: ReactNode
  right: ReactNode
  /** Rendered under the visualizer in the center column (React's Track Map workspace). */
  lower?: ReactNode
  dock: ReactNode
}

/**
 * Every design is a full copy of design A's mockup (header, navigation, Electric Storm left window, MARQUEE right window,
 * the Lyric Manager windows, Track Map, Settings and Pop-ups groups, and the audio dock), each with its own state. The
 * header names the design at its top left ("Option A" … "Option E").
 */
function buildDesignWindows({ id, letter }: { id: LayoutLabDesignId; letter: string }): DesignWindows {
  return {
    header: <LayoutLabReactHeader optionLabel={`Option ${letter}`} />,
    nav: switcher => <LayoutLabReactNav>{switcher}</LayoutLabReactNav>,
    left: <LayoutLabElectricStormLeftWindow />,
    right: <LayoutLabMarqueeRightWindow />,
    lower: <><LayoutLabLyricManagerWindows /><LayoutLabReactTrackMap /><LayoutLabSettingsWindow idPrefix={`ll-vsm-${id}`} /><LayoutLabPopupsWindow /></>,
    dock: <LayoutLabReactAudioDock />,
  }
}

/**
 * Five independent blank canvases (A–E) with the same geometry as React View: a blank header group across the top, a
 * blank navigation column on the far left, then an empty left window, an empty visualizer, an empty right window and
 * the bottom audio dock. Each is built from the same frame, shell, grid, surface and rail markup and classes as
 * production (ApplicationWorkspaceFrame → VyzualzView → ReactView), so every size and surface treatment comes from
 * the same CSS rather than a copy of it.
 *
 * Only the selected design is shown. A design is mounted the first time it is selected and then stays mounted and hidden,
 * so each keeps its own state and an unvisited design costs nothing. A design is themed through
 * `[data-lab-design='design-0N']` in layoutLabDesignWorkbench.css. A design fills its header group, navigation column,
 * left and right windows, the workspace under the visualizer and the dock by supplying `windows`; all five currently
 * supply the same mockup of React View (see buildDesignWindows).
 */
export function LayoutLabDesignWorkbench() {
  const [design, setDesign] = useState<LayoutLabDesignId>('design-01')
  const [visited, setVisited] = useState<ReadonlySet<LayoutLabDesignId>>(() => new Set(['design-01']))
  const select = (next: LayoutLabDesignId) => {
    setVisited(current => (current.has(next) ? current : new Set(current).add(next)))
    setDesign(next)
  }

  return (
    <>
      {LAYOUT_LAB_DESIGNS.map(option => visited.has(option.id) && (
        <LayoutLabDesignView
          key={option.id}
          id={option.id}
          active={design === option.id}
          selected={design}
          onSelect={select}
          windows={buildDesignWindows(option)}
        />
      ))}
    </>
  )
}

function LayoutLabDesignView({ id, active, selected, onSelect, windows }: {
  id: LayoutLabDesignId
  active: boolean
  selected: LayoutLabDesignId
  onSelect: (design: LayoutLabDesignId) => void
  windows?: DesignWindows
}) {
  const switcher = (
    <div className="ll-design-switcher" role="group" aria-label="Layout Lab design">
      {LAYOUT_LAB_DESIGNS.map(option => (
        <IconChipButton
          key={option.id}
          tone={selected === option.id ? 'primary' : 'default'}
          className="ll-design-switch"
          aria-label={`Design ${option.letter}`}
          aria-pressed={selected === option.id}
          onClick={() => onSelect(option.id)}
        >
          {option.letter}
        </IconChipButton>
      ))}
    </div>
  )

  return (
    <FloatingWorkspaceFrame
      className="az-root fw-app-frame ll-design-workbench"
      data-app-workspace="react"
      data-lab-design={id}
      hidden={!active}
    >
      <div className="az-shell fw-app-shell">
        <WorkspaceRegion slot="header" className="fw-app-header">
          <WorkspaceSurface className="fw-app-header-surface" aria-label="Layout Lab header group">
            <div className="fw-app-header-inner">{windows?.header}</div>
          </WorkspaceSurface>
        </WorkspaceRegion>
        <div className="fw-app-body">
          <WorkspaceRegion slot="navigation" className="fw-app-navigation">
            <aside className="az-sidebar az-sidebar--collapsed az-sidebar--floating" aria-label="Layout Lab navigation column">
              {windows?.nav ? windows.nav(switcher) : switcher}
            </aside>
          </WorkspaceRegion>
          <WorkspaceRegion slot="stage" className="fw-app-content">
            <main className="vz-main" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="rv-shell rv-shell--floating">
                  <div className="rv-layout">
                    <WorkspaceRail side="left" label="Layout Lab left window" className="rw-frame--left">
                      {windows?.left ?? <div className="vz-panel-body" />}
                    </WorkspaceRail>

                    <div className="rv-center-col">
                      <div className="rv-canvas-wrap" role="region" aria-label="Layout Lab visualizer" />
                      {windows?.lower}
                    </div>

                    <WorkspaceRail side="right" label="Layout Lab right window" className="rw-frame--right">
                      {windows?.right ?? <div className="vz-panel-body" />}
                    </WorkspaceRail>
                  </div>

                  {windows?.dock ?? <TemplateAudioDockMockup />}
                </div>
              </div>
            </main>
          </WorkspaceRegion>
        </div>
      </div>
    </FloatingWorkspaceFrame>
  )
}
