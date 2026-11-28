import { AppIcon } from '../../shared/icons/AppIcon'
import { useEffect, useId, useState } from 'react'
import { IconChipButton } from './controls/IconChipButton'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { ConnectedShaderModulationPanel } from './shaders/ui/ConnectedShaderModulationPanel'
import { CinematicWorldsModulationControls } from './CinematicWorldsControls'
import { SliderRow, NumberInputRow, SelectRow, TextInputRow, ToggleRow, Collapsible } from './ReactControlRows'
import {
  type LaserDmxModulationRoute,
  type LaserDmxTriggerTimingFilter,
  type LaserDmxTriggerTimingFilterMode,
} from './ReactTypes'
import { BEATS_PER_BAR } from './ReactTypes'
import { TRIGGER_TIMING_EVENT_SOURCES } from './renderers/LaserDmxModulationEngine'
import { laserDmxRouteConsumesCurve, laserDmxRouteConsumesSmoothing } from './laserDmxBeamMatrixParameterCapabilities'
import { CanvasAddEffectsControls, CanvasPerformanceAutomationControls, CanvasPresetFxControls, CanvasPresetMotionControls, CanvasPresetParticleControls, FracturesReactControls, LaserImageFxReactControls } from './ReactCanvasEngineShell'
import { ShiftgridReactControls } from './renderers/shiftgrid/ShiftgridControls'

// ── Source / target option lists ──────────────────────────────────────────────

const MOD_SOURCES = [
  // Band energies
  { value: 'bass',               label: 'Bass Energy'        },
  { value: 'nBass',              label: 'Normalized Bass'    },
  { value: 'mid',                label: 'Mid'                },
  { value: 'high',               label: 'High'               },
  { value: 'energy',             label: 'Energy'             },
  { value: 'energyShort',        label: 'Short-Term Energy'  },
  { value: 'spectralFlux',       label: 'Spectral Flux'      },
  // Percussive — continuous strength
  { value: 'transient',          label: 'Transient'          },
  { value: 'kick',               label: 'Kick Strength'      },
  { value: 'snare',              label: 'Snare Strength'     },
  { value: 'hat',                label: 'Hat Strength'       },
  // Percussive — one-shot hits
  { value: 'kickHit',            label: 'Kick Hit'           },
  { value: 'snareHit',           label: 'Snare Hit'          },
  { value: 'hatHit',             label: 'Hat Hit'            },
  { value: 'beat',               label: 'Beat Hit'           },
  { value: 'downbeat',           label: 'Downbeat Hit'       },
  // Rhythm / timing
  { value: 'beatPhase',          label: 'Beat Phase'         },
  { value: 'phrase4',            label: 'Phrase 4 Progress'  },
  { value: 'phrase4Hit',         label: 'Phrase 4 Hit'       },
  { value: 'phrase8',            label: 'Phrase 8 Progress'  },
  { value: 'phrase8Hit',         label: 'Phrase 8 Hit'       },
  { value: 'phrase16',           label: 'Phrase 16 Progress' },
  { value: 'phrase16Hit',        label: 'Phrase 16 Hit'      },
  { value: 'phrase32',           label: 'Phrase 32 Progress' },
  { value: 'phrase32Hit',        label: 'Phrase 32 Hit'      },
  // Section / structure
  { value: 'buildProgress',      label: 'Build Progress'     },
  { value: 'dropImpact',         label: 'Drop Impact'        },
  { value: 'sectionProgress',    label: 'Section Progress'   },
  { value: 'tension',            label: 'Tension'            },
  // Vocal / lyric
  { value: 'vocalActivity',      label: 'Vocal Activity'     },
  { value: 'wordHit',            label: 'Word Hit'           },
  // Harmonic
  { value: 'keyConfidence',      label: 'Key Confidence'     },
  { value: 'chordConfidence',    label: 'Chord Confidence'   },
  { value: 'harmonicConfidence', label: 'Harmonic Confidence'},
  // Other
  { value: 'complexity',         label: 'Complexity'         },
]

