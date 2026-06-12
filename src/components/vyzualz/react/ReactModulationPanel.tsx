import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, SelectRow, ToggleRow, CtrlSection } from './ReactControlRows'
import type { OscillatorAudioDisplaceMode, LaserDmxModulationRoute } from './ReactTypes'

// ── Source / target option lists ──────────────────────────────────────────────

const MOD_SOURCES = [
  { value: 'bass',               label: 'Bass'              },
  { value: 'mid',                label: 'Mid'               },
  { value: 'high',               label: 'High'              },
  { value: 'energy',             label: 'Energy'            },
  { value: 'transient',          label: 'Transient'         },
  { value: 'kick',               label: 'Kick'              },
  { value: 'snare',              label: 'Snare'             },
  { value: 'hat',                label: 'Hat'               },
  { value: 'beat',               label: 'Beat'              },
  { value: 'downbeat',           label: 'Downbeat'          },
  { value: 'beatPhase',          label: 'Beat Phase'        },
  { value: 'phrase4',            label: 'Phrase 4'          },
  { value: 'phrase16',           label: 'Phrase 16'         },
  { value: 'phrase32',           label: 'Phrase 32'         },
  { value: 'buildProgress',      label: 'Build Progress'    },
  { value: 'dropImpact',         label: 'Drop Impact'       },
  { value: 'vocalActivity',      label: 'Vocal Activity'    },
  { value: 'wordHit',            label: 'Word Hit'          },
  { value: 'keyConfidence',      label: 'Key Confidence'    },
  { value: 'chordConfidence',    label: 'Chord Confidence'  },
  { value: 'tension',            label: 'Tension'           },
  { value: 'complexity',         label: 'Complexity'        },
  { value: 'sectionProgress',    label: 'Section Progress'  },
  { value: 'spectralFlux',       label: 'Spectral Flux'     },
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
}: {
  route:    LaserDmxModulationRoute
  onChange: (patch: Partial<LaserDmxModulationRoute>) => void
  onDelete: () => void
}) {
  const r = (key: keyof LaserDmxModulationRoute) => (route[key] as number)
  return (
    <div className="rv-ldx-route">
      <div className="rv-ldx-route-header">
        <ToggleRow label="On" value={route.enabled} onChange={v => onChange({ enabled: v })} />
        <button type="button" className="rv-glyph-item-del" title="Delete route" onClick={onDelete}>×</button>
      </div>
      <SelectRow label="Source" value={route.source} onChange={v => onChange({ source: v })} options={MOD_SOURCES} />
      <SelectRow label="Target" value={route.target} onChange={v => onChange({ target: v as LaserDmxModulationRoute['target'] })} options={MOD_TARGETS} />
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
  const isLaserDmx     = activeReactEngineId === 'laserDmx'

  // ── LaserDMX: per-fixture modulation matrix ───────────────────────────────
  if (isLaserDmx) {
    return (
      <div className="rv-ctrl-group">
        <LaserDmxModPanel />
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

      <CtrlSection label="Frequency Response" />
      <SliderRow label="Bass → Scale"  value={osc.bassScale}  onChange={v => set({ bassScale:  v })} color="#d8b95a" />
      <SliderRow label="Mid → Twist"   value={osc.midTwist}   onChange={v => set({ midTwist:   v })} color="#61d6aa" />
      <SliderRow label="High → Jitter" value={osc.highJitter} onChange={v => set({ highJitter: v })} color="#b84fc9" />
      <SliderRow label="Beat → Bloom"  value={osc.beatBloom}  onChange={v => set({ beatBloom:  v })} color="#c0314a" />
    </div>
  )
}
