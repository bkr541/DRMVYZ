import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { OSC2_DEFAULTS } from './XyScopeOsc2Engine'
import { useOsc2Live } from './XyScopeOsc2Live'
import {
  DEFAULT_OSC2_SETTINGS,
  OSC2_BEAM_CONTROLS,
  OSC2_CAMERA_CONTROLS,
  OSC2_REACT_CONTROLS,
  OSC2_SCENE_CONTROLS,
  type Osc2ControlSpec,
} from './XyScopeOsc2Settings'

function formatControl(spec: Osc2ControlSpec): (value: number) => string {
  switch (spec.format) {
    case 'percent': return value => `${Math.round(value * 100)}%`
    case 'degrees': return value => `${Math.round(value)}°`
    case 'ms': return value => `${Math.round(value)} ms`
    case 'Hz': return value => `${Math.round(value)} Hz`
    case 'px': return value => `${value.toFixed(2)} px`
    case 'count': return value => `${Math.round(value)}`
    default: return value => value.toFixed(2)
  }
}


/**
 * OSC 2 inspector, under the four standard parent groups. With Auto Performance on every control shows the value
 * the conductor is using and is read-only; turning it off restores the saved manual values.
 */
export function XyScopeOsc2DesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const live = useOsc2Live()
  const o = settings.osc2
  const auto = o.autoPerformance
  const shown = auto && live ? live.settings : o.values
  const patch = (next: Partial<typeof o>) => setSettings({ osc2: { ...o, ...next } })
  const setValue = (id: keyof typeof o.values, value: number | string) => patch({ values: { ...o.values, [id]: value } })

  const slider = (spec: Osc2ControlSpec) => (
    <SliderRow key={spec.id} id={`xyscope-osc2-${spec.id}`} label={spec.label} value={shown[spec.id]} min={spec.min} max={spec.max} step={spec.step}
      resetValue={OSC2_DEFAULTS[spec.id]} formatValue={formatControl(spec)} description={spec.description}
      disabled={auto && spec.id !== 'layers'} onChange={value => setValue(spec.id, value)} />
  )

  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-osc2-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design react palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              <ToggleRow id="xyscope-osc2-bpm-sync" label="BPM Sync" value={o.bpmSync} onChange={bpmSync => patch({ bpmSync })}
                description="On: the camera sweep and the terrain scroll run in the track's own beats, so they stay in step with the bar and stop when the music stops. Off: they run at a steady tempo." />
              <ToggleRow id="xyscope-osc2-auto" label="Auto Performance" value={auto} onChange={autoPerformance => patch({ autoPerformance })}
                description="Audio intelligence conducts the camera, depth, terrain and beam together: builds pull the camera up and back, drops push it in and open the solid. Switching off restores your values." />
              <ToggleRow id="xyscope-osc2-floor" label="Floor Grid" value={o.floor} onChange={floor => patch({ floor })} description="Shows the perspective floor the scene stands on." />
              <ToggleRow id="xyscope-osc2-hold" label="Hold Trace" value={o.hold} onChange={hold => patch({ hold })} description="Freezes the displayed trace while audio and analysis continue." />
            </div>
          </Collapsible>

          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <Collapsible label="Scene"><div data-xyscope-subgroup="Scene" style={{ display: 'contents' }}>{OSC2_SCENE_CONTROLS.map(slider)}</div></Collapsible>
              <Collapsible label="Camera"><div data-xyscope-subgroup="Camera" style={{ display: 'contents' }}>{OSC2_CAMERA_CONTROLS.map(slider)}</div></Collapsible>
              <Collapsible label="Beam & Phosphor"><div data-xyscope-subgroup="Beam & Phosphor" style={{ display: 'contents' }}>{OSC2_BEAM_CONTROLS.map(slider)}</div></Collapsible>
            </div>
          </Collapsible>

          <Collapsible label="React" icon={<AppIcon kind="waveform" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="react" style={{ display: 'contents' }}>
              {OSC2_REACT_CONTROLS.map(slider)}
              <div className="rv-ctrl-info">Each contour slice answers one frequency region. Kicks push the camera in, stereo balance slides it sideways, and the live waveform scrolls away as terrain. Pausing returns the camera straight-on.</div>
            </div>
          </Collapsible>

          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} color="currentColor" />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              <PaletteColorRow id="xyscope-osc2-color" label="Phosphor Color" value={shown.color} disabled={auto} onChange={color => setValue('color', color)}
                description="Colour of the beam and its glow. Auto Performance blends it with the music." />
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => patch({ resetSignals: o.resetSignals + 1 })}>Reset Signals</IconChipButton>
          <IconChipButton disabled={auto} onClick={() => setSettings({ osc2: { ...DEFAULT_OSC2_SETTINGS, resetSignals: o.resetSignals + 1 } })}>Reset OSC 2</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
