import { useEffect, useId, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { ConnectedShaderModulationPanel } from './shaders/ui/ConnectedShaderModulationPanel'
import { CinematicWorldsModulationControls } from './CinematicWorldsControls'
import { SliderRow, NumberInputRow, SelectRow, TextInputRow, ToggleRow, Collapsible } from './ReactControlRows'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { HelpInfoTrigger } from '../../shared/InfoPopover'
import {
  type OscillatorAudioDisplaceMode,
  type OscillatorTextLetterReactionMode,
  type LetterReactionAssignment,
  type LetterReactionSource,
  type LetterReactionTarget,
  type LaserDmxModulationRoute,
  type LaserDmxTriggerTimingFilter,
  type LaserDmxTriggerTimingFilterMode,
} from './ReactTypes'
import { BEATS_PER_BAR } from './ReactTypes'
import { TRIGGER_TIMING_EVENT_SOURCES } from './renderers/LaserDmxModulationEngine'

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

const SOUND_DRAWING_DISPLACE_MODE_OPTIONS: Array<{
  value: OscillatorAudioDisplaceMode
  label: string
}> = [
  { value: 'normal',  label: 'Normal'  },
  { value: 'radial',  label: 'Radial'  },
  { value: 'tangent', label: 'Tangent' },
  { value: 'xy',      label: 'XY'      },
]

function formatSoundDrawingPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function getSoundDrawingDisplaceModeLabel(value: OscillatorAudioDisplaceMode): string {
  return SOUND_DRAWING_DISPLACE_MODE_OPTIONS.find((option) => option.value === value)?.label ?? 'Normal'
}

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
        <button type="button" className="rv-glyph-item-del" title="Delete route" aria-label="Delete modulation route" onClick={onDelete}>×</button>
      </div>
      <SelectRow label="Source" value={route.source} onChange={v => onChange({ source: v })} options={sources} />
      <SelectRow label="Target" value={route.target} onChange={v => onChange({ target: v as LaserDmxModulationRoute['target'] })} options={targets} />
      <SelectRow label="Curve"  value={route.curve}  onChange={v => onChange({ curve:  v as LaserDmxModulationRoute['curve']  })} options={CURVE_OPTIONS} />
      <SelectRow label="Mode"   value={route.mode}   onChange={v => onChange({ mode:   v as LaserDmxModulationRoute['mode']   })} options={MODE_OPTIONS} />
      <SliderRow label="Amount"    value={r('amount')}    onChange={v => onChange({ amount:    v })} min={0} max={1} step={0.01} color="#4ac7db" />
      <SliderRow label="Min"       value={r('min')}       onChange={v => onChange({ min:       v })} min={isOffsetTarget ? -1 : 0} max={1} step={0.01} color="#61d6aa" />
      <SliderRow label="Max"       value={r('max')}       onChange={v => onChange({ max:       v })} min={isOffsetTarget ? -1 : 0} max={1} step={0.01} color="#d8b95a" />
      {isOffsetTarget && (
        <p className="rv-ctrl-info">Offsets are relative to the rendered canvas. 0.10 moves the beam by 10% of the canvas dimension.</p>
      )}
      <SliderRow label="Smoothing" value={r('smoothing')} onChange={v => onChange({ smoothing: v })} min={0} max={1} step={0.01} color="#b84fc9" />
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
          <button type="button" className="rv-glyph-upload-btn" style={{ marginTop: 6 }} onClick={addLaserDmxMatrixGlobalRoute}>
            + Add Global Route
          </button>
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
              <button type="button" className="rv-glyph-upload-btn" style={{ marginTop: 6 }} onClick={() => addLaserDmxReactionGroupRoute(selectedGroup.id)}>
                + Add Group Route
              </button>
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
              <button type="button" className="rv-glyph-upload-btn" style={{ marginTop: 6 }} onClick={() => addLaserDmxMatrixBeamRoute(primaryBeam.id)}>
                + Add Beam Route
              </button>
            </Collapsible>
          )}
        </>
      )}
    </>
  )
}

