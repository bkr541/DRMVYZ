import { useMemo, useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../stores/reactStore'
import { resolveCinematicPresetProvenance } from './CinematicPresetProvenance'
import {
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_NUMERIC_RANGES,
  CINEMATIC_PORTAL_SHAPES,
  CINEMATIC_TRANSITION_EASINGS,
  CINEMATIC_TRANSITION_MODES,
  type CinematicAudioRoute,
  type CinematicAudioSource,
  type CinematicAudioTarget,
  resolveSupportedCinematicCameraRig,
  type CinematicCameraRig,
  type CinematicPortalShape,
  type CinematicQualityTier,
  type CinematicTransitionEasing,
  type CinematicTransitionMode,
  type CinematicWorldConfig,
  type CinematicWorldMode,
} from './CinematicWorldConfig'
import {
  resolveReactiveConstellationSettings,
} from './CinematicWorldSettings'
import {
  REACTIVE_CONSTELLATION_VISUAL_DNA_OPTIONS,
  applyReactiveConstellationVisualDnaProfile,
  markReactiveConstellationVisualDnaCustom,
  updateReactiveConstellationMacro,
} from './ReactiveConstellationVisualDna'
import {
  getVisibleCinematicWorldControlGroups,
  readCinematicWorldSetting,
  updateCinematicWorldConfigSetting,
  type AnyCinematicWorldControlSchema,
} from './CinematicWorldControlSchema'
import {
  CINEMATIC_SOURCE_LABELS,
  CINEMATIC_TARGET_LABELS,
  CINEMATIC_WORLD_BY_ID,
  humanizeCinematicKey,
  isCinematicSourceAvailable,
  nextCinematicVariationSeed,
  randomizeCinematicVariationSeed,
} from './CinematicWorldsUi'
import {
  diagnoseCinematicMusicIntelligenceInputs,
} from './CinematicMusicIntelligenceDiagnostics'
import { Collapsible, CtrlSection, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'

const PORTAL_SHAPE_LABELS: Record<CinematicPortalShape, string> = {
  rectangle: 'Rectangle', circle: 'Circle', arch: 'Arch', triangle: 'Triangle', fracture: 'Fracture', organic: 'Organic', customMask: 'Custom Mask',
}

const CAMERA_LABELS: Record<CinematicCameraRig, string> = {
  locked: 'Locked', dolly: 'Dolly', orbit: 'Orbit', flyThrough: 'Fly Through', handheld: 'Handheld', autoDirector: 'Auto Director',
}

const EMPTY_MI_CAPABILITIES = { liveBands: false, rhythmEvents: false, beatGrid: false, sections: false, trackEnergyCurve: false, stemCurves: false, lyrics: false } as const

function useMusicIntelligenceCapabilities() {
  return useSyncExternalStore(
    AudioFeatureBus.subscribe,
    () => AudioFeatureBus.getFrame().capabilities ?? EMPTY_MI_CAPABILITIES,
    () => AudioFeatureBus.getFrame().capabilities ?? EMPTY_MI_CAPABILITIES,
  )
}

let ultraQualitySupportCache: boolean | null = null

export function isUltraCinematicQualitySupported(): boolean {
  if (ultraQualitySupportCache != null) return ultraQualitySupportCache
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const hasWebGl2 = Boolean(canvas.getContext?.('webgl2'))
    ultraQualitySupportCache = hasWebGl2 && (navigator.hardwareConcurrency ?? 4) >= 8
  } catch {
    ultraQualitySupportCache = false
  }
  return ultraQualitySupportCache
}

function cloneConfig(config: CinematicWorldConfig): CinematicWorldConfig {
  return structuredClone(config)
}

export function CinematicWorldControlSchemaRenderer({
  config, schema, uiMode, onChange,
}: {
  config: CinematicWorldConfig
  schema: AnyCinematicWorldControlSchema
  uiMode: 'simple' | 'advanced'
  onChange: (config: CinematicWorldConfig) => void
}) {
  const groups = getVisibleCinematicWorldControlGroups(schema, uiMode)
  return (
    <>
      {groups.map(group => (
        <Collapsible key={group.id} label={group.label} defaultOpen>
          {group.description && <div className="rv-ctrl-info">{group.description}</div>}
          {group.controls.map(control => {
            const current = readCinematicWorldSetting(config, control.setting)
            const commit = (value: unknown) => {
              const updated = updateCinematicWorldConfigSetting(config, schema, control, value)
              onChange(uiMode === 'advanced' && schema.mode === 'reactiveConstellation'
                ? markReactiveConstellationVisualDnaCustom(updated)
                : updated)
            }
            if (control.kind === 'slider' || control.kind === 'integer') {
              return (
                <SliderRow
                  key={control.id}
                  id={control.id}
                  label={control.label}
                  description={control.description}
                  value={typeof current === 'number' ? current : control.min}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  onChange={commit}
                />
              )
            }
            if (control.kind === 'select') {
              const selected = control.options.find(option => Object.is(option.value, current))
              return (
                <SelectRow
                  key={control.id}
                  id={control.id}
                  label={control.label}
                  description={control.description}
                  value={String(selected?.value ?? control.options[0]?.value ?? '')}
                  options={control.options.map(option => ({
                    value: String(option.value),
                    label: option.label,
                    disabled: option.disabled,
                  }))}
                  onChange={value => commit(control.options.find(option => String(option.value) === value)?.value)}
                />
              )
            }
            return (
              <ToggleRow
                key={control.id}
                id={control.id}
                label={control.label}
                description={control.description}
                value={current === true}
                onChange={commit}
              />
            )
          })}
        </Collapsible>
      ))}
    </>
  )
}

function CinematicModeSwitch() {
  const { mode, setMode } = useReactStore(useShallow(state => ({
    mode: state.cinematicWorldsUiMode,
    setMode: state.setCinematicWorldsUiMode,
  })))
  return (
    <div className="rv-cinematic-mode-switch" role="group" aria-label="Cinematic Worlds control detail">
      {(['simple', 'advanced'] as const).map(value => (
        <button
          id={`cinematic-worlds-mode-${value}`}
          key={value}
          type="button"
          className={mode === value ? 'rv-cinematic-mode-btn rv-cinematic-mode-btn--active' : 'rv-cinematic-mode-btn'}
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
        >
          {value === 'simple' ? 'Simple' : 'Advanced'}
        </button>
      ))}
    </div>
  )
}

function useActiveCinematic() {
  const selected = useReactStore(useShallow(state => ({
    activePresetId: state.activeReactPresetId,
    reactPresets: state.reactPresets,
    configOverrides: state.cinematicConfigsByPresetId,
    seedLocks: state.cinematicSeedLocksByPresetId,
    uiMode: state.cinematicWorldsUiMode,
    selectPreset: state.selectReactPreset,
    setConfig: state.setCinematicConfigForPreset,
    clearConfig: state.clearCinematicConfigForPreset,
    setSeedLocked: state.setCinematicSeedLocked,
  })))
  const preset = useMemo(() => selected.reactPresets.find(item => item.id === selected.activePresetId && item.engine === 'cinematicPortal')
    ?? selected.reactPresets.find(item => item.engine === 'cinematicPortal')
    ?? null, [selected.activePresetId, selected.reactPresets])
  const config = useMemo(
    () => resolveCinematicConfigForPreset(preset, selected.configOverrides),
    [preset, selected.configOverrides],
  )
  const presets = useMemo(
    () => selected.reactPresets.filter(item => item.engine === 'cinematicPortal'),
    [selected.reactPresets],
  )
  return {
    ...selected,
    preset,
    config,
    presets,
    modified: resolveCinematicPresetProvenance(preset, config).status === 'modified',
    seedLocked: Boolean(preset && selected.seedLocks[preset.id]),
  }
}

function updateConfig(
  config: CinematicWorldConfig,
  patch: Partial<CinematicWorldConfig>,
): CinematicWorldConfig {
  return { ...config, ...patch }
}

function ReactiveConstellationProfileControls({
  config,
  onChange,
}: {
  config: CinematicWorldConfig
  onChange: (config: CinematicWorldConfig) => void
}) {
  if (config.worldMode !== 'reactiveConstellation' || config.worldSettings.mode !== 'reactiveConstellation') return null
  const settings = resolveReactiveConstellationSettings(config.worldSettings)
  const selected = REACTIVE_CONSTELLATION_VISUAL_DNA_OPTIONS.find(option => option.value === settings.visualDnaProfile)
  return (
    <>
      <CtrlSection label="Visual DNA" />
      <SelectRow
        id="constellation-visual-dna-profile"
        label="Starting Profile"
        value={settings.visualDnaProfile}
        options={REACTIVE_CONSTELLATION_VISUAL_DNA_OPTIONS.map(option => ({ value: option.value, label: option.label }))}
        onChange={profileId => onChange(applyReactiveConstellationVisualDnaProfile(config, profileId as typeof settings.visualDnaProfile))}
        description="Applies a cloned, normalized starting character. Macros and advanced controls remain editable afterward."
      />
      <div className="rv-constellation-profile-summary" role="status" aria-live="polite">
        <strong>{selected?.label ?? 'Custom'}</strong>
        <span>{selected?.description}</span>
      </div>
    </>
  )
}

const CONSTELLATION_MACROS = [
  { key: 'macroStructure', label: 'Structure', description: 'Moves from sparse and compact to broad, connected, and morph-ready.' },
  { key: 'macroMotion', label: 'Motion', description: 'Scales elastic travel, spin, and recovery energy without replacing physics values.' },
  { key: 'macroImpact', label: 'Impact', description: 'Shapes beam hits, collapse pressure, and burst force.' },
  { key: 'macroTrails', label: 'Trails', description: 'Controls historical beam density and luminous memory.' },
  { key: 'macroMaterial', label: 'Material', description: 'Moves from transparent and restrained to bright, solid, and emissive.' },
  { key: 'macroCamera', label: 'Camera', description: 'Adds bounded world orbit and motion energy while preserving the selected camera rig.' },
] as const

function ReactiveConstellationMacroControls({
  config,
  onChange,
}: {
  config: CinematicWorldConfig
  onChange: (config: CinematicWorldConfig) => void
}) {
  if (config.worldMode !== 'reactiveConstellation' || config.worldSettings.mode !== 'reactiveConstellation') return null
  const settings = resolveReactiveConstellationSettings(config.worldSettings)
  return (
    <Collapsible label="Performance Macros" defaultOpen>
      <div className="rv-constellation-macro-grid" role="group" aria-label="Reactive Constellation performance macros">
        {CONSTELLATION_MACROS.map(macro => (
          <SliderRow
            key={macro.key}
            id={`constellation-${macro.key.replace('macro', '').toLowerCase()}-macro`}
            label={macro.label}
            description={macro.description}
            value={settings[macro.key]}
            min={0}
            max={1}
            step={0.01}
            onChange={value => onChange(updateReactiveConstellationMacro(config, macro.key, value))}
          />
        ))}
      </div>
      <div className="rv-ctrl-info">Macros are non-destructive runtime offsets. Switch to Advanced to edit the underlying geometry, physics, materials, camera, and choreography.</div>
    </Collapsible>
  )
}

function WorldStatus({ presetName, worldMode, modified }: { presetName: string; worldMode: CinematicWorldMode; modified: boolean }) {
  const world = CINEMATIC_WORLD_BY_ID[worldMode]
  return (
    <div className="rv-cinematic-status" aria-live="polite">
      <div><span>World</span><strong>{world.label}</strong></div>
      <div><span>Preset</span><strong>{presetName}</strong></div>
      <div><span>Status</span><strong>{modified ? 'Modified from preset' : 'Preset values'}</strong></div>
    </div>
  )
}

function VariationControls({ config, presetId, locked, onChange, onLock, onResetWorld, onResetCamera, onResetAudio }: {
  config: CinematicWorldConfig
  presetId: string
  locked: boolean
  onChange: (config: CinematicWorldConfig) => void
  onLock: (locked: boolean) => void
  onResetWorld: () => void
  onResetCamera: () => void
  onResetAudio: () => void
}) {
  const setSeed = (seed: number) => onChange(updateConfig(config, { seed }))
  return (
    <>
      <CtrlSection label="Variation" />
      <div className="rv-cinematic-seed-readout" aria-live="polite">
        <span>Seed</span><output id={`cinematic-seed-${presetId}`}>{config.seed >>> 0}</output>
      </div>
      <div className="rv-cinematic-action-grid">
        <button type="button" aria-label="Previous cinematic variation" disabled={locked} onClick={() => setSeed(nextCinematicVariationSeed(config.seed, -1))}>Previous</button>
        <button type="button" aria-label="Randomize cinematic variation" disabled={locked} onClick={() => setSeed(randomizeCinematicVariationSeed(config.seed))}>Randomize</button>
        <button type="button" aria-label="Next cinematic variation" disabled={locked} onClick={() => setSeed(nextCinematicVariationSeed(config.seed, 1))}>Next</button>
      </div>
      <ToggleRow id="cinematic-seed-lock" label="Lock Seed" value={locked} onChange={onLock} description="Prevents live variation buttons from changing the saved seed." />
      <div className="rv-cinematic-action-grid rv-cinematic-action-grid--resets">
        <button type="button" onClick={onResetWorld}>Reset World</button>
        <button type="button" onClick={onResetCamera}>Reset Camera</button>
        <button type="button" onClick={onResetAudio}>Reset Audio Mappings</button>
      </div>
    </>
  )
}

function AutoDirectorControls({ config, onChange, advanced }: { config: CinematicWorldConfig; onChange: (config: CinematicWorldConfig) => void; advanced: boolean }) {
  const auto = config.camera.autoDirector
  const setAuto = (patch: Partial<typeof auto>) => onChange({
    ...config,
    camera: { ...config.camera, autoDirector: { ...auto, ...patch } },
  })
  return (
    <>
      <CtrlSection label="Auto Director" />
      <div className="rv-ctrl-info">Auto Director is selected through Camera Mode. Its settings never rewrite the last manual rig.</div>
      <SliderRow id="cinematic-auto-director-strength" label="Strength" value={auto.strength} onChange={strength => setAuto({ strength })} />
      {advanced && (
        <>
          <SliderRow id="cinematic-auto-director-activity" label="Camera Activity" value={auto.cameraActivity} onChange={cameraActivity => setAuto({ cameraActivity })} />
          <SliderRow id="cinematic-auto-director-frequency" label="Transition Frequency" value={auto.transitionFrequency} onChange={transitionFrequency => setAuto({ transitionFrequency })} />
          <SliderRow id="cinematic-auto-director-drop" label="Drop Impact" value={auto.dropImpact} onChange={dropImpact => setAuto({ dropImpact })} />
          <SliderRow id="cinematic-auto-director-build" label="Build Intensity" value={auto.buildIntensity} onChange={buildIntensity => setAuto({ buildIntensity })} />
          <SliderRow id="cinematic-auto-director-min-shot" label="Minimum Shot Duration" value={auto.minimumShotDurationSec} min={1} max={16} step={0.5} onChange={minimumShotDurationSec => setAuto({ minimumShotDurationSec })} description="Seconds before Auto Director may choose another shot." />
          <ToggleRow id="cinematic-auto-director-lock" label="Manual Camera Lock" value={auto.manualCameraLock} onChange={manualCameraLock => setAuto({ manualCameraLock })} />
        </>
      )}
    </>
  )
}

export function CinematicWorldsDesignControls() {
  const active = useActiveCinematic()
  if (!active.preset || !active.config) return <div className="rv-ctrl-info">No Cinematic Worlds preset is available.</div>
  const { preset, config, modified, setConfig, clearConfig, seedLocked, setSeedLocked, uiMode } = active
  const world = CINEMATIC_WORLD_BY_ID[config.worldMode]
  const resolvedCameraRig = resolveSupportedCinematicCameraRig(config.cameraRig, world.cameraRigs, 'locked')
  const save = (next: CinematicWorldConfig) => setConfig(preset.id, next)
  const saveCameraEdit = (next: CinematicWorldConfig) => save(uiMode === 'advanced' && config.worldMode === 'reactiveConstellation'
    ? markReactiveConstellationVisualDnaCustom(next)
    : next)
  const baseConfig = resolveCinematicConfigForPreset(preset, {})!

  const resetCamera = () => save(config.worldMode === 'reactiveConstellation'
    ? markReactiveConstellationVisualDnaCustom({ ...config, cameraRig: baseConfig.cameraRig, camera: cloneConfig(baseConfig).camera })
    : { ...config, cameraRig: baseConfig.cameraRig, camera: cloneConfig(baseConfig).camera })
  const resetAudio = () => save(config.worldMode === 'reactiveConstellation'
    ? markReactiveConstellationVisualDnaCustom({ ...config, audioMapping: cloneConfig(baseConfig).audioMapping })
    : { ...config, audioMapping: cloneConfig(baseConfig).audioMapping })

  return (
    <div className="rv-cinematic-controls" data-world={config.worldMode}>
      <CinematicModeSwitch />
      <WorldStatus presetName={preset.name} worldMode={config.worldMode} modified={modified} />
      <div className="rv-ctrl-info">Choose a World from the left SOURCE panel and load its looks from PRESETS. Design controls below edit the active look.</div>

      <ReactiveConstellationProfileControls config={config} onChange={save} />

      <CtrlSection label="Camera" />
      <SelectRow
        id="cinematic-camera-rig"
        label="Camera Mode"
        value={resolvedCameraRig}
        onChange={cameraRig => saveCameraEdit({
          ...config,
          cameraRig: resolveSupportedCinematicCameraRig(cameraRig, world.cameraRigs, resolvedCameraRig),
        })}
        options={world.cameraRigs.map(rig => ({ value: rig, label: CAMERA_LABELS[rig] }))}
      />

      {uiMode === 'advanced' && (
        <>
          {world.supportsPortalShape && (
            <>
              <CtrlSection label="Portal Shape" />
              <SelectRow id="cinematic-portal-shape" label="Shape" value={config.portalShape} onChange={portalShape => save({ ...config, portalShape: portalShape as CinematicPortalShape })} options={CINEMATIC_PORTAL_SHAPES.map(shape => ({ value: shape, label: PORTAL_SHAPE_LABELS[shape] }))} />
            </>
          )}
          <CtrlSection label="Camera Values" />
          {resolvedCameraRig === 'locked' && (
            <>
              <SliderRow id="cinematic-camera-fov" label="Field of View" value={config.camera.locked.fieldOfView} min={30} max={100} step={1} onChange={fieldOfView => saveCameraEdit({ ...config, camera: { ...config.camera, locked: { ...config.camera.locked, fieldOfView } } })} />
              <SliderRow id="cinematic-camera-breathing" label="Breathing" value={config.camera.locked.breathingStrength} min={0} max={0.12} step={0.002} onChange={breathingStrength => saveCameraEdit({ ...config, camera: { ...config.camera, locked: { ...config.camera.locked, breathingStrength } } })} />
              <SliderRow id="cinematic-camera-beat-punch" label="Beat Punch" value={config.camera.locked.beatPunch} min={0} max={0.4} step={0.01} onChange={beatPunch => saveCameraEdit({ ...config, camera: { ...config.camera, locked: { ...config.camera.locked, beatPunch } } })} />
            </>
          )}
          {resolvedCameraRig === 'dolly' && <SliderRow id="cinematic-camera-dolly-speed" label="Dolly Speed" value={config.camera.dolly.speed} min={0} max={1} step={0.01} onChange={speed => saveCameraEdit({ ...config, camera: { ...config.camera, dolly: { ...config.camera.dolly, speed } } })} />}
          {resolvedCameraRig === 'orbit' && (
            <>
              <SliderRow id="cinematic-camera-orbit-radius" label="Orbit Radius" value={config.camera.orbit.radius} min={0.5} max={4} step={0.05} onChange={radius => saveCameraEdit({ ...config, camera: { ...config.camera, orbit: { ...config.camera.orbit, radius } } })} />
              <SliderRow id="cinematic-camera-orbit-speed" label="Orbit Speed" value={config.camera.orbit.angularSpeed} min={-1} max={1} step={0.01} onChange={angularSpeed => saveCameraEdit({ ...config, camera: { ...config.camera, orbit: { ...config.camera.orbit, angularSpeed } } })} />
            </>
          )}
          {resolvedCameraRig === 'flyThrough' && <SliderRow id="cinematic-camera-fly-speed" label="Travel Speed" value={config.camera.flyThrough.speed} min={0} max={1.5} step={0.01} onChange={speed => saveCameraEdit({ ...config, camera: { ...config.camera, flyThrough: { ...config.camera.flyThrough, speed } } })} />}
          {resolvedCameraRig === 'handheld' && <SliderRow id="cinematic-camera-handheld" label="Handheld Strength" value={config.camera.handheld.strength} min={0} max={1} step={0.01} onChange={strength => saveCameraEdit({ ...config, camera: { ...config.camera, handheld: { ...config.camera.handheld, strength } } })} />}
          <CtrlSection label="Transitions" />
          <SelectRow id="cinematic-transition-mode" label="Transition" value={config.transition.mode} onChange={mode => save({ ...config, transition: { ...config.transition, mode: mode as CinematicTransitionMode } })} options={CINEMATIC_TRANSITION_MODES.map(mode => ({ value: mode, label: humanizeCinematicKey(mode) }))} />
          <SliderRow id="cinematic-transition-duration" label="Duration" value={config.transition.durationMs} min={0} max={10000} step={50} onChange={durationMs => save({ ...config, transition: { ...config.transition, durationMs } })} description="Milliseconds used when switching compatible worlds or presets." />
          <SelectRow id="cinematic-transition-easing" label="Easing" value={config.transition.easing} onChange={easing => save({ ...config, transition: { ...config.transition, easing: easing as CinematicTransitionEasing } })} options={CINEMATIC_TRANSITION_EASINGS.map(easing => ({ value: easing, label: humanizeCinematicKey(easing) }))} />
          <ToggleRow id="cinematic-transition-preserve-camera" label="Preserve Camera" value={config.transition.preserveCamera} onChange={preserveCamera => save({ ...config, transition: { ...config.transition, preserveCamera } })} />
        </>
      )}

      {resolvedCameraRig === 'autoDirector' && world.cameraRigs.includes('autoDirector') && (
        <AutoDirectorControls config={config} onChange={saveCameraEdit} advanced={uiMode === 'advanced'} />
      )}
      <VariationControls
        config={config}
        presetId={preset.id}
        locked={seedLocked}
        onChange={save}
        onLock={locked => setSeedLocked(preset.id, locked)}
        onResetWorld={() => clearConfig(preset.id)}
        onResetCamera={resetCamera}
        onResetAudio={resetAudio}
      />
    </div>
  )
}

export function CinematicWorldsFxControls() {
  const active = useActiveCinematic()
  const { reactIntensity, setReactIntensity, reactMotion, setReactMotion, reactBassReactivity, setReactBassReactivity } = useReactStore(useShallow(state => ({
    reactIntensity: state.reactIntensity, setReactIntensity: state.setReactIntensity,
    reactMotion: state.reactMotion, setReactMotion: state.setReactMotion,
    reactBassReactivity: state.reactBassReactivity, setReactBassReactivity: state.setReactBassReactivity,
  })))
  if (!active.preset || !active.config) return null
  const { preset, config, uiMode, setConfig } = active
  const save = (next: CinematicWorldConfig) => setConfig(preset.id, next)
  const saveDetailed = (next: CinematicWorldConfig) => save(config.worldMode === 'reactiveConstellation'
    ? markReactiveConstellationVisualDnaCustom(next)
    : next)
  const ultraSupported = isUltraCinematicQualitySupported()
  return (
    <div className="rv-cinematic-controls">
      <Collapsible label="Live Controls" defaultOpen>
        <SliderRow id="cinematic-live-intensity" label="Intensity" value={reactIntensity} onChange={setReactIntensity} />
        <SliderRow id="cinematic-live-motion" label="Motion" value={reactMotion} onChange={setReactMotion} />
        <SliderRow id="cinematic-live-audio" label="Audio Reaction" value={reactBassReactivity} onChange={setReactBassReactivity} />
      </Collapsible>

      <Collapsible label="Output Quality" defaultOpen>
        <SelectRow
          id="cinematic-quality"
          label="Quality"
          value={config.qualityTier}
          onChange={qualityTier => save({ ...config, qualityTier: qualityTier as CinematicQualityTier })}
          options={[
            { value: 'auto', label: 'Auto (Recommended)' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
            { value: 'ultra', label: ultraSupported ? 'Ultra' : 'Ultra (Unavailable on this device)', disabled: !ultraSupported && config.qualityTier !== 'ultra' },
          ]}
          description="Changes geometry density, particles, ray-march steps, atmospheric layers and feedback resolution."
        />
        {!ultraSupported && config.qualityTier === 'ultra' && <div className="rv-cinematic-warning" role="status">This project requests Ultra, but this device does not meet the safe WebGL2 and CPU threshold. Choose Auto to avoid overload.</div>}
      </Collapsible>

      {config.worldMode === 'reactiveConstellation' && uiMode === 'simple' && <ReactiveConstellationMacroControls config={config} onChange={save} />}

      {uiMode === 'advanced' && (
        <>
          <Collapsible label="Environment" defaultOpen>
            {Object.entries(config.environment).map(([key, value]) => {
              const range = CINEMATIC_NUMERIC_RANGES.environment[key as keyof typeof CINEMATIC_NUMERIC_RANGES.environment]
              return <SliderRow key={key} id={`cinematic-environment-${key}`} label={humanizeCinematicKey(key)} value={value} min={range.min} max={range.max} step={0.01} onChange={next => saveDetailed({ ...config, environment: { ...config.environment, [key]: next } })} />
            })}
          </Collapsible>
          <Collapsible label="Material" defaultOpen>
            {Object.entries(config.material).map(([key, value]) => {
              const range = CINEMATIC_NUMERIC_RANGES.material[key as keyof typeof CINEMATIC_NUMERIC_RANGES.material]
              return <SliderRow key={key} id={`cinematic-material-${key}`} label={humanizeCinematicKey(key)} value={value} min={range.min} max={range.max} step={0.01} onChange={next => saveDetailed({ ...config, material: { ...config.material, [key]: next } })} />
            })}
          </Collapsible>
        </>
      )}
      <CinematicWorldControlSchemaRenderer
        config={config}
        schema={CINEMATIC_WORLD_BY_ID[config.worldMode].controls}
        uiMode={uiMode}
        onChange={saveDetailed}
      />
    </div>
  )
}

export function CinematicWorldsModulationControls() {
  const active = useActiveCinematic()
  const capabilities = useMusicIntelligenceCapabilities()
  if (!active.preset || !active.config) return null
  const { preset, config, uiMode, setConfig } = active
  const save = (next: CinematicWorldConfig) => setConfig(preset.id, uiMode === 'advanced' && config.worldMode === 'reactiveConstellation'
    ? markReactiveConstellationVisualDnaCustom(next)
    : next)
  const world = CINEMATIC_WORLD_BY_ID[config.worldMode]
  const availableSources = CINEMATIC_AUDIO_SOURCES.filter(source => isCinematicSourceAvailable(source, capabilities))
  const inputDiagnostics = diagnoseCinematicMusicIntelligenceInputs(
    config.audioMapping.routes,
    config.audioMapping.enabled,
    world.modulationTargets,
    capabilities,
  )
  const setRoutes = (routes: CinematicAudioRoute[]) => save({ ...config, audioMapping: { ...config.audioMapping, routes } })
  const updateRoute = (index: number, patch: Partial<CinematicAudioRoute>) => setRoutes(config.audioMapping.routes.map((route, routeIndex) => routeIndex === index ? { ...route, ...patch } : route))
  const addRoute = () => {
    const source = availableSources[0] ?? 'overallEnergy'
    const target = world.modulationTargets[0] ?? 'impact'
    setRoutes([...config.audioMapping.routes, {
      id: `ui-${config.worldMode}-${config.audioMapping.routes.length + 1}-${config.seed >>> 0}`,
      source, target, enabled: true, amount: 1, attackMs: 40, releaseMs: 220, responseCurve: 'linear',
    }])
  }
  return (
    <div className="rv-cinematic-controls">
      <CinematicModeSwitch />
      <Collapsible label="Audio Reaction" defaultOpen>
        <ToggleRow id="cinematic-audio-enabled" label="World Audio Mapping" value={config.audioMapping.enabled} onChange={enabled => save({ ...config, audioMapping: { ...config.audioMapping, enabled } })} />
        {inputDiagnostics.unavailableRoutes.length > 0 && (
          <div className="rv-cinematic-capability" role="status">
            <strong>Unavailable Music Intelligence inputs</strong>
            <span>{inputDiagnostics.reasons.map(reason => reason.message).join(' ')}</span>
            <small>Only {inputDiagnostics.unavailableRoutes.length} of {inputDiagnostics.activeRouteCount} active audio {inputDiagnostics.activeRouteCount === 1 ? 'mapping needs' : 'mappings need'} attention.</small>
          </div>
        )}
        {uiMode === 'simple' ? (
          <div className="rv-ctrl-info">This world is using {config.audioMapping.routes.length} curated source-to-target mappings. Advanced mode unlocks individual assignments, attack and release.</div>
        ) : (
          <>
            <SliderRow id="cinematic-audio-smoothing" label="Global Smoothing" value={config.audioMapping.smoothingMs} min={0} max={2000} step={10} onChange={smoothingMs => save({ ...config, audioMapping: { ...config.audioMapping, smoothingMs } })} />
            <div className="rv-cinematic-route-list" aria-label="Audio mappings">
              {config.audioMapping.routes.map((route, index) => {
                const currentSourceUnavailable = !isCinematicSourceAvailable(route.source, capabilities)
                const routeDiagnostic = inputDiagnostics.unavailableRoutes.find(item => item.routeIndex === index)
                return (
                  <fieldset className={`rv-cinematic-route${routeDiagnostic ? ' rv-cinematic-route--unavailable' : ''}`} key={route.id}>
                    <legend>Mapping {index + 1}</legend>
                    <ToggleRow id={`cinematic-route-${index}-enabled`} label="Route Enabled" value={route.enabled} onChange={enabled => updateRoute(index, { enabled })} />
                    <SelectRow id={`cinematic-route-${index}-source`} label="Source" value={route.source} onChange={source => updateRoute(index, { source: source as CinematicAudioSource })} options={[
                      ...(currentSourceUnavailable ? [{ value: route.source, label: `${CINEMATIC_SOURCE_LABELS[route.source]} (Unavailable)`, disabled: true }] : []),
                      ...availableSources.filter(source => source !== route.source || !currentSourceUnavailable).map(source => ({ value: source, label: CINEMATIC_SOURCE_LABELS[source] })),
                    ]} />
                    <SelectRow id={`cinematic-route-${index}-target`} label="Target" value={route.target} onChange={target => updateRoute(index, { target: target as CinematicAudioTarget })} options={world.modulationTargets.map(target => ({ value: target, label: CINEMATIC_TARGET_LABELS[target] }))} />
                    {routeDiagnostic && (
                      <div className="rv-cinematic-route-diagnostic" role="status">
                        <strong>{CINEMATIC_SOURCE_LABELS[route.source]} unavailable</strong>
                        <span>{routeDiagnostic.reasons.map(reason => reason.message).join(' ')}</span>
                      </div>
                    )}
                    <SliderRow id={`cinematic-route-${index}-amount`} label="Amount" value={route.amount} min={-2} max={2} step={0.01} onChange={amount => updateRoute(index, { amount })} />
                    <SliderRow id={`cinematic-route-${index}-attack`} label="Attack" value={route.attackMs} min={0} max={2000} step={10} onChange={attackMs => updateRoute(index, { attackMs })} />
                    <SliderRow id={`cinematic-route-${index}-release`} label="Release" value={route.releaseMs} min={0} max={4000} step={10} onChange={releaseMs => updateRoute(index, { releaseMs })} />
                    <button type="button" className="rv-cinematic-remove-route" aria-label={`Remove audio mapping ${index + 1}`} onClick={() => setRoutes(config.audioMapping.routes.filter((_, routeIndex) => routeIndex !== index))}>Remove Mapping</button>
                  </fieldset>
                )
              })}
            </div>
            <button type="button" className="rv-cinematic-wide-button" onClick={addRoute}>Add Audio Mapping</button>
          </>
        )}
      </Collapsible>
    </div>
  )
}