const CURVE_OPTIONS = [
  { value: 'linear',      label: 'Linear'      },
  { value: 'easeIn',      label: 'Ease In'     },
  { value: 'easeOut',     label: 'Ease Out'    },
  { value: 'easeInOut',   label: 'Ease In/Out' },
  { value: 'pulse',       label: 'Pulse'       },
  { value: 'exponential', label: 'Exponential' },
]

const MODE_OPTIONS = [
  { value: 'set',      label: 'Set'      },
  { value: 'add',      label: 'Add'      },
  { value: 'multiply', label: 'Multiply' },
  { value: 'trigger',  label: 'Trigger'  },
]

// ── Trigger timing filter UI ──────────────────────────────────────────────────

const TIMING_FILTER_MODE_OPTIONS: { value: LaserDmxTriggerTimingFilterMode; label: string }[] = [
  { value: 'everyOccurrence',  label: 'Every Occurrence'  },
  { value: 'specificPosition', label: 'Specific Bar'       },
  { value: 'specificBars',     label: 'Multiple Bars'      },
  { value: 'barRange',         label: 'Bar Range'          },
  { value: 'barInterval',      label: 'Every N Bars'       },
]

const DOWNBEAT_ONLY_SOURCES_UI = new Set(['downbeat', 'downbeatHit'])

const BEAT_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: 'any', label: 'Any Beat' },
  ...Array.from({ length: BEATS_PER_BAR }, (_, i) => ({
    value: String(i + 1),
    label: `Beat ${i + 1}`,
  })),
]

function TriggerTimingSection({
  filter,
  source,
  onChange,
}: {
  filter?:  LaserDmxTriggerTimingFilter
  source:   string
  onChange: (f: LaserDmxTriggerTimingFilter) => void
}) {
  const idPrefix      = useId()
  const mode           = filter?.mode ?? 'everyOccurrence'
  const isDownbeatOnly = DOWNBEAT_ONLY_SOURCES_UI.has(source)
  const [barsText, setBarsText] = useState(() => (filter?.bars ?? []).join(', '))

  useEffect(() => {
    setBarsText((filter?.bars ?? []).join(', '))
  }, [filter?.bars])

  const upd = (patch: Partial<LaserDmxTriggerTimingFilter>) =>
    onChange({ mode: 'everyOccurrence', ...filter, ...patch } as LaserDmxTriggerTimingFilter)

  const parseAndCommitBars = (value: string) => {
    const parsed = value
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1)
    const sorted = [...new Set(parsed)].sort((a, b) => a - b)
    const nextText = sorted.join(', ')
    setBarsText(nextText)
    upd({ bars: sorted })
  }

  return (
    <Collapsible label="Trigger Timing" defaultOpen={false}>
      <SelectRow
        label="Timing"
        value={mode}
        onChange={v => upd({ mode: v as LaserDmxTriggerTimingFilterMode })}
        options={TIMING_FILTER_MODE_OPTIONS}
      />

      {mode !== 'everyOccurrence' && (
        <p className="rv-ctrl-info">
          Bar numbers are counted from the analyzed beginning of the track. Requires BPM analysis.
        </p>
      )}

      {mode === 'specificPosition' && (
        <>
          <NumberInputRow
            id={`${idPrefix}-bar`}
            label="Bar"
            value={filter?.bar ?? 1}
            min={1}
            step={1}
            onChange={value => upd({ bar: Math.max(1, Math.round(value) || 1) })}
          />
          {isDownbeatOnly ? (
            <p className="rv-ctrl-info">Downbeat always fires on Beat 1.</p>
          ) : (
            <SelectRow
              label="Beat"
              value={filter?.beat != null ? String(filter.beat) : 'any'}
              onChange={v => upd({ beat: v === 'any' ? 'any' : (parseInt(v, 10) as number) })}
              options={BEAT_SELECT_OPTIONS}
            />
          )}
        </>
      )}

      {mode === 'specificBars' && (
        <>
          <TextInputRow
            id={`${idPrefix}-bars`}
            label="Bars"
            value={barsText}
            onChange={setBarsText}
            onBlur={parseAndCommitBars}
            placeholder="e.g. 17, 21, 25"
            inputMode="numeric"
            maxLength={64}
          />
          {(filter?.bars ?? []).length === 0 && (
            <p className="rv-ctrl-info">Enter comma-separated bar numbers.</p>
          )}
        </>
      )}

      {mode === 'barRange' && (
        <>
          <NumberInputRow
            id={`${idPrefix}-start-bar`}
            label="Start Bar"
            value={filter?.startBar ?? 1}
            min={1}
            step={1}
            onChange={value => upd({ startBar: Math.max(1, Math.round(value) || 1) })}
          />
          <NumberInputRow
            id={`${idPrefix}-end-bar`}
            label="End Bar"
            value={filter?.endBar ?? ''}
            min={1}
            step={1}
            placeholder="∞"
            onEmpty={() => upd({ endBar: undefined })}
            onChange={value => upd({ endBar: Math.max(1, Math.round(value) || 1) })}
          />
          <p className="rv-ctrl-info">Start and end are inclusive.</p>
        </>
      )}

      {mode === 'barInterval' && (
        <>
          <NumberInputRow
            id={`${idPrefix}-interval`}
            label="Every N bars"
            value={filter?.intervalBars ?? 4}
            min={1}
            step={1}
            onChange={value => upd({ intervalBars: Math.max(1, Math.round(value) || 1) })}
          />
          <NumberInputRow
            id={`${idPrefix}-anchor`}
            label="Anchor bar"
            value={filter?.intervalAnchorBar ?? 1}
            min={1}
            step={1}
            onChange={value => upd({ intervalAnchorBar: Math.max(1, Math.round(value) || 1) })}
          />
          <p className="rv-ctrl-info">
            Fires at: anchor, anchor+N, anchor+2N, …
          </p>
        </>
      )}
    </Collapsible>
  )
}

