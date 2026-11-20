import { useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { HeaderControlGroup } from '../../layout/HeaderControlGroup'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import { HeaderActionIcon } from '../../layout/HeaderActionIcon'
import { SaveGlyph } from '../../layout/HeaderGlyphs'
import { REACT_ENGINE_CATALOG } from '../reactEngineCatalog'
import appearance from '../../../../styles/appearance.css?inline'
import modalStyles from '../../../../styles/mediaUploadModal.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import headerStyles from '../../layout/HeaderControlGroup.css?inline'
import { PixGridDeckPopover } from './PixGridDeckPopover'
import type { DeckStudyScenario } from './pixGridDeckStudyModel'
import styles from './pixGridDeckStudies.css?inline'

const SCENARIOS: ReadonlyArray<{ id: DeckStudyScenario; label: string; description: string }> = [
  { id: 'new', label: 'New Deck', description: 'Empty: name it, then upload images.' },
  { id: 'editing', label: 'Editing a Deck', description: 'Five images, one with its own duration and one switched off; compiles to Ready.' },
  { id: 'compiling', label: 'Compiling', description: 'Frames and transitions still being prepared: Create Preset stays disabled.' },
  { id: 'error', label: 'Compile error', description: 'An image failed to decode: the readiness card shows the error.' },
]

/**
 * Study for moving the PixGrid create-deck workflow into one popover opened from the Preset Manager toolbar's PixGrid key.
 * The popover reuses the application's dialog surface (the Media Upload modal shell and the shared dialog controls); every setting the
 * current builder has appears on one of its five screens. All data and actions are local to the Lab.
 */
export function PixGridDeckStudies() {
  const [open, setOpen] = useState<DeckStudyScenario | null>(null)
  const [scenario, setScenario] = useState<DeckStudyScenario>('editing')
  const [development, setDevelopment] = useState(true)
  const [session, setSession] = useState(0)
  const launch = (next: DeckStudyScenario) => { setScenario(next); setSession(value => value + 1); setOpen(next) }
  const tokens = { '--ll-deck-accent': '#67f7ff' } as CSSProperties
  return (
    <div className="ll-deck-studies" style={tokens} data-theme="dark" aria-label="PixGrid Deck popover studies">
      <style>{appearance.replaceAll(':root', ':scope') + modalStyles + dropdownStyles + headerStyles + styles}</style>
      <section className="ll-deck-lab">
        <h2>PixGrid Deck popover</h2>
        <p>The Create PixGrid Deck key in Preset Manager's toolbar would open this popover instead of swapping the library and inspector windows. Open it in each state:</p>
        <div className="ll-deck-toolbar-mock" aria-label="Preset Manager toolbar">
          <span className="ll-deck-toolbar-label">Preset Manager toolbar</span>
          <HeaderControlGroup label="Preset Manager controls">
            <HeaderIconKey label="Create preset" icon={<HeaderActionIcon action="create" />} onClick={() => undefined} />
            <HeaderIconKey label="Create PixGrid Deck" icon={<AppIcon kind={REACT_ENGINE_CATALOG.pixGrid.icon} size={16} color="currentColor" aria-hidden="true" />} pressed={open !== null} onClick={() => launch('new')} />
            <HeaderIconKey label="Save preset" icon={<SaveGlyph />} onClick={() => undefined} />
            <HeaderIconKey label="Duplicate preset" icon={<HeaderActionIcon action="duplicate" />} onClick={() => undefined} />
            <HeaderIconKey label="Delete preset" icon={<HeaderActionIcon action="delete" />} danger onClick={() => undefined} />
          </HeaderControlGroup>
        </div>
        <div className="ll-deck-scenarios" role="group" aria-label="Popover states">
          {SCENARIOS.map(candidate => (
            <button key={candidate.id} type="button" className="ll-deck-scenario" data-scenario={candidate.id} aria-pressed={scenario === candidate.id && open !== null} onClick={() => launch(candidate.id)}>
              <strong>{candidate.label}</strong><span>{candidate.description}</span>
            </button>
          ))}
        </div>
        <label className="ll-deck-dev"><input type="checkbox" checked={development} onChange={event => setDevelopment(event.target.checked)} /> Show the development-only shipping action on the Review screen</label>
      </section>
      {open !== null && <PixGridDeckPopover key={session} scenario={open} development={development} onClose={() => setOpen(null)} />}
    </div>
  )
}
