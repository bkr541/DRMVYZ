import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { WIRE_MANUAL_NOTE } from './XyScopeWireConductor'
import { useWireLive } from './XyScopeWireLive'
import { WIRE_BACKGROUND_OPTIONS } from './XyScopeWireBackground'
import { WIRE_TRANSITION_OPTIONS } from './XyScopeWireTransitions'
import { XyScopeWireReactionsEditor } from './XyScopeWireReactionsEditor'
import {
  DEFAULT_WIRE_SETTINGS, WIRE_BEAM_CONTROLS, WIRE_CADENCE_OPTIONS, WIRE_DEFAULTS, WIRE_FIGURE_CONTROLS, WIRE_FIGURE_OPTIONS, WIRE_HIDDEN_OPTIONS, WIRE_MASTER_CONTROLS, WIRE_RANGES,
  WIRE_REACT_CONTROLS, WIRE_TRAVEL_OPTIONS, type WireControlSpec, type WireValues,
} from './XyScopeWireSettings'

function formatControl(spec: WireControlSpec): (value: number) => string {
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


/** WIREFRAME inspector, under the four standard parent groups: Master Controls, Design, React and Palette. */
export function XyScopeWireDesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const live = useWireLive()
  const o = settings.wire
  const patch = (next: Partial<typeof o>) => setSettings({ wire: { ...o, ...next } })
  const setValue = (id: keyof WireValues, value: number | string | boolean) => patch({ values: { ...o.values, [id]: value } })

  const slider = (spec: WireControlSpec) => {
    const [min, max] = WIRE_RANGES[spec.id]
    return <SliderRow key={spec.id} id={`xyscope-wire-${spec.id}`} label={spec.label} value={o.values[spec.id]} min={min} max={max} step={spec.step}
      resetValue={WIRE_DEFAULTS[spec.id]} formatValue={formatControl(spec)} description={spec.description} onChange={value => setValue(spec.id, value)} />
  }
  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-wire-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design react palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              {WIRE_MASTER_CONTROLS.map(slider)}
              <ToggleRow id="xyscope-wire-bpmSync" label="BPM Sync" value={o.values.bpmSync} onChange={bpmSync => setValue('bpmSync', bpmSync)}
                description="On: the figure turns at the speed of the track's tempo (when the track has a beat grid). Off: it turns at a steady tempo." />
              <ToggleRow id="xyscope-wire-auto" label="Auto Performance" value={o.autoPerformance} onChange={autoPerformance => patch({ autoPerformance })}
                description="The music drives the whole instrument: the figure, the camera, the beam, the lines' oscillators, the chaos, the responses and the colours, all from the track's energy, tension, build, drops, complexity, sections, phrases and key. Your values are the baseline it moves around. A director also changes how the cluster moves on musical boundaries. Off: nothing moves except as your settings say." />
              <ToggleRow id="xyscope-wire-flashLimit" label="Flash Limit" value={o.values.flashLimit} onChange={flashLimit => setValue('flashLimit', flashLimit)}
                description="Spaces out brightness accents (no more than about four a second) and limits how bright they get." />
              <ToggleRow id="xyscope-wire-hold" label="Hold Trace" value={o.hold} onChange={hold => patch({ hold })} description="Freezes the displayed trace while audio and analysis continue." />
            </div>
          </Collapsible>

          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <Collapsible label="Wireframe"><div data-xyscope-subgroup="Wireframe" style={{ display: 'contents' }}>
                <SelectRow id="xyscope-wire-figure" label="Figure" menuBoundarySelector=".vz-inspector" placement="below" value={o.values.figure}
                  options={WIRE_FIGURE_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('figure', value)}
                  description="What is drawn: cubes; platonic solids (dodecahedron, tetrahedron, octahedron, icosahedron, cube); or a four-dimensional tesseract with solids orbiting it. With Auto Performance on, the music chooses the figure at each section." />
                {WIRE_FIGURE_CONTROLS.filter(spec => spec.id !== 'backgroundAmount').map(slider)}
                <SelectRow id="xyscope-wire-backgroundShapes" label="Background Shapes" menuBoundarySelector=".vz-inspector" placement="below" value={o.values.background}
                  options={WIRE_BACKGROUND_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('background', value)}
                  description="The shapes that fill the space around the figure: a tunnel of rings rushing toward you, a horizon floor, giant shells, or a star field (or all of them). They move in beats, pulse through builds and react to bass, mids and drops. With Auto Performance on, the music chooses between all of them." />
                {WIRE_FIGURE_CONTROLS.filter(spec => spec.id === 'backgroundAmount').map(slider)}
                <SelectRow id="xyscope-wire-hiddenEdges" label="Hidden Edges" menuBoundarySelector=".vz-inspector" placement="below" value={o.values.hiddenEdges}
                  options={WIRE_HIDDEN_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('hiddenEdges', value)}
                  description="An edge is hidden when every face that borders it faces away from you. Dim draws those fainter so the figures read as solid. A tesseract has no front, so none of its edges are hidden." />
                <ToggleRow id="xyscope-wire-outline" label="Source Outline" value={o.values.outline} onChange={outline => setValue('outline', outline)}
                  description="Draws a faint copy of the figures where they sit, undisturbed, behind the moving figure." />
              </div></Collapsible>
              <Collapsible label="Beam & Phosphor"><div data-xyscope-subgroup="Beam & Phosphor" style={{ display: 'contents' }}>
                {WIRE_BEAM_CONTROLS.map(slider)}
                <SelectRow id="xyscope-wire-travel" label="Beam Travel" menuBoundarySelector=".vz-inspector" placement="below" value={o.values.travel}
                  options={WIRE_TRAVEL_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('travel', value)}
                  description="What the beam does when it must cross from one figure to the next: Blank hides the move, Dim draws it faintly, Visible draws it like a real scope with no blanking." />
              </div></Collapsible>
            </div>
          </Collapsible>

          <Collapsible label="React" icon={<AppIcon kind="waveform" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="react" style={{ display: 'contents' }}>
              {WIRE_REACT_CONTROLS.map(slider)}
              <SelectRow id="xyscope-wire-transition" label="Transitions" menuBoundarySelector=".vz-inspector" placement="below" value={o.values.transition}
                options={WIRE_TRANSITION_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('transition', value)}
                description="How the figure changes into another: it shatters and re-forms, morphs, glitches and tears, or is flown through by the camera. With Auto Performance on, the music chooses between all of them at each section and drop; this is the style used when you change the figure yourself." />
              <SelectRow id="xyscope-wire-sceneEvery" label="Scene Change" menuBoundarySelector=".vz-inspector" placement="below" value={o.values.sceneEvery}
                options={WIRE_CADENCE_OPTIONS.map(option => ({ value: option.value, label: option.label }))} onChange={value => setValue('sceneEvery', value)}
                description="How often the director picks a new way for the cluster to move (Auto Performance). Sections and phrases need an analysed track; a live microphone only changes on bars the beat grid is sure of." />
              <Collapsible label="Reactions"><div data-xyscope-subgroup="Reactions" style={{ display: 'contents' }}>
                <XyScopeWireReactionsEditor rules={o.rules} onChange={rules => patch({ rules })} />
              </div></Collapsible>
              <div className="rv-ctrl-info">Every edge is an oscillator, the way an XY oscilloscope draws: its own sine wave along the line, with a pitch and speed that follow the music (bass drives one direction, mids another, highs the third, and every kick all of them), mixed with the live captured waveform. Chaos makes each oscillator drift, modulate itself and pull on its neighbours. The corners never move and no line goes past Wave Depth, so the figures stay readable; in silence every line is exactly straight. {live?.auto ? WIRE_MANUAL_NOTE : 'With Auto Performance on, the music moves almost every control above around your values.'}</div>
            </div>
          </Collapsible>

          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} color="currentColor" />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              <PaletteColorRow id="xyscope-wire-color" label="Beam Color" value={o.values.color} onChange={color => setValue('color', color)} description="Colour of the phosphor line. Its brightest parts burn toward white." />
              <PaletteColorRow id="xyscope-wire-glow-color" label="Glow Color" value={o.values.glowColor} onChange={color => setValue('glowColor', color)} description="Colour of the halo around the lines." />
              <PaletteColorRow id="xyscope-wire-background" label="Background" value={o.values.backgroundColor} onChange={color => setValue('backgroundColor', color)} description="Colour of the screen behind the beam." />
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => patch({ resetSignals: o.resetSignals + 1 })}>Reset Signals</IconChipButton>
          <IconChipButton onClick={() => setSettings({ wire: { ...DEFAULT_WIRE_SETTINGS, resetSignals: o.resetSignals + 1 } })}>Reset WIREFRAME</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