// ── Custom letter assignment editor ──────────────────────────────────────────

const LETTER_SOURCE_OPTIONS: { value: LetterReactionSource; label: string }[] = [
  { value: 'bass', label: 'Bass'  },
  { value: 'mid',  label: 'Mid'   },
  { value: 'high', label: 'High'  },
  { value: 'beat', label: 'Beat'  },
]

const LETTER_TARGET_OPTIONS: { value: LetterReactionTarget; label: string }[] = [
  { value: 'scale',    label: 'Scale'    },
  { value: 'rotation', label: 'Rotation' },
  { value: 'offsetX',  label: 'Offset X' },
  { value: 'offsetY',  label: 'Offset Y' },
  { value: 'jitter',   label: 'Jitter'   },
]

const DEFAULT_ASSIGNMENT: Omit<LetterReactionAssignment, 'characterIndex'> = {
  source: 'bass', target: 'scale', amount: 0.5, invert: false, phaseOffset: 0,
}

export function LetterAssignmentEditor({
  text,
  assignments,
  onChange,
}: {
  text:        string
  assignments: LetterReactionAssignment[]
  onChange:    (next: LetterReactionAssignment[]) => void
}) {
  const [selIdx, setSelIdx] = useState<number | null>(null)

  const chars = Array.from(text)

  // Count how many times each character has appeared before position ci
  function repeatNum(ci: number): number | null {
    const ch = chars[ci]
    const prev = chars.slice(0, ci).filter(c => c === ch).length
    const total = chars.filter(c => c === ch).length
    return total > 1 ? prev + 1 : null
  }

  function getAssignment(ci: number): LetterReactionAssignment | undefined {
    return assignments.find(a => a.characterIndex === ci)
  }

  function setAssignment(patch: Partial<LetterReactionAssignment> & { characterIndex: number }) {
    const next = assignments.filter(a => a.characterIndex !== patch.characterIndex)
    next.push({ ...DEFAULT_ASSIGNMENT, ...getAssignment(patch.characterIndex), ...patch })
    onChange(next)
  }

  function clearAssignment(ci: number) {
    onChange(assignments.filter(a => a.characterIndex !== ci))
  }

  function copyToAll(ci: number) {
    const src = getAssignment(ci)
    if (!src) return
    const nonWs = chars.reduce<number[]>((acc, ch, i) => {
      if (ch.trim() !== '') acc.push(i)
      return acc
    }, [])
    const rest = assignments.filter(a => !nonWs.includes(a.characterIndex))
    onChange([
      ...rest,
      ...nonWs.map(i => ({ ...src, characterIndex: i })),
    ])
  }

  const sel = selIdx != null ? selIdx : null
  const selAsgn = sel != null ? getAssignment(sel) : undefined

  return (
    <>
      <div className="rv-letter-row">
        {chars.map((ch, ci) => {
          if (ch.trim() === '') return null
          const isSel = selIdx === ci
          const hasCfg = !!getAssignment(ci)
          const rn = repeatNum(ci)
          return (
            <button
              key={ci}
              type="button"
              className={[
                'rv-letter-btn',
                isSel  ? 'rv-letter-btn--sel' : '',
                hasCfg ? 'rv-letter-btn--cfg' : '',
              ].join(' ').trim()}
              onClick={() => setSelIdx(isSel ? null : ci)}
              title={`Character ${ci}: ${ch}`}
            >
              {ch}{rn != null && <sup>{rn}</sup>}
            </button>
          )
        })}
      </div>

      {sel != null && (
        <>
          <SelectRow
            label="Source"
            value={selAsgn?.source ?? DEFAULT_ASSIGNMENT.source}
            onChange={v => setAssignment({ characterIndex: sel, source: v as LetterReactionSource })}
            options={LETTER_SOURCE_OPTIONS}
          />
          <SelectRow
            label="Target"
            value={selAsgn?.target ?? DEFAULT_ASSIGNMENT.target}
            onChange={v => setAssignment({ characterIndex: sel, target: v as LetterReactionTarget })}
            options={LETTER_TARGET_OPTIONS}
          />
          <SliderRow
            label="Amount"
            value={selAsgn?.amount ?? DEFAULT_ASSIGNMENT.amount}
            onChange={v => setAssignment({ characterIndex: sel, amount: v })}
            min={0} max={2} step={0.01}
            color="#4ac7db"
          />
          <ToggleRow
            label="Invert"
            value={selAsgn?.invert ?? DEFAULT_ASSIGNMENT.invert}
            onChange={v => setAssignment({ characterIndex: sel, invert: v })}
          />
          <SliderRow
            label="Phase"
            value={selAsgn?.phaseOffset ?? DEFAULT_ASSIGNMENT.phaseOffset}
            onChange={v => setAssignment({ characterIndex: sel, phaseOffset: v })}
            min={-0.5} max={0.5} step={0.01}
            color="#b84fc9"
          />
          <div className="rv-letter-actions">
            <button
              type="button"
              className="rv-glyph-upload-btn"
              onClick={() => copyToAll(sel)}
              disabled={!selAsgn}
            >
              Copy to All
            </button>
            <button
              type="button"
              className="rv-glyph-upload-btn"
              onClick={() => { clearAssignment(sel); setSelIdx(null) }}
              disabled={!selAsgn}
            >
              Clear Letter
            </button>
          </div>
        </>
      )}

      <div className="rv-letter-actions">
        <button
          type="button"
          className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
          onClick={() => { onChange([]); setSelIdx(null) }}
          disabled={assignments.length === 0}
        >
          Reset All
        </button>
      </div>
    </>
  )
}