// ── Route row ─────────────────────────────────────────────────────────────────

function RouteRow({
  route,
  onChange,
  onDelete,
  sources = MOD_SOURCES,
  targets,
}: {
  route:    LaserDmxModulationRoute
  onChange: (patch: Partial<LaserDmxModulationRoute>) => void
  onDelete: () => void
  sources?: { value: string; label: string }[]
  targets: { value: string; label: string }[]
}) {
  const r = (key: keyof LaserDmxModulationRoute) => (route[key] as number)
  const isOffsetTarget = (route.target === 'originOffsetX' || route.target === 'originOffsetY' ||
    route.target === 'targetOffsetX' || route.target === 'targetOffsetY')
  return (
    <div className="rv-ldx-route">
      <div className="rv-ldx-route-header">
        <ToggleRow label="Route Enabled" value={route.enabled} onChange={v => onChange({ enabled: v })} />
        <button type="button" className="rv-glyph-item-del" title="Delete route" aria-label="Delete modulation route" onClick={onDelete}><AppIcon kind="delete" size={14} /></button>
      </div>
      <SelectRow label="Source" value={route.source} onChange={v => onChange({ source: v })} options={sources} />
      <SelectRow label="Target" value={route.target} onChange={v => onChange({ target: v as LaserDmxModulationRoute['target'] })} options={targets} />
      {laserDmxRouteConsumesCurve(route) && (
        <SelectRow label="Curve" value={route.curve} onChange={v => onChange({ curve: v as LaserDmxModulationRoute['curve'] })} options={CURVE_OPTIONS} />
      )}
      <SelectRow label="Mode"   value={route.mode}   onChange={v => onChange({ mode:   v as LaserDmxModulationRoute['mode']   })} options={MODE_OPTIONS} />
      <SliderRow label="Amount"    value={r('amount')}    onChange={v => onChange({ amount:    v })} min={0} max={1} step={0.01} color="#4ac7db" />
      <SliderRow label="Min"       value={r('min')}       onChange={v => onChange({ min:       v })} min={isOffsetTarget ? -1 : 0} max={1} step={0.01} color="#61d6aa" />
      <SliderRow label="Max"       value={r('max')}       onChange={v => onChange({ max:       v })} min={isOffsetTarget ? -1 : 0} max={1} step={0.01} color="#d8b95a" />
      {isOffsetTarget && (
        <p className="rv-ctrl-info">Offsets are relative to the rendered canvas. 0.10 moves the beam by 10% of the canvas dimension.</p>
      )}
      {laserDmxRouteConsumesSmoothing(route) && (
        <SliderRow label="Smoothing" value={r('smoothing')} onChange={v => onChange({ smoothing: v })} min={0} max={1} step={0.01} color="#b84fc9" />
      )}
      <SliderRow label="Attack"    value={r('attack')}    onChange={v => onChange({ attack:    v })} min={0} max={1} step={0.01} color="#61d6aa" />
      <SliderRow label="Release"   value={r('release')}   onChange={v => onChange({ release:   v })} min={0} max={1} step={0.01} color="#c0314a" />
      <ToggleRow label="Invert"    value={route.invert}   onChange={v => onChange({ invert:    v })} />
      {route.mode === 'trigger' && TRIGGER_TIMING_EVENT_SOURCES.has(route.source) && (
        <TriggerTimingSection
          filter={route.timingFilter}
          source={route.source}
          onChange={f => onChange({ timingFilter: f })}
        />
      )}
    </div>
  )
}

