import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { useOctaLive } from './XyScopeOctaLive'
import {
  DEFAULT_OCTA_SETTINGS, OCTA_BEAM_CONTROLS, OCTA_DEFAULTS, OCTA_MASTER_CONTROLS, OCTA_REACT_CONTROLS, OCTA_SHAPE_CONTROLS, type OctaControlSpec, type OctaValues,
} from './XyScopeOctaSettings'

function formatControl(spec: OctaControlSpec): (value: number) => string {
  switch (spec.format) {
    case 'percent': return value => `${Math.round(value * 100)}%`
    case 'degrees': return value => `${Math.round(value)}°`
    case 'ms': return value => `${Math.round(value)} ms`
    case 'Hz': return value => `${Math.round(value)} Hz`
    case 'px': return value => `${value.toFixed(2)} px`
    default: return value => value.toFixed(2)
  }
}

const SOURCE_LABELS = { stereo: 'LIVE STEREO', mono: 'LIVE MONO', shared: 'SHARED ANALYSIS', none: 'NO SIGNAL' } as const

/** OCTA inspector, under the four standard parent groups: Master Controls, Design, React and Palette. */
export function XyScopeOctaDesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const live = useOctaLive()
  const o = settings.octa
  const patch = (next: Partial<typeof o>) => setSettings({ octa: { ...o, ...next } })
  const setValue = (id: keyof OctaValues, value: number | string | boolean) => patch({ values: { ...o.values, [id]: value } })

  const slider = (spec: OctaControlSpec) => (
    <SliderRow key={spec.id} id={`xyscope-octa-${spec.id}`} label={spec.label} value={o.values[spec.id]} min={spec.min} max={spec.max} step={spec.step}
      resetValue={OCTA_DEFAULTS[spec.id]} formatValue={formatControl(spec)} description={spec.description} onChange={value => setValue(spec.id, value)} />
  )
  const kv = (label: string, value: string) => (
    <div className="vz-mi-kv-row" key={label}>
      <span className="vz-mi-kv-label">{label}</span>
      <span className="vz-mi-kv-val vz-mi-kv-val--tag">{value}</span>
    </div>
  )

  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-octa-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design react palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              {OCTA_MASTER_CONTROLS.map(slider)}
              <ToggleRow id="xyscope-octa-auto" label="Auto Performance" value={o.autoPerformance} onChange={autoPerformance => patch({ autoPerformance })}
                description="Audio intelligence adds to the energy on builds and drops, so the figure is pushed further through its distortions at the moments that call for it." />
              {kv('Distortion', live?.state ?? 'CLEAN')}
              {kv('Energy', `${Math.round((live?.energy ?? 0) * 100)}%`)}
              {o.autoPerformance && <>
                {kv('Conductor', live?.conductor ?? 'LISTENING')}
                {kv('Evidence', `${live?.mapped ? 'TRACK + LIVE' : 'LIVE'} · ${Math.round((live?.confidence ?? 0) * 100)}%`)}
              </>}
              {kv('Signal', SOURCE_LABELS[live?.source ?? 'none'])}
              <ToggleRow id="xyscope-octa-hold" label="Hold Trace" value={o.hold} onChange={hold => patch({ hold })} description="Freezes the displayed trace while audio and analysis continue." />
            </div>
          </Collapsible>

          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <Collapsible label="Cluster"><div data-xyscope-subgroup="Cluster" style={{ display: 'contents' }}>
                {OCTA_SHAPE_CONTROLS.map(slider)}
                <ToggleRow id="xyscope-octa-axes" label="Axis Lines" value={o.values.axes} onChange={axes => setValue('axes', axes)} description="Draws the three lines through each octahedron's centre." />
              </div></Collapsible>
              <Collapsible label="Beam & Phosphor"><div data-xyscope-subgroup="Beam & Phosphor" style={{ display: 'contents' }}>{OCTA_BEAM_CONTROLS.map(slider)}</div></Collapsible>
            </div>
          </Collapsible>

          <Collapsible label="React" icon={<AppIcon kind="waveform" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="react" style={{ display: 'contents' }}>
              {OCTA_REACT_CONTROLS.map(slider)}
              <div className="rv-ctrl-info">As the track's energy climbs the cluster passes through its distortions in order: it stays clean, then the octahedra tumble apart, the beam overshoots into loops, the cluster pulls into a cage of rings, and at the top the lines break into bright dots.</div>
            </div>
          </Collapsible>

          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} color="currentColor" />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              <PaletteColorRow id="xyscope-octa-color" label="Beam Color" value={o.values.color} onChange={color => setValue('color', color)} description="Colour of the phosphor line. Its brightest parts burn toward white." />
              <PaletteColorRow id="xyscope-octa-glow-color" label="Glow Color" value={o.values.glowColor} onChange={color => setValue('glowColor', color)} description="Colour of the halo around the lines." />
              <PaletteColorRow id="xyscope-octa-background" label="Background" value={o.values.backgroundColor} onChange={color => setValue('backgroundColor', color)} description="Colour of the screen behind the beam." />
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => patch({ resetSignals: o.resetSignals + 1 })}>Reset Signals</IconChipButton>
          <IconChipButton onClick={() => setSettings({ octa: { ...DEFAULT_OCTA_SETTINGS, resetSignals: o.resetSignals + 1 } })}>Reset OCTA</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
