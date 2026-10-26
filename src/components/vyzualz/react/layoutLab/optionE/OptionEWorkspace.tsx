import { useRef, useState, type ReactNode } from 'react'
import { FloatingWorkspaceFrame } from '../../../layout/FloatingWorkspace'
import { ContextMenuPresentationContext } from '../../../context-menu/ContextActionMenu'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { LayoutLabElectricStormLeftWindow } from '../LayoutLabElectricStormLeftWindow'
import { LayoutLabMarqueeRightWindow } from '../LayoutLabMarqueeRightWindow'
import { LayoutLabLyricManagerWindows } from '../LayoutLabLyricManagerWindows'
import { LayoutLabReactTrackMap } from '../LayoutLabReactTrackMap'
import { LayoutLabSettingsWindow } from '../LayoutLabSettingsWindow'
import { LayoutLabPopupsWindow } from '../LayoutLabPopupsWindow'
import { LayoutLabReactAudioDock } from '../LayoutLabReactAudioDock'
import { OptionEHeader, OptionENavigation, OptionEStage } from './OptionEChrome'
import './optionE.css'

/**
 * Option E's editorial production desk. Only fixture behavior is reused: the media
 * library, inspector, cue editor, timeline map, dialogs and deck keep their own
 * React state. Their surfaces are laid out in a new E-only composition instead
 * of cloning the production three-rail frame or modifying shared JSX.
 */
type EditingSurface = 'sequence' | 'map' | 'settings' | 'dialogs'
const EDITING: { id: EditingSurface; label: string; icon: 'timeline' | 'grid' | 'settings' | 'info' }[] = [
  { id: 'sequence', label: 'Sequence', icon: 'timeline' },
  { id: 'map', label: 'Track map', icon: 'grid' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'dialogs', label: 'Dialogs', icon: 'info' },
]

export function OptionEWorkspace({ active, switcher }: { active: boolean; switcher: ReactNode }) {
  const [surface, setSurface] = useState<EditingSurface>('sequence')
  const [editorExpanded, setEditorExpanded] = useState(true)
  const ownerRef = useRef<HTMLDivElement>(null)
  return (
    <ContextMenuPresentationContext.Provider value={{ theme: 'editorial', typography: 'editorial', ownerRef }}>
      <FloatingWorkspaceFrame className="az-root ll-design-workbench oe-root rv-shell" data-app-workspace="react" data-lab-design="design-05" hidden={!active}>
        <div className="oe-app" ref={ownerRef}>
          <OptionEHeader />
          <OptionENavigation>{switcher}</OptionENavigation>
          <aside className="oe-library oe-panel" aria-label="Layout Lab left window">
            <header className="oe-panel-heading"><span className="oe-kicker">01 / ASSETS</span><strong>Workspace</strong><span className="oe-panel-count">Cinema 2.0</span></header>
            <div className="oe-library-inner"><LayoutLabElectricStormLeftWindow appearance="midnight" /></div>
            <footer className="oe-panel-footer"><span className="oe-led" />SOURCE CONNECTED <span>24 FILES</span></footer>
          </aside>
          <main className="oe-main rv-center-col" aria-label="Option E creative workspace">
            <OptionEStage />
            <section className="oe-editor" data-expanded={editorExpanded} aria-label="Editing workspace">
              <header className="oe-editor-head">
                <div className="oe-edit-label"><span className="oe-kicker">02 / EDIT</span><strong>Sequence</strong></div>
                <div className="oe-edit-tabs" role="tablist" aria-label="Editing workspace">
                  {EDITING.map(item => <button key={item.id} type="button" role="tab" aria-selected={surface === item.id} onClick={() => { setSurface(item.id); setEditorExpanded(true) }}>
                    <AppIcon kind={item.icon} size={13} /><span>{item.label}</span>
                  </button>)}
                </div>
                <button type="button" className="oe-icon-button oe-editor-expand" aria-label={editorExpanded ? 'Collapse editor' : 'Expand editor'} aria-expanded={editorExpanded} onClick={() => setEditorExpanded(value => !value)}><AppIcon kind={editorExpanded ? 'chevronDown' : 'chevronUp'} size={16} /></button>
              </header>
              <div className="oe-editor-body" hidden={!editorExpanded}>
                <div className="oe-editor-feature oe-editor-feature--sequence" hidden={surface !== 'sequence'}><LayoutLabLyricManagerWindows /></div>
                <div className="oe-editor-feature" hidden={surface !== 'map'}><LayoutLabReactTrackMap /></div>
                <div className="oe-editor-feature" hidden={surface !== 'settings'}><LayoutLabSettingsWindow idPrefix="ll-vsm-design-05" /></div>
                <div className="oe-editor-feature" hidden={surface !== 'dialogs'}><LayoutLabPopupsWindow /></div>
              </div>
            </section>
          </main>
          <aside className="oe-inspector oe-panel" aria-label="Layout Lab right window">
            <header className="oe-panel-heading"><span className="oe-kicker">03 / PROPERTIES</span><strong>Inspector</strong><span className="oe-panel-count">MARQUEE</span></header>
            <div className="oe-inspector-inner"><LayoutLabMarqueeRightWindow appearance="midnight" /></div>
            <footer className="oe-panel-footer"><span className="oe-led" />LOCAL PREVIEW <span>ENGINE READY</span></footer>
          </aside>
          <section className="oe-deck" aria-label="Audio transport"><div className="oe-deck-head"><span className="oe-kicker">04 / TRANSPORT</span><strong>Audio deck</strong><span className="oe-deck-note"><span className="oe-led" /> REKORDBOX / LOCAL</span></div><LayoutLabReactAudioDock /></section>
        </div>
      </FloatingWorkspaceFrame>
    </ContextMenuPresentationContext.Provider>
  )
}
