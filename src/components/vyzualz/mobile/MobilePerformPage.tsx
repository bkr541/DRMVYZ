import { useCallback, useState } from 'react'
import { ReactEngineBrowser } from '../react/ReactEngineBrowser'
import { Cinema2PresetsPanel } from '../react/Cinema2PresetsPanel'
import { Cinema2InspectorPanel } from '../react/Cinema2InspectorPanel'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { PanelSubtabs } from '../react/PanelSubtabs'
import { useActiveEnginePresetName } from '../react/activeEnginePresetName'
import { writeCinema2LastPresetId } from '../react/cinema2WorkspacePreferences'
import { requestTextSceneNavigation } from '../../../features/cinema2Text/textSceneNavigation'
import { useReactStore } from '../../../stores/reactStore'
import type { Cinema2PresetId, Cinema2Runtime } from '../cinema2'
import { MOBILE_DISABLED_ENGINES, MOBILE_ENGINE_ID } from './mobilePages'

type PerformTab = 'Presets' | 'Controls'
type ControlsSurface = 'design' | 'react'

/**
 * Perform: the production engine dropdown (Cinema 2.0 only on mobile), the real SYSTEM / USER preset browser, and the real Cinema 2.0
 * inspector for whatever preset is loaded. Choosing a preset activates it in the shared store, which is what the Visualizer shows.
 */
export function MobilePerformPage({ presetId, runtime }: { presetId: Cinema2PresetId | null; runtime: Cinema2Runtime | null }) {
  const [tab, setTab] = useState<PerformTab>('Presets')
  const [surface, setSurface] = useState<ControlsSurface>('design')
  const activateCinema2Workspace = useReactStore(state => state.activateCinema2Workspace)
  const presetName = useActiveEnginePresetName(MOBILE_ENGINE_ID, presetId)
  const select = useCallback((id: Cinema2PresetId) => {
    requestTextSceneNavigation(() => {
      const result = activateCinema2Workspace({ presetId: id })
      if (result.ok) writeCinema2LastPresetId(id)
    })
  }, [activateCinema2Workspace])

  return <div className="mpm-panel-content mpm-perform">
    <ReactEngineBrowser engineId={MOBILE_ENGINE_ID} onEngineChange={() => {}} presetName={presetName} boundarySelector=".mobile-app"
      disabledEngines={MOBILE_DISABLED_ENGINES} disabledReason="Not available on mobile yet" />
    <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Presets', label: 'Presets' }, { id: 'Controls', label: 'Controls' }]}
      activeTab={tab} onChange={id => setTab(id as PerformTab)} ariaLabel="Perform sections" />
    {tab === 'Presets' && <Cinema2PresetsPanel activePresetId={presetId ?? ('' as Cinema2PresetId)} onSelectPreset={select} />}
    {tab === 'Controls' && <>
      <PanelSubtabs value={surface} onChange={setSurface} ariaLabel="Control surface" options={[{ id: 'design', label: 'DESIGN' }, { id: 'react', label: 'REACT' }]} />
      <div className="mpm-scroll mpm-controls" data-mpm-scroll="controls">
        {runtime
          ? <Cinema2InspectorPanel runtime={runtime} surface={surface} />
          : <div className="rv-ctrl-info mobile-empty-note" role="status">{presetId ? 'Loading the preset…' : 'Select a preset to edit its controls.'}</div>}
      </div>
    </>}
  </div>
}
