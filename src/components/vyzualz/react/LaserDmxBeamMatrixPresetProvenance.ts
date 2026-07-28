import { resolveEnginePresetProvenance } from './ReactPresetProvenance'
import { getLaserDmxBeamMatrixPreset } from './laserDmxBeamMatrixPresets'
import type { LaserDmxBeamMatrixSettings } from './ReactTypes'

function comparableBeamMatrixSettings(settings: LaserDmxBeamMatrixSettings): unknown {
  return {
    beams: settings.beams,
    groups: settings.groups.map(({ muted: _muted, soloed: _soloed, ...group }) => group),
    globalModulationRoutes: settings.globalModulationRoutes,
    output: settings.output,
    fog: settings.fog,
    cues: settings.cues ?? [],
  }
}

/**
 * Beam Matrix provenance ignores editor selection and temporary mute/solo state,
 * but preserves the stable source preset ID after authored edits.
 */
export function resolveLaserDmxBeamMatrixPresetProvenance(
  settings: LaserDmxBeamMatrixSettings,
  activePresetId: string | null,
) {
  const preset = activePresetId ? getLaserDmxBeamMatrixPreset(activePresetId) : null
  return resolveEnginePresetProvenance({
    presetId: activePresetId,
    presetName: preset?.name ?? null,
    expectedValues: preset ? comparableBeamMatrixSettings(preset.createSettings()) : null,
    actualValues: comparableBeamMatrixSettings(settings),
  })
}

export function isLaserDmxBeamMatrixPresetModified(
  settings: LaserDmxBeamMatrixSettings,
  activePresetId: string | null,
): boolean {
  return activePresetId != null
    && resolveLaserDmxBeamMatrixPresetProvenance(settings, activePresetId).status !== 'exact'
}
