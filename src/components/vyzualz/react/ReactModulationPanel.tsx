import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, SelectRow, ToggleRow, CtrlSection } from './ReactControlRows'
import type { OscillatorAudioDisplaceMode, LaserDmxModulationRoute } from './ReactTypes'

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

const MOD_TARGETS = [
  { value: 'masterDimmer',  label: 'Master Dimmer'  },
  { value: 'fixtureDimmer', label: 'Fixture Dimmer' },
  { value: 'red',           label: 'Red'            },
  { value: 'green',         label: 'Green'          },
  { value: 'blue',          label: 'Blue'           },
  { value: 'white',         label: 'White'          },
  { value: 'alpha',         label: 'Alpha'          },
  { value: 'pan',           label: 'Pan'            },
  { value: 'tilt',          label: 'Tilt'           },
  { value: 'rotation',      label: 'Rotation'       },
  { value: 'zoom',          label: 'Zoom'           },
  { value: 'beamWidth',     label: 'Beam Width'     },
  { value: 'strobeRate',    label: 'Strobe Rate'    },
  { value: 'scanSpeed',     label: 'Scan Speed'     },
  { value: 'pathProgress',  label: 'Path Progress'  },
  { value: 'pathScale',     label: 'Path Scale'     },
  { value: 'pathRotation',  label: 'Path Rotation'  },
  { value: 'pathSpread',    label: 'Path Spread'    },
  { value: 'pathRadius',    label: 'Path Radius'    },
  { value: 'pathComplexity',label: 'Path Complexity'},
  { value: 'hazeAmount',    label: 'Haze Amount'    },
  { value: 'glowAmount',    label: 'Glow Amount'    },
  { value: 'shutter',       label: 'Shutter'        },
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

// ── Starter routes factory ────────────────────────────────────────────────────

function starterRoutes(): LaserDmxModulationRoute[] {
  return [
    { id: crypto.randomUUID(), enabled: true,  source: 'kick',          target: 'fixtureDimmer', amount: 0.85, min: 0.35, max: 1,   curve: 'pulse',   mode: 'trigger',  smoothing: 0.1,  attack: 0.02, release: 0.25, invert: false },
    { id: crypto.randomUUID(), enabled: true,  source: 'snare',         target: 'strobeRate',    amount: 0.6,  min: 0,    max: 0.65, curve: 'pulse',   mode: 'trigger',  smoothing: 0,    attack: 0,    release: 0.2,  invert: false },
    { id: crypto.randomUUID(), enabled: true,  source: 'beatPhase',     target: 'pathProgress',  amount: 1,    min: 0,    max: 1,    curve: 'linear',  mode: 'set',      smoothing: 0,    attack: 0,    release: 0,    invert: false },
    { id: crypto.randomUUID(), enabled: true,  source: 'buildProgress', target: 'pathSpread',    amount: 1,    min: 0.2,  max: 1,    curve: 'easeOut', mode: 'set',      smoothing: 0.3,  attack: 0.1,  release: 0.5,  invert: false },
    { id: crypto.randomUUID(), enabled: true,  source: 'dropImpact',    target: 'masterDimmer',  amount: 1,    min: 0.65, max: 1,    curve: 'pulse',   mode: 'trigger',  smoothing: 0,    attack: 0,    release: 0.3,  invert: false },
    { id: crypto.randomUUID(), enabled: false, source: 'vocalActivity', target: 'blue',          amount: 0.7,  min: 0.3,  max: 1,    curve: 'easeOut', mode: 'set',      smoothing: 0.4,  attack: 0.1,  release: 0.6,  invert: false },
  ]
}

// ── Route row ─────────────────────────────────────────────────────────────────

function RouteRow({
  route,
  onChange,
  onDelete,
  sources = MOD_SOURCES,
  targets = MOD_TARGETS,
}: {
  route:    LaserDmxModulationRoute
  onChange: (patch: Partial<LaserDmxModulationRoute>) => void
  onDelete: () => void
  sources?: { value: string; label: string }[]
  targets?: { value: string; label: string }[]
}) {
  const r = (key: keyof LaserDmxModulationRoute) => (route[key] as number)
  return (
    <div className="rv-ldx-route">
      <div className="rv-ldx-route-header">
        <ToggleRow label="On" value={route.enabled} onChange={v => onChange({ enabled: v })} />
        <button type="button" className="rv-glyph-item-del" title="Delete route" onClick={onDelete}>×</button>
      </div>
      <SelectRow label="Source" value={route.source} onChange={v => onChange({ source: v })} options={sources} />
      <SelectRow label="Target" value={route.target} onChange={v => onChange({ target: v as LaserDmxModulationRoute['target'] })} options={targets} />
      <SelectRow label="Curve"  value={route.curve}  onChange={v => onChange({ curve:  v as LaserDmxModulationRoute['curve']  })} options={CURVE_OPTIONS} />
      <SelectRow label="Mode"   value={route.mode}   onChange={v => onChange({ mode:   v as LaserDmxModulationRoute['mode']   })} options={MODE_OPTIONS} />
      <SliderRow label="Amount"    value={r('amount')}    onChange={v => onChange({ amount:    v })} min={0} max={1} step={0.01} color="#4ac7db" />
      <SliderRow label="Min"       value={r('min')}       onChange={v => onChange({ min:       v })} min={0} max={1} step={0.01} color="#61d6aa" />
      <SliderRow label="Max"       value={r('max')}       onChange={v => onChange({ max:       v })} min={0} max={1} step={0.01} color="#d8b95a" />
      <SliderRow label="Smoothing" value={r('smoothing')} onChange={v => onChange({ smoothing: v })} min={0} max={1} step={0.01} color="#b84fc9" />
      <SliderRow label="Attack"    value={r('attack')}    onChange={v => onChange({ attack:    v })} min={0} max={1} step={0.01} color="#61d6aa" />
      <SliderRow label="Release"   value={r('release')}   onChange={v => onChange({ release:   v })} min={0} max={1} step={0.01} color="#c0314a" />
      <ToggleRow label="Invert"    value={route.invert}   onChange={v => onChange({ invert:    v })} />
    </div>
  )
}

// ── LaserDMX Modulation sub-panel ─────────────────────────────────────────────

function LaserDmxModPanel() {
  const {
    laserDmxSettings,
    addLaserModulationRoute,
    updateLaserModulationRoute,
    removeLaserModulationRoute,
    updateLaserFixture,
  } = useReactStore(useShallow(s => ({
    laserDmxSettings:            s.laserDmxSettings,
    addLaserModulationRoute:     s.addLaserModulationRoute,
    updateLaserModulationRoute:  s.updateLaserModulationRoute,
    removeLaserModulationRoute:  s.removeLaserModulationRoute,
    updateLaserFixture:          s.updateLaserFixture,
  })))

  const { fixtures, selectedFixtureId } = laserDmxSettings
  const fixture = fixtures.find(f => f.id === selectedFixtureId) ?? null
  const fid = fixture?.id ?? ''

  if (!fixture) {
    return (
      <>
        <CtrlSection label="Modulation Routes" />
        <div className="rv-ctrl-info">Select or add a laser fixture to edit modulation routes.</div>
      </>
    )
  }

  const routes = fixture.modulationRoutes

  return (
    <>
      <CtrlSection label={`Routes — ${fixture.name}`} />
      {routes.length === 0 && (
        <>
          <div className="rv-ctrl-info">No modulation routes. Add starter routes or add one manually.</div>
          <button
            type="button"
            className="rv-glyph-upload-btn"
            onClick={() => updateLaserFixture(fid, { modulationRoutes: starterRoutes() })}
          >
            Add Starter Routes
          </button>
        </>
      )}
      {routes.map(route => (
        <RouteRow
          key={route.id}
          route={route}
          onChange={patch => updateLaserModulationRoute(fid, route.id, patch)}
          onDelete={() => removeLaserModulationRoute(fid, route.id)}
        />
      ))}
      <button
        type="button"
        className="rv-glyph-upload-btn"
        style={{ marginTop: 6 }}
        onClick={() => addLaserModulationRoute(fid)}
      >
        + Add Mod Route
      </button>
    </>
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
      <CtrlSection label="Scope" />
      <SelectRow
        label="Routes for"
        value={scope}
        onChange={v => setScope(v as BmModScope)}
        options={scopeOptions}
      />

      {scope === 'global' && (
        <>
          <CtrlSection label="Global Matrix Routes" />
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
        </>
      )}

      {scope === 'group' && (
        <>
          {!selectedGroup ? (
            <>
              <CtrlSection label="Group Routes" />
              <div className="rv-ctrl-info">Select a group in the ENGINE tab or Layers panel.</div>
            </>
          ) : (
            <>
              <CtrlSection label={`Routes — ${selectedGroup.name}`} />
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
            </>
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
            <>
              <CtrlSection label={`Routes — ${primaryBeam.name}`} />
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
            </>
          )}
        </>
      )}
    </>
  )
}

// ── MOD panel ─────────────────────────────────────────────────────────────────

export function ReactModulationPanel() {
  const {
    activeReactEngineId,
    laserDmxWorkspaceMode,
    oscillatorSettings, setOscillatorSettings,
  } = useReactStore(useShallow(s => ({
    activeReactEngineId:   s.activeReactEngineId,
    laserDmxWorkspaceMode: s.laserDmxWorkspaceMode,
    oscillatorSettings:    s.oscillatorSettings,
    setOscillatorSettings: s.setOscillatorSettings,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  const isSoundDrawing = activeReactEngineId === 'oscilloscope'
  const isLaserDmx     = activeReactEngineId === 'laserDmx'

  // ── LaserDMX: branch by workspace mode ───────────────────────────────────
  if (isLaserDmx) {
    return (
      <div className="rv-ctrl-group">
        {laserDmxWorkspaceMode === 'beamMatrix'
          ? <LaserDmxBeamMatrixModPanel />
          : <LaserDmxModPanel />
        }
      </div>
    )
  }

  // ── Non-oscilloscope engines: no per-frequency routing exists yet ──────────
  if (!isSoundDrawing) {
    return (
      <div className="rv-ctrl-group">
        <CtrlSection label="Audio Routing" />
        <div className="rv-ctrl-info">
          This engine currently uses global intensity/motion controls only.
          Adjust Bass React and Motion in the FX tab for broad audio response.
        </div>
      </div>
    )
  }

  // ── Oscilloscope: full per-frequency routing ──────────────────────────────
  return (
    <div className="rv-ctrl-group">
      <CtrlSection label="Audio Reactivity" />
      <SelectRow
        label="Displace Mode"
        value={osc.audioDisplaceMode}
        onChange={v => set({ audioDisplaceMode: v as OscillatorAudioDisplaceMode })}
        options={[
          { value: 'normal',  label: 'Normal'  },
          { value: 'radial',  label: 'Radial'  },
          { value: 'tangent', label: 'Tangent' },
          { value: 'xy',      label: 'XY'      },
        ]}
      />
      <SliderRow label="Displacement" value={osc.audioDisplacement} onChange={v => set({ audioDisplacement: v })} color="#4ac7db" />

      {osc.sourceType === 'text' && (
        <>
          <CtrlSection label="Text Waveform Distortion" />
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
        </>
      )}

      <CtrlSection label="Frequency Response" />
      <SliderRow label="Bass → Scale"  value={osc.bassScale}  onChange={v => set({ bassScale:  v })} color="#d8b95a" />
      <SliderRow label="Mid → Twist"   value={osc.midTwist}   onChange={v => set({ midTwist:   v })} color="#61d6aa" />
      <SliderRow label="High → Jitter" value={osc.highJitter} onChange={v => set({ highJitter: v })} color="#b84fc9" />
      <SliderRow label="Beat → Bloom"  value={osc.beatBloom}  onChange={v => set({ beatBloom:  v })} color="#c0314a" />
    </div>
  )
}
