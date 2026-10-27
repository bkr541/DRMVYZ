import { useRef, useState, type ReactNode } from 'react'
import { ContextMenuPresentationContext } from '../../../context-menu/ContextActionMenu'
import { FloatingWorkspaceFrame } from '../../../layout/FloatingWorkspace'
import { LayoutLabLyricManagerWindows } from '../LayoutLabLyricManagerWindows'
import { LayoutLabReactTrackMap } from '../LayoutLabReactTrackMap'
import { LayoutLabSettingsWindow } from '../LayoutLabSettingsWindow'
import { LayoutLabPopupsWindow } from '../LayoutLabPopupsWindow'
import { OptionFHeader, OptionFNav, OptionFStage } from './OptionFChrome'
import { OptionFLeft } from './OptionFLeft'
import { OptionFInspector } from './OptionFInspector'
import { OptionFDock } from './OptionFDock'
import { OfSegmented } from './ofControls'
import './optionF.css'
import './optionFFeatures.css'

type Desk = 'sequence' | 'map' | 'settings' | 'dialogs'

/** F owns its composition: one hairline-divided console frame with a rail, two panels either side of a persistent stage over a tabbed editing workspace, and a transport deck. */
export function OptionFWorkspace({ active, switcher }: { active: boolean; switcher: ReactNode }) {
  const ownerRef = useRef<HTMLDivElement>(null)
  const [desk, setDesk] = useState<Desk>('sequence')
  return <ContextMenuPresentationContext.Provider value={{ theme: 'studio', typography: 'studio', ownerRef }}>
    <FloatingWorkspaceFrame className="az-root ll-design-workbench of-root" data-app-workspace="react" data-lab-design="design-06" data-ui-theme="studio" data-ui-typography="studio" hidden={!active}>
      <div className="of-app" ref={ownerRef}>
        <OptionFHeader />
        <OptionFNav>{switcher}</OptionFNav>
        <aside className="of-column of-column--left" aria-label="Layout Lab left window"><OptionFLeft /></aside>
        <main className="of-center">
          <OptionFStage />
          <section className="of-editing" aria-label="Editing workspace">
            <OfSegmented className="of-seg--desk" label="Editing workspace" value={desk} onChange={setDesk} options={[{ id: 'sequence', label: 'Sequence', icon: 'timeline' }, { id: 'map', label: 'Track Map', icon: 'grid' }, { id: 'settings', label: 'Settings', icon: 'settings' }, { id: 'dialogs', label: 'Dialogs', icon: 'info' }]} />
            <div className="of-editing-body of-scroll">
              <div className="of-feature of-sequence" hidden={desk !== 'sequence'}><LayoutLabLyricManagerWindows /></div>
              <div className="of-feature" hidden={desk !== 'map'}><LayoutLabReactTrackMap /></div>
              <div className="of-feature" hidden={desk !== 'settings'}><LayoutLabSettingsWindow idPrefix="ll-vsm-design-06" /></div>
              <div className="of-feature" hidden={desk !== 'dialogs'}><LayoutLabPopupsWindow /></div>
            </div>
          </section>
        </main>
        <aside className="of-column of-column--right" aria-label="Layout Lab right window"><OptionFInspector /></aside>
        <OptionFDock />
      </div>
    </FloatingWorkspaceFrame>
  </ContextMenuPresentationContext.Provider>
}
