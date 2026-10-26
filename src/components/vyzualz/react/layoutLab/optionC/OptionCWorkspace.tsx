import { useRef, useState, type ReactNode } from 'react'
import { ContextMenuPresentationContext } from '../../../context-menu/ContextActionMenu'
import { FloatingWorkspaceFrame } from '../../../layout/FloatingWorkspace'
import { LayoutLabLyricManagerWindows } from '../LayoutLabLyricManagerWindows'
import { LayoutLabReactTrackMap } from '../LayoutLabReactTrackMap'
import { LayoutLabSettingsWindow } from '../LayoutLabSettingsWindow'
import { LayoutLabPopupsWindow } from '../LayoutLabPopupsWindow'
import { OptionCHeader, OptionCNav, OptionCStage } from './OptionCChrome'
import { OptionCLeft } from './OptionCLeft'
import { OptionCInspector } from './OptionCInspector'
import { OptionCDock } from './OptionCDock'
import { OcTabs } from './ocControls'
import './optionC.css'
import './optionCFeatures.css'

/** C owns its composition; behavior-owning editors keep their contracts in a C-only adapter. */
export function OptionCWorkspace({ active, switcher }: { active: boolean; switcher: ReactNode }) {
  const ownerRef = useRef<HTMLDivElement>(null)
  const [desk, setDesk] = useState<'sequence' | 'map' | 'settings' | 'dialogs'>('sequence')
  return <ContextMenuPresentationContext.Provider value={{ theme: 'graphite', typography: 'graphite', ownerRef }}><FloatingWorkspaceFrame className="az-root ll-design-workbench oc-root" data-app-workspace="react" data-lab-design="design-03" data-ui-theme="graphite" data-ui-typography="graphite" hidden={!active}>
    <div className="oc-app" ref={ownerRef}><OptionCHeader /><div className="oc-shell"><OptionCNav>{switcher}</OptionCNav>
      <div className="oc-workspace"><div className="oc-work-area">
        <aside className="oc-library oc-surface" aria-label="Layout Lab left window"><OptionCLeft /></aside>
        <main className="oc-center oc-scroll"><OptionCStage /><section className="oc-editing oc-surface" aria-label="Editing workspace">
          <header className="oc-editing-head"><OcTabs value={desk} onChange={setDesk} label="Editing workspace" options={[{ id: 'sequence', label: 'Sequence', icon: 'timeline' }, { id: 'map', label: 'Track Map', icon: 'grid' }, { id: 'settings', label: 'Settings', icon: 'settings' }, { id: 'dialogs', label: 'Dialogs', icon: 'info' }]} /><span className="oc-caption">LOCAL SESSION</span></header>
          <div className="oc-feature oc-sequence" hidden={desk !== 'sequence'}><LayoutLabLyricManagerWindows /></div>
          <div className="oc-feature" hidden={desk !== 'map'}><LayoutLabReactTrackMap /></div>
          <div className="oc-feature" hidden={desk !== 'settings'}><LayoutLabSettingsWindow idPrefix="ll-vsm-design-03" /></div>
          <div className="oc-feature" hidden={desk !== 'dialogs'}><LayoutLabPopupsWindow /></div>
        </section></main>
        <aside className="oc-inspector oc-surface" aria-label="Layout Lab right window"><OptionCInspector /></aside>
      </div><OptionCDock /></div>
    </div></div>
  </FloatingWorkspaceFrame></ContextMenuPresentationContext.Provider>
}
