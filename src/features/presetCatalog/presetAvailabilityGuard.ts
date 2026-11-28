import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2'
import { DEFAULT_CANVAS_PRESET_ID } from '../../components/vyzualz/react/ReactTypes'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from '../../components/vyzualz/react/laserDmxBeamMatrixPresets'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../../components/vyzualz/react/LaserDmxShowDirectorPerformancePresets'
import { useReactStore } from '../../stores/reactStore'
import { catalogEngineFor } from './presetAvailability'
import { reportUnavailablePreset } from './presetAvailabilityNotice'
import { getPresetAvailability, usePresetMetadataStore } from './presetMetadataStore'

type ReactState = ReturnType<typeof useReactStore.getState>

interface ActivePreset { engine: string; id: string; name: string }

interface GuardSlot {
  id: string
  /** The preset this slot has on stage (or loaded), or null. */
  active(state: ReactState): ActivePreset | null
  /** Replaces an unusable preset: the usable one this slot had before, else a safe default. */
  replace(state: ReactState, current: ActivePreset, lastGood: string | null): void
}

const usable = (engine: string, id: string | null | undefined): id is string => !!id && getPresetAvailability(engine, id).usable
const firstUsable = (engine: string, current: string, candidates: readonly (string | null | undefined)[]) =>
  candidates.find((candidate): candidate is string => !!candidate && candidate !== current && usable(engine, candidate)) ?? null

const cinema2Order = () => cinema2NativePresetRegistry.list().filter(manifest => !manifest.metadata.tags?.includes('internal')).map(manifest => manifest.id as string)

/** The Show Director performance preset whose program is running (programs are created once per preset and cached). */
function performancePresetFor(programId: string | null | undefined) {
  if (!programId) return null
  return LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(preset => preset.createProgram().id === programId) ?? null
}

const SLOTS: readonly GuardSlot[] = [
  {
    id: 'cinema2',
    active: state => {
      const id = state.cinema2Workspace.activePresetId
      return id ? { engine: 'cinema2', id, name: cinema2NativePresetRegistry.get(id)?.metadata.name ?? id } : null
    },
    replace: (state, current, lastGood) => {
      const target = firstUsable('cinema2', current.id, [lastGood, ...cinema2Order()])
      if (target) state.activateCinema2Workspace({ presetId: target as never })
    },
  },
  {
    // Sound Drawing and PixGrid presets (the React presets the Admin Console governs).
    id: 'react',
    active: state => {
      const preset = state.activeReactPresetId ? state.reactPresets.find(candidate => candidate.id === state.activeReactPresetId) : null
      return preset && catalogEngineFor(preset.engine) ? { engine: preset.engine, id: preset.id, name: preset.name } : null
    },
    replace: (state, current, lastGood) => {
      const sameEngine = state.reactPresets.filter(preset => preset.engine === current.engine).map(preset => preset.id)
      const target = firstUsable(current.engine, current.id, [lastGood, ...sameEngine])
      if (target) state.selectReactPreset(target)
    },
  },
  {
    id: 'canvas',
    active: state => state.selectedCanvasPresetId && state.selectedCanvasPresetId !== DEFAULT_CANVAS_PRESET_ID
      ? { engine: 'canvas', id: state.selectedCanvasPresetId, name: state.selectedCanvasPresetId }
      : null,
    replace: (state, current, lastGood) => state.selectCanvasPreset((firstUsable('canvas', current.id, [lastGood]) ?? DEFAULT_CANVAS_PRESET_ID) as typeof DEFAULT_CANVAS_PRESET_ID),
  },
  {
    id: 'laserDmx:beamMatrix',
    active: state => state.activeLaserDmxBeamMatrixPresetId
      ? { engine: 'laserDmx', id: state.activeLaserDmxBeamMatrixPresetId, name: LASER_DMX_BEAM_MATRIX_PRESETS.find(preset => preset.id === state.activeLaserDmxBeamMatrixPresetId)?.name ?? state.activeLaserDmxBeamMatrixPresetId }
      : null,
    replace: (state, current, lastGood) => {
      // Only swap the beams while LaserDMX is on stage; otherwise just let go of the preset, so another engine is not pulled away.
      const target = state.activeReactEngineId === 'laserDmx'
        ? firstUsable('laserDmx', current.id, [lastGood, ...LASER_DMX_BEAM_MATRIX_PRESETS.map(preset => preset.id)])
        : null
      if (target) state.applyLaserDmxBeamMatrixPreset(target)
      else state.clearActiveLaserDmxBeamMatrixPreset()
    },
  },
  {
    id: 'laserDmx:showDirector',
    active: state => {
      const performance = state.laserDmxShowDirectorPerformance
      if (!performance.enabled) return null
      const preset = performancePresetFor(performance.activeProgramId)
      return preset ? { engine: 'laserDmx', id: preset.id, name: preset.name } : null
    },
    // A running Show Director performance stops (the rig stays as it is) rather than starting a different show on its own.
    replace: state => useReactStore.setState({ laserDmxShowDirectorPerformance: { ...state.laserDmxShowDirectorPerformance, enabled: false } }),
  },
  {
    id: 'headliner',
    active: state => state.headlinerSettings.presetId
      ? { engine: 'headliner', id: state.headlinerSettings.presetId, name: state.headlinerSettings.presetId }
      : null,
    // Back to the last usable effect, or Clean Playback (the plain camera).
    replace: (state, current, lastGood) => state.setHeadlinerSettings({ presetId: (firstUsable('headliner', current.id, [lastGood]) ?? null) as never }),
  },
]

