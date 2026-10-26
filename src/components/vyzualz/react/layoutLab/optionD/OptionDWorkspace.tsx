import { useRef, useState, type ReactNode } from 'react'
import { ContextMenuPresentationContext } from '../../../context-menu/ContextActionMenu'
import { FloatingWorkspaceFrame } from '../../../layout/FloatingWorkspace'
import { LayoutLabLyricManagerWindows } from '../LayoutLabLyricManagerWindows'
import { LayoutLabReactTrackMap } from '../LayoutLabReactTrackMap'
import { LayoutLabSettingsWindow } from '../LayoutLabSettingsWindow'
import { LayoutLabPopupsWindow } from '../LayoutLabPopupsWindow'
import { OptionDHeader, OptionDNav, OptionDStage } from './OptionDChrome'
import { OptionDLeft } from './OptionDLeft'
import { OptionDInspector } from './OptionDInspector'
import { OptionDDock } from './OptionDDock'
import { OdSegmented } from './odControls'
import './optionD.css'
import './optionDFeatures.css'

type Desk = 'sequence' | 'map' | 'settings' | 'dialogs'

/** D owns its composition: floating capsules, a persistent stage over a tabbed editing tile, tile columns either side. */
export function OptionDWorkspace({ active, switcher }: { active: boolean; switcher: ReactNode }) {
  const ownerRef = useRef<HTMLDivElement>(null)
  const [desk, setDesk] = useState<Desk>('sequence')
  return <ContextMenuPresentationContext.Provider value={{ theme: 'tile', typography: 'tile', ownerRef }}>
    <FloatingWorkspaceFrame className="az-root ll-design-workbench od-root" data-app-workspace="react" data-lab-design="design-04" data-ui-theme="tile" data-ui-typography="tile" hidden={!active}>
      <div className="od-app" ref={ownerRef}>
        <OptionDHeader />
        <OptionDNav>{switcher}</OptionDNav>
        <aside className="od-column od-column--left" aria-label="Layout Lab left window"><OptionDLeft /></aside>
        <main className="od-center">
          <OptionDStage />
          <section className="od-editing" aria-label="Editing workspace">
            <OdSegmented className="od-seg--desk" label="Editing workspace" value={desk} onChange={setDesk} options={[{ id: 'sequence', label: 'Sequence', icon: 'timeline' }, { id: 'map', label: 'Track Map', icon: 'grid' }, { id: 'settings', label: 'Settings', icon: 'settings' }, { id: 'dialogs', label: 'Dialogs', icon: 'info' }]} />
            <div className="od-editing-body od-scroll">
              <div className="od-feature od-sequence" hidden={desk !== 'sequence'}><LayoutLabLyricManagerWindows /></div>
              <div className="od-feature" hidden={desk !== 'map'}><LayoutLabReactTrackMap /></div>
              <div className="od-feature" hidden={desk !== 'settings'}><LayoutLabSettingsWindow idPrefix="ll-vsm-design-04" /></div>
              <div className="od-feature" hidden={desk !== 'dialogs'}><LayoutLabPopupsWindow /></div>
            </div>
          </section>
        </main>
        <aside className="od-column od-column--right" aria-label="Layout Lab right window"><OptionDInspector /></aside>
        <OptionDDock />
      </div>
    </FloatingWorkspaceFrame>
  </ContextMenuPresentationContext.Provider>
}