// ── MOD panel ─────────────────────────────────────────────────────────────────

export function ReactModulationPanel() {
  const {
    activeReactEngineId,
    oscillatorSettings, setOscillatorSettings,
  } = useReactStore(useShallow(s => ({
    activeReactEngineId:   s.activeReactEngineId,
    oscillatorSettings:    s.oscillatorSettings,
    setOscillatorSettings: s.setOscillatorSettings,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  const isSoundDrawing = activeReactEngineId === 'oscilloscope'
  const isCinematic    = activeReactEngineId === 'cinematicPortal'
  const isLaserDmx     = activeReactEngineId === 'laserDmx'

  // ── Shader: delegate to ConnectedShaderModulationPanel ───────────────────
  if (activeReactEngineId === 'shaderPads') {
    return <ConnectedShaderModulationPanel />
  }

  if (isCinematic) {
    return <div className="rv-ctrl-group"><CinematicWorldsModulationControls /></div>
  }

  // ── LaserDMX: Beam Matrix modulation only ────────────────────────────────
  if (isLaserDmx) {
    return <div className="rv-ctrl-group"><LaserDmxBeamMatrixModPanel /></div>
  }

  // ── Non-oscilloscope engines: no per-frequency routing exists yet ──────────
  if (!isSoundDrawing) {
    return (
      <div className="rv-ctrl-group">
        <Collapsible label="Audio Routing" defaultOpen>
          <div className="rv-ctrl-info">
            This engine currently uses global intensity/motion controls only.
            Adjust Bass React and Motion in the FX tab for broad audio response.
          </div>
        </Collapsible>
      </div>
    )
  }

  // ── Oscilloscope: full per-frequency routing ──────────────────────────────
  return (
    <div className="rv-ctrl-group">
      <Collapsible label="Audio Reactivity" defaultOpen>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <div className="rv-ctrl-row">
            <Dropdown
              id="sound-drawing-displace-mode"
              label="Displace Mode"
              menuLabel="Displace Modes"
              value={osc.audioDisplaceMode}
              onChange={v => set({ audioDisplaceMode: v as OscillatorAudioDisplaceMode })}
              options={SOUND_DRAWING_DISPLACE_MODE_OPTIONS}
              size="compact"
            />
          </div>
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.displaceMode"
            currentValue={getSoundDrawingDisplaceModeLabel(osc.audioDisplaceMode)}
            placement="left"
          />
        </div>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <SliderRow label="Displacement" value={osc.audioDisplacement} onChange={v => set({ audioDisplacement: v })} color="#4ac7db" />
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.displacement"
            currentValue={formatSoundDrawingPercent(osc.audioDisplacement)}
            placement="left"
          />
        </div>
      </Collapsible>

      {osc.sourceType === 'text' && (
        <>
          <Collapsible label="Text Letter Motion" defaultOpen>
            <SelectRow
              label="Letter Reaction"
              value={osc.textLetterReactionMode}
              onChange={v => set({ textLetterReactionMode: v as OscillatorTextLetterReactionMode })}
              options={[
                { value: 'uniform',        label: 'Uniform'         },
                { value: 'alternating',    label: 'Alternating'     },
                { value: 'frequencySplit', label: 'Frequency Split' },
                { value: 'ripple',         label: 'Ripple'          },
                { value: 'custom',         label: 'Custom'          },
              ]}
            />
            {osc.textLetterReactionMode === 'custom' && (
              <LetterAssignmentEditor
                text={osc.text}
                assignments={osc.textLetterAssignments}
                onChange={next => set({ textLetterAssignments: next })}
              />
            )}
          </Collapsible>
          <Collapsible label="Text Waveform Distortion" defaultOpen>
            <SelectRow
              label="Text Wave"
              value={osc.textWaveformMode}
              onChange={v => set({ textWaveformMode: v as import('./ReactTypes').OscillatorTextWaveformMode })}
              options={[
                { value: 'off',     label: 'Off'     },
                { value: 'normal',  label: 'Normal'  },
                { value: 'radial',  label: 'Radial'  },
                { value: 'tangent', label: 'Tangent' },
                { value: 'xy',      label: 'XY'      },
              ]}
            />
            <SliderRow label="Text Wave Amount" value={osc.textWaveformAmount} onChange={v => set({ textWaveformAmount: v })} min={0} max={0.30} step={0.005} color="#4ac7db" />
            <SliderRow label="Text Wave Cycles" value={osc.textWaveformCycles} onChange={v => set({ textWaveformCycles: v })} min={1} max={16} step={1} color="#61d6aa" />
            <SliderRow label="Text Wave Scroll" value={osc.textWaveformScroll} onChange={v => set({ textWaveformScroll: v })} min={0} max={2} step={0.01} color="#b84fc9" />
          </Collapsible>
        </>
      )}

      <Collapsible label="Frequency Response" defaultOpen>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <SliderRow label="Bass → Scale" value={osc.bassScale} onChange={v => set({ bassScale: v })} color="#d8b95a" />
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.bassScale"
            currentValue={formatSoundDrawingPercent(osc.bassScale)}
            placement="left"
          />
        </div>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <SliderRow label="Mid → Twist" value={osc.midTwist} onChange={v => set({ midTwist: v })} color="#61d6aa" />
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.midTwist"
            currentValue={formatSoundDrawingPercent(osc.midTwist)}
            placement="left"
          />
        </div>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <ToggleRow
            label="Alternate"
            value={osc.altTwist}
            onChange={v => set({ altTwist: v })}
            title="Randomly alternate twist direction on each beat"
          />
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.alternate"
            currentValue={osc.altTwist ? 'On' : 'Off'}
            currentValueLabel="Status"
            currentValueTone={osc.altTwist ? 'accent' : 'default'}
            placement="left"
          />
        </div>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <SliderRow label="High → Jitter" value={osc.highJitter} onChange={v => set({ highJitter: v })} color="#b84fc9" />
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.highJitter"
            currentValue={formatSoundDrawingPercent(osc.highJitter)}
            placement="left"
          />
        </div>
        <div className="rv-sound-drawing-react-control-help drm-help-overlay-anchor">
          <SliderRow label="Beat → Bloom" value={osc.beatBloom} onChange={v => set({ beatBloom: v })} color="#c0314a" />
          <HelpInfoTrigger
            helpId="react.soundDrawing.audioReactivity.beatBloom"
            currentValue={formatSoundDrawingPercent(osc.beatBloom)}
            placement="left"
          />
        </div>
      </Collapsible>
    </div>
  )
}
