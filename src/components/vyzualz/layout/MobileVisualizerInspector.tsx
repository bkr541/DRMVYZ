import { useMemo } from 'react'
import { Cinema2InspectorPanel } from '../react/Cinema2InspectorPanel'
import { createCinema2InspectorModel } from '../cinema2/parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../cinema2/parameters/Cinema2ParameterState'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import type { Cinema2PresetId } from '../cinema2/contracts/Cinema2NativePresetManifest'

const REACT_SAMPLE_PRESET_ID = 'drmvyz.cinema2.user-model-form' as Cinema2PresetId

/**
 * The Visualizer page's Design and React tabs: the production Cinema 2.0 inspector for the selected preset, fed by that preset's real compiled
 * parameters and a real parameter state, with no renderer behind it. A parameter edit changes only this local state. The surface is the
 * production panel's own, so the four Design parent groups (Master Controls, Design, Effects, Palette), their icons, nested groups, sliders,
 * toggles and palette rows are exactly what production shows.
 */
export function MobileVisualizerInspector({ presetId, surface }: { presetId: string; surface: 'design' | 'react' }) {
  const runtime = useMemo(() => {
    const build = (id: Cinema2PresetId) => {
      const compiled = cinema2NativePresetRegistry.compile(id)
      if (!compiled.ok) return null
      const state = new Cinema2ParameterState(compiled.plan.parameters)
      return { plan: compiled.plan, state }
    }
    let built = build(presetId as Cinema2PresetId)
    // Most presets declare nothing on the React surface (production shows an empty panel for them). So the mockup has something to show, it
    // borrows the 3D FORM preview's real React controls when the selected preset has none.
    if (surface === 'react' && built && createCinema2InspectorModel(built.plan, built.state.getSnapshot(), 'react').length === 0) {
      built = build(REACT_SAMPLE_PRESET_ID) ?? built
    }
    if (!built) return null
    const { plan, state } = built
    // Only what the inspector reads; actions have no scene to run on, so they are accepted and do nothing.
    return { getCompiledPresetPlan: () => plan, getParameterState: () => state, getTargetResolver: () => ({ dispatch: () => ({ ok: true }) }) } as unknown as Cinema2Runtime
  }, [presetId, surface])
  return <Cinema2InspectorPanel runtime={runtime} surface={surface} sharedAudioAnalysis={false} />
}