// ── Scope-specific Beam Matrix target lists ───────────────────────────────────
// Exported so tests and route validators can reference the canonical lists.

export const BM_GLOBAL_TARGETS = [
  { value: 'masterDimmer',     label: 'Master Dimmer'      },
  { value: 'backgroundFade',   label: 'Background Fade'    },
  { value: 'beamPersistence',  label: 'Beam Persistence'   },
  { value: 'globalBeamWidth',  label: 'Global Beam Width'  },
  { value: 'globalGlow',       label: 'Global Glow'        },
  { value: 'globalStrobeRate', label: 'Global Strobe Rate' },
  { value: 'fogDensity',       label: 'Fog Density'        },
  { value: 'fogOpacity',       label: 'Fog Opacity'        },
  { value: 'fogBeamScatter',   label: 'Fog Beam Scatter'   },
  { value: 'fogTurbulence',    label: 'Fog Turbulence'     },
]

export const BM_GROUP_TARGETS = [
  { value: 'dimmer',          label: 'Dimmer'          },
  { value: 'beamWidth',       label: 'Beam Width'      },
  { value: 'beamDivergence',  label: 'Beam Divergence' },
  { value: 'beamGlow',        label: 'Beam Glow'       },
  { value: 'strobeRate',      label: 'Strobe Rate'     },
]

export const BM_BEAM_TARGETS = [
  { value: 'dimmer',          label: 'Dimmer'          },
  { value: 'beamWidth',       label: 'Beam Width'      },
  { value: 'beamDivergence',  label: 'Beam Divergence' },
  { value: 'focus',           label: 'Focus'           },
  { value: 'beamGlow',        label: 'Beam Glow'       },
  { value: 'strobeRate',      label: 'Strobe Rate'     },
  { value: 'flickerAmount',   label: 'Flicker'         },
  { value: 'alpha',           label: 'Alpha'           },
  { value: 'red',             label: 'Red'             },
  { value: 'green',           label: 'Green'           },
  { value: 'blue',            label: 'Blue'            },
  { value: 'white',           label: 'White'           },
  { value: 'originOffsetX',   label: 'Origin Offset X' },
  { value: 'originOffsetY',   label: 'Origin Offset Y' },
  { value: 'targetOffsetX',   label: 'Target Offset X' },
  { value: 'targetOffsetY',   label: 'Target Offset Y' },
]

