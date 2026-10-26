import type { ReactNode } from 'react'
import { FloatingWorkspaceFrame } from '../../../layout/FloatingWorkspace'
import { LayoutLabLyricManagerWindows } from '../LayoutLabLyricManagerWindows'
import { LayoutLabPopupsWindow } from '../LayoutLabPopupsWindow'
import { LayoutLabReactTrackMap } from '../LayoutLabReactTrackMap'
import { LayoutLabSettingsWindow } from '../LayoutLabSettingsWindow'
import { OptionADock } from './OptionADock'
import { OptionAHeader } from './OptionAHeader'
import { OptionALeftModule } from './OptionALeftModule'
import { OptionANav } from './OptionANav'
import { OptionARightModule } from './OptionARightModule'
import { OptionAStage } from './OptionAStage'
import './optionA.css'
import './optionAWrapped.css'

// ── Option A · "Instrument Rack" workspace ─────────────────────────────────────────────────────────────────────
//
// Option A's own composition, not a restyle of React View's. A spine runs the full height of the window at the left;
// beside it the header strip sits above the working area only, so the brand and the navigation are no longer one
// band across the top. The working area is three modules of different weights (a 344px workspace module, the stage
// and its rack of windows, and a 380px inspector) over a 138px deck made of three instruments. The stage is the first
// item of a scrolling column whose windows (Track Timeline, Cue list, Track Map, Settings, Pop-ups) are the Lyric
// Manager's and React's own windows inside Option A's frame.
//
// The root keeps production's floating-workspace and `react` workspace attributes so the production windows mounted in
// the column resolve their own tokens, but none of production's shell, rail or dock layout classes are used.

export function OptionAWorkspace({ active, switcher }: { active: boolean; switcher: ReactNode }) {
  return (
    <FloatingWorkspaceFrame
      className="az-root ll-design-workbench oa-root"
      data-app-workspace="react"
      data-lab-design="design-01"
      hidden={!active}
    >
      <div className="oa-app">
        <OptionANav>{switcher}</OptionANav>
        <div className="oa-main">
          <OptionAHeader />
          <div className="oa-body">
            <aside className="oa-module oa-module--left vz-inspector vz-inspector--left" aria-label="Layout Lab left window">
              <OptionALeftModule />
            </aside>

            <div className="oa-center">
              <OptionAStage />
              <div className="oa-rack">
                <LayoutLabLyricManagerWindows />
                <LayoutLabReactTrackMap />
                <LayoutLabSettingsWindow idPrefix="ll-vsm-design-01" />
                <LayoutLabPopupsWindow />
              </div>
            </div>

            <aside className="oa-module oa-module--right vz-inspector vz-inspector--right" aria-label="Layout Lab right window">
              <OptionARightModule />
            </aside>
          </div>
          <OptionADock />
        </div>
      </div>
    </FloatingWorkspaceFrame>
  )
}
