import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { CANVAS_PERFORMANCE_SHOW_OPTIONS, getCanvasPerformanceShow } from '../canvasPerformance/CanvasPerformanceShows'
import { CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS, DEFAULT_CANVAS_ORCHESTRATION_SETTINGS } from '../canvasPerformance/CanvasPerformanceTypes'
import { CANVAS_TRANSITIONS } from '../canvasPerformance/CanvasTransitions'
import { PanelSubtabs } from '../PanelSubtabs'
import { CANVAS_PRESET_CONTROL_META } from '../ReactCanvasEngineShell'
import { Collapsible, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { CANVAS_PRESET_BY_ID } from '../ReactTypes'

// ── Layout Lab · REACT tab · Canvas ─────────────────────────────────────────
//
// A disconnected mockup of the Inspector's REACT tab with the Canvas engine active (ReactReactivityWorkspacePanel →
// ReactModulationPanel's Canvas branch): ROUTING / ANALYSIS, then the groups Canvas routes, in production's order: Effects,
// Performance Automation, then the Motion and Preset FX groups of the active preset. The preset is Glitch Pulse, a standard-renderer
// preset that declares both FX and Motion, so every group shows. Labels, ranges, colours, defaults, trigger, transition
// and show lists come from production's own tables, and the enable logic (Auto Performance and Pool Automation turn
// each other off; their dependants stay disabled until on) follows the production handlers. It keeps local state only:
// no stores, media library, runtime or audio engine. The ANALYSIS surface is left empty because it renders live
// Audio Intelligence diagnostics.

const PRESET = CANVAS_PRESET_BY_ID['canvas-glitch-pulse']
const DEFAULTS = DEFAULT_CANVAS_ORCHESTRATION_SETTINGS
const TRANSITION_OPTIONS = Object.values(CANVAS_TRANSITIONS)
  .filter(definition => definition.supportedByCanvas2d)
  .map(definition => ({ value: definition.id as string, label: definition.label }))
const TRIGGER_OPTIONS = CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS.map(option => ({ value: option.value as string, label: option.label }))
const EFFECT_OPTIONS = [
  { value: 'bloom', label: 'Bloom' }, { value: 'echo', label: 'Echo' }, { value: 'glitch', label: 'Glitch' },
  { value: 'melt', label: 'Melt' }, { value: 'stutter', label: 'Stutter' },
]
const AUTOMATION_SLIDERS = [
  ['complexity', 'Layer Complexity', '#61d6aa'], ['transitionDensity', 'Transition Density', '#4ac7db'],
  ['effectIntensity', 'Effect Intensity', '#ff4fd8'], ['motionIntensity', 'Motion Intensity', '#d8b95a'],
  ['cutDensity', 'Cut Density', '#f09c5a'],
] as const
const FX_CONTROLS = ['glow', 'trailAmount', 'rgbSplit', 'glitchAmount', 'stutterRate', 'lumaThreshold'] as const
const MOTION_CONTROLS = ['motionAmount', 'turbulence'] as const

export function LayoutLabCanvasReactTab() {
  const [surface, setSurface] = useState<'routing' | 'analysis'>('routing')
  const [autoSelect, setAutoSelect] = useState(false)
  const [autoPerformance, setAutoPerformance] = useState(false)
  const [poolAutomation, setPoolAutomation] = useState(false)
  const [trigger, setTrigger] = useState<string>(DEFAULTS.poolAutomationTrigger)
  const [transition, setTransition] = useState<string>(DEFAULTS.poolAutomationTransitionId)
  const [show, setShow] = useState<string>(DEFAULTS.programId)
  const [sliders, setSliders] = useState<Record<string, number>>({
    complexity: DEFAULTS.complexity, transitionDensity: DEFAULTS.transitionDensity, effectIntensity: DEFAULTS.effectIntensity,
    motionIntensity: DEFAULTS.motionIntensity, cutDensity: DEFAULTS.cutDensity,
  })
  const [effect, setEffect] = useState('')
  const [preset, setPreset] = useState<Record<string, number>>(() => ({ ...PRESET.settings } as unknown as Record<string, number>))
  const showDefinition = getCanvasPerformanceShow(show)

  const presetControl = (key: typeof FX_CONTROLS[number] | typeof MOTION_CONTROLS[number]) => {
    const meta = CANVAS_PRESET_CONTROL_META[key]
    return (
      <SliderRow
        key={key}
        label={meta.label}
        value={preset[key] ?? 0}
        onChange={value => setPreset(current => ({ ...current, [key]: value }))}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        color={meta.color}
        description={meta.description}
      />
    )
  }

  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={setSurface}
        ariaLabel="Reactivity surfaces"
        options={[{ id: 'routing', label: 'ROUTING' }, { id: 'analysis', label: 'ANALYSIS' }]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {surface === 'analysis' ? (
            <div className="rv-audio-analysis-panel" />
          ) : (
            <div className="rv-ctrl-group">
              <Collapsible label="Effects">
                <div className="rv-cg-body" data-canvas-add-effects="routing">
                  <div className="rv-canvas-layer-effects-group rv-ae-tcb-group">
                    <div className="rv-canvas-layer-media-row">
                      <span className="rv-ae-tcb-thumb">
                        <span className="rv-ae-tcb-thumb-image" style={{ background: 'radial-gradient(ellipse at 50% 38%, #e04fd0, #14081a 72%)', display: 'block', width: '100%', height: '100%' }} aria-hidden="true" />
                      </span>
                      <div className="rv-canvas-layer-media-row__field">
                        <SelectRow label="Active Media 1" value="m" onChange={() => {}} options={[{ value: 'm', label: 'Neon Glitch Logo' }]} />
                      </div>
                    </div>
                    <div className="rv-ae-tcb-addfx-first is-open">
                      <div className="rv-ae-tcb-addfx-reveal">
                        <span className="rv-ae-tcb-fx" aria-hidden="true"><AppIcon kind="wand" size={14} color="currentColor" /></span>
                        <SelectRow label="Effect" value={effect} onChange={setEffect} options={EFFECT_OPTIONS} placeholder="Select Effect…" />
                      </div>
                    </div>
                  </div>
                </div>
              </Collapsible>

              <Collapsible label="Performance Automation" defaultOpen>
                <div className="rv-canvas-auto-select-block">
                  <ToggleRow
                    label="Auto Select"
                    value={autoSelect}
                    onChange={setAutoSelect}
                    description="Select saved media from your library first. Using fallback/static selection until a track or live audio features are available. Auto Select can choose CANVAS presets and unlocked media."
                  />
                </div>
                <ToggleRow
                  label="Auto Performance"
                  value={autoPerformance}
                  onChange={enabled => { setAutoPerformance(enabled); if (enabled) setPoolAutomation(false) }}
                  description="Uses the Shared Performance Core to arrange the selected pool. Existing presets and manual playback remain the fallback when disabled."
                />
                <ToggleRow
                  label="Pool Automation"
                  value={poolAutomation}
                  onChange={enabled => { setPoolAutomation(enabled); if (enabled) setAutoPerformance(false) }}
                  description="Rotates only the free automatic CANVAS slots from the one active Media Pool. Manual layers stay pinned."
                />
                <SelectRow label="Pool Trigger" value={trigger} onChange={setTrigger} options={TRIGGER_OPTIONS} disabled={!poolAutomation} />
                <SelectRow label="Pool Transition" value={transition} onChange={setTransition} options={TRANSITION_OPTIONS} disabled={!poolAutomation} />
                <SelectRow
                  label="Performance Show"
                  value={show}
                  onChange={setShow}
                  options={CANVAS_PERFORMANCE_SHOW_OPTIONS.map(option => ({ value: option.value as string, label: option.label }))}
                  description={showDefinition.description}
                  disabled={!autoPerformance}
                />
                {AUTOMATION_SLIDERS.map(([key, label, color]) => (
                  <SliderRow
                    key={key}
                    label={label}
                    value={sliders[key] ?? 0}
                    onChange={value => setSliders(current => ({ ...current, [key]: value }))}
                    min={0}
                    max={1}
                    step={0.01}
                    color={color}
                    disabled={!autoPerformance}
                  />
                ))}
              </Collapsible>

              <Collapsible label="Motion" defaultOpen>{MOTION_CONTROLS.map(presetControl)}</Collapsible>
              <Collapsible label="Preset FX" defaultOpen>{FX_CONTROLS.map(presetControl)}</Collapsible>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