export function validateRouteTarget(target: string, scope: 'global' | 'group' | 'beam'): boolean {
  const list = scope === 'global' ? BM_GLOBAL_TARGETS
    : scope === 'group' ? BM_GROUP_TARGETS
    : BM_BEAM_TARGETS
  return list.some(t => t.value === target)
}

// ── Beam Matrix MOD panel ─────────────────────────────────────────────────────

type BmModScope = 'global' | 'group' | 'beam'

function LaserDmxBeamMatrixModPanel() {
  const [scope, setScope] = useState<BmModScope>('global')

  const {
    laserDmxBeamMatrix,
    addLaserDmxMatrixGlobalRoute,
    updateLaserDmxMatrixGlobalRoute,
    removeLaserDmxMatrixGlobalRoute,
    addLaserDmxReactionGroupRoute,
    updateLaserDmxReactionGroupRoute,
    removeLaserDmxReactionGroupRoute,
    addLaserDmxMatrixBeamRoute,
    updateLaserDmxMatrixBeamRoute,
    removeLaserDmxMatrixBeamRoute,
  } = useReactStore(useShallow(s => ({
    laserDmxBeamMatrix:                 s.laserDmxBeamMatrix,
    addLaserDmxMatrixGlobalRoute:        s.addLaserDmxMatrixGlobalRoute,
    updateLaserDmxMatrixGlobalRoute:     s.updateLaserDmxMatrixGlobalRoute,
    removeLaserDmxMatrixGlobalRoute:     s.removeLaserDmxMatrixGlobalRoute,
    addLaserDmxReactionGroupRoute:       s.addLaserDmxReactionGroupRoute,
    updateLaserDmxReactionGroupRoute:    s.updateLaserDmxReactionGroupRoute,
    removeLaserDmxReactionGroupRoute:    s.removeLaserDmxReactionGroupRoute,
    addLaserDmxMatrixBeamRoute:          s.addLaserDmxMatrixBeamRoute,
    updateLaserDmxMatrixBeamRoute:       s.updateLaserDmxMatrixBeamRoute,
    removeLaserDmxMatrixBeamRoute:       s.removeLaserDmxMatrixBeamRoute,
  })))

  const { beams, groups, selectedBeamIds, selectedGroupId, globalModulationRoutes } = laserDmxBeamMatrix

  const primaryBeam  = selectedBeamIds.length === 1 ? beams.find(b => b.id === selectedBeamIds[0]) ?? null : null
  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) ?? null : null

  const scopeOptions = [
    { value: 'global', label: 'Global Matrix'  },
    { value: 'group',  label: `Group${selectedGroup ? ': ' + selectedGroup.name : ''}` },
    { value: 'beam',   label: `Beam${primaryBeam ? ': ' + primaryBeam.name : ''}` },
  ]

  return (
    <>
      <Collapsible label="Scope" defaultOpen>
        <SelectRow
          label="Routes for"
          value={scope}
          onChange={v => setScope(v as BmModScope)}
          options={scopeOptions}
        />
      </Collapsible>

      {scope === 'global' && (
        <Collapsible label="Global Matrix Routes" defaultOpen>
          {globalModulationRoutes.length === 0 && (
            <div className="rv-ctrl-info">No global routes. Global routes apply to all beams.</div>
          )}
          {globalModulationRoutes.map(route => (
            <RouteRow
              key={route.id}
              route={route}
              sources={MOD_SOURCES}
              targets={BM_GLOBAL_TARGETS}
              onChange={patch => updateLaserDmxMatrixGlobalRoute(route.id, patch)}
              onDelete={() => removeLaserDmxMatrixGlobalRoute(route.id)}
            />
          ))}
          <IconChipButton style={{ marginTop: 6 }} onClick={addLaserDmxMatrixGlobalRoute}><AppIcon kind="plus" size={14} /> Add Global Route</IconChipButton>
        </Collapsible>
      )}

      {scope === 'group' && (
        <>
          {!selectedGroup ? (
            <Collapsible label="Group Routes" defaultOpen>
              <div className="rv-ctrl-info">Select a group in the ENGINE tab or Layers panel.</div>
            </Collapsible>
          ) : (
            <Collapsible label={`Routes — ${selectedGroup.name}`} defaultOpen>
              {selectedGroup.modulationRoutes.map(route => (
                <RouteRow
                  key={route.id}
                  route={route}
                  sources={MOD_SOURCES}
                  targets={BM_GROUP_TARGETS}
                  onChange={patch => updateLaserDmxReactionGroupRoute(selectedGroup.id, route.id, patch)}
                  onDelete={() => removeLaserDmxReactionGroupRoute(selectedGroup.id, route.id)}
                />
              ))}
              <IconChipButton style={{ marginTop: 6 }} onClick={() => addLaserDmxReactionGroupRoute(selectedGroup.id)}><AppIcon kind="plus" size={14} /> Add Group Route</IconChipButton>
            </Collapsible>
          )}
        </>
      )}

      {scope === 'beam' && (
        <>
          {selectedBeamIds.length > 1 && (
            <div className="rv-ctrl-info">Multiple beams selected. Select a single beam for detailed route editing.</div>
          )}
          {selectedBeamIds.length === 0 && (
            <div className="rv-ctrl-info">Select a beam in the editor or Layers panel.</div>
          )}
          {primaryBeam && (
            <Collapsible label={`Routes — ${primaryBeam.name}`} defaultOpen>
              {primaryBeam.modulationRoutes.map(route => (
                <RouteRow
                  key={route.id}
                  route={route}
                  sources={MOD_SOURCES}
                  targets={BM_BEAM_TARGETS}
                  onChange={patch => updateLaserDmxMatrixBeamRoute(primaryBeam.id, route.id, patch)}
                  onDelete={() => removeLaserDmxMatrixBeamRoute(primaryBeam.id, route.id)}
                />
              ))}
              <IconChipButton style={{ marginTop: 6 }} onClick={() => addLaserDmxMatrixBeamRoute(primaryBeam.id)}><AppIcon kind="plus" size={14} /> Add Beam Route</IconChipButton>
            </Collapsible>
          )}
        </>
      )}
    </>
  )
}

