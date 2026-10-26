import type { ReactNode } from 'react'
import { FloatingWorkspaceFrame } from '../../../layout/FloatingWorkspace'
import { LayoutLabLyricManagerWindows } from '../LayoutLabLyricManagerWindows'
import { LayoutLabReactTrackMap } from '../LayoutLabReactTrackMap'
import { LayoutLabSettingsWindow } from '../LayoutLabSettingsWindow'
import { LayoutLabPopupsWindow } from '../LayoutLabPopupsWindow'
import { OptionBHeader, OptionBNav, OptionBStage } from './OptionBChrome'
import { OptionBLeft } from './OptionBLeft'
import { OptionBInspector } from './OptionBInspector'
import { OptionBDock } from './OptionBDock'
import './optionB.css'
import './optionBAdapted.css'

/** Dedicated composition. The selector is supplied verbatim by Layout Lab. */
export function OptionBWorkspace({ active, switcher }: { active: boolean; switcher: ReactNode }) {
  return <FloatingWorkspaceFrame className="az-root ll-design-workbench ob-root" data-app-workspace="react" data-lab-design="design-02" data-ui-theme="midnight" data-ui-typography="midnight" hidden={!active}>
    <div className="ob-app"><OptionBNav>{switcher}</OptionBNav><div className="ob-main"><OptionBHeader />
      <div className="ob-body"><aside className="ob-panel ob-panel--left" aria-label="Layout Lab left window"><OptionBLeft /></aside>
        <main className="ob-center ob-scroll"><OptionBStage /><div className="ob-rack ob-adapted"><LayoutLabLyricManagerWindows /><LayoutLabReactTrackMap /><LayoutLabSettingsWindow idPrefix="ll-vsm-design-02" /><LayoutLabPopupsWindow /></div></main>
        <aside className="ob-panel ob-panel--right" aria-label="Layout Lab right window"><OptionBInspector /></aside>
      </div><OptionBDock />
    </div></div>
  </FloatingWorkspaceFrame>
}