/**
 * Keeps every active preset one the signed-in user may use. A preset an admin has not released, has archived or has switched off is replaced as soon
 * as it becomes active by any route the activation actions do not cover (a saved project, a pad, a Show cue, automation), and also when the admin's
 * change arrives while it is on stage. The user is told why. Returns a stop function.
 */
export function startPresetAvailabilityGuard(): () => void {
  // Per slot: the usable preset currently (or most recently) active, and the usable one before it. A preset switched off on stage was the
  // current one, so the replacement is the one before it.
  const lastGood = new Map<string, string>()
  const previousGood = new Map<string, string>()
  let enforcing = false
  let lastSignature = ''
  let signedRows: unknown = null
  let rowsSignature = ''
  let rowsVersion = 0

  const check = () => {
    if (enforcing) return
    const state = useReactStore.getState()
    const metadata = usePresetMetadataStore.getState()
    const actives = SLOTS.map(slot => slot.active(state))
    // Only the active presets and the availability inputs matter; the store changes far more often than either.
    if (metadata.rows !== signedRows) { signedRows = metadata.rows; rowsSignature = String(++rowsVersion) }
    const signature = `${rowsSignature}|${metadata.viewerIsAdmin}|${actives.map(active => active?.id ?? '').join('|')}`
    if (signature === lastSignature) return
    lastSignature = signature
    enforcing = true
    try {
      SLOTS.forEach((slot, index) => {
        const active = actives[index]
        if (!active) return
        const availability = getPresetAvailability(active.engine, active.id)
        if (availability.usable) {
          const last = lastGood.get(slot.id)
          if (last !== active.id) { if (last) previousGood.set(slot.id, last); lastGood.set(slot.id, active.id) }
          return
        }
        reportUnavailablePreset(active.id, active.name, availability)
        const last = lastGood.get(slot.id)
        const fallback = last && last !== active.id ? last : previousGood.get(slot.id) ?? null
        slot.replace(useReactStore.getState(), active, fallback)
      })
    } finally {
      enforcing = false
    }
    // A replacement changed the state; check once more against it.
    if (SLOTS.some((slot, index) => (slot.active(useReactStore.getState())?.id ?? '') !== (actives[index]?.id ?? ''))) {
      lastSignature = ''
      check()
    }
  }

  const stopReact = useReactStore.subscribe(check)
  const stopMetadata = usePresetMetadataStore.subscribe(check)
  check()
  return () => { stopReact(); stopMetadata() }
}