// ── MOD panel ─────────────────────────────────────────────────────────────────

export function ReactModulationPanel() {
  const activeReactEngineId = useReactStore(s => s.activeReactEngineId)

  // ── Shader: delegate to ConnectedShaderModulationPanel ───────────────────
  if (activeReactEngineId === 'shaderPads') {
    return <ConnectedShaderModulationPanel />
  }

  if (activeReactEngineId === 'cinematicPortal') {
    return <div className="rv-ctrl-group"><CinematicWorldsModulationControls /></div>
  }

  // ── LaserDMX: Beam Matrix modulation only ────────────────────────────────
  if (activeReactEngineId === 'laserDmx') {
    return <div className="rv-ctrl-group"><LaserDmxBeamMatrixModPanel /></div>
  }

  // ── CANVAS: preset control groups only (every other engine owns its own React panel). ────
  if (activeReactEngineId !== 'canvas') return null
  return (
    <div className="rv-ctrl-group">
      {/* Preset-specific control groups lead Routing for Particle Aura /
          Fractures / Laser Image FX. Each self-gates to its own preset and
          renders nothing for the base Clean Playback look. */}
      <FracturesReactControls />
      <LaserImageFxReactControls />
      <ShiftgridReactControls />
      <CanvasPresetParticleControls />
      <CanvasAddEffectsControls />
      <CanvasPerformanceAutomationControls />
      <CanvasPresetMotionControls />
      <CanvasPresetFxControls />
    </div>
  )
}
