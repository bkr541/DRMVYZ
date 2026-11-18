import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, PaletteColorRow, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { OSC1_MODES, osc1ModeSettings, type Osc1Focus } from './XyScopeOsc1Engine'
import { useOsc1Live } from './XyScopeOsc1Live'
import {
  DEFAULT_OSC1_LETTER,
  normalizeOsc1Settings,
  OSC1_BEAM_CONTROLS,
  OSC1_FOCUS_OPTIONS,
  OSC1_GEOMETRY_CONTROLS,
  OSC1_MAX_LETTERS,
  OSC1_RESPONSE_CONTROLS,
  type Osc1ControlSpec,
  type Osc1LetterSettings,
} from './XyScopeOsc1Settings'

function formatControl(spec: Osc1ControlSpec): (value: number) => string {
  const digits = spec.step < 1 ? 2 : 0
  return value => `${value.toFixed(digits)}${spec.suffix}`
}


/**
 * OSC 1 inspector: the XY / Text Lab's controls under the standard four parent groups. Master Controls holds the
 * conductor and transport-style toggles, Design the geometry, beam and letter channels, React the live response
 * systems, and Palette the phosphor colour. With Auto Performance on every control displays its effective value
 * and is read-only; turning it off restores the saved manual values.
 */
export function XyScopeOsc1DesignPanel() {
  const settings = useReactStore(state => state.xyScopeSettings)
  const setSettings = useReactStore(state => state.setXyScopeSettings)
  const live = useOsc1Live()
  const o = settings.osc1
  const auto = o.autoPerformance
  const mode = OSC1_MODES[o.mode]
  const manual = o.presets[o.mode]
  // Effective values while Auto Performance runs; the saved manual values otherwise.
  const shown = auto && live ? live.settings : manual
  const letterCount = Math.min(OSC1_MAX_LETTERS, [...settings.text.trim()].length)
  const letterIndex = Math.min(o.letterIndex, letterCount - 1)
  const manualLetter = o.letters[Math.max(0, letterIndex)] ?? DEFAULT_OSC1_LETTER
  const liveLetter = live?.letters[Math.max(0, letterIndex)]
  const letter: Osc1LetterSettings = auto && liveLetter ? { gain: liveLetter.gain, offset: liveLetter.offset, focus: liveLetter.focus as Osc1Focus } : manualLetter
  const text = [...settings.text.trim().toUpperCase()].slice(0, letterCount)

  const patch = (next: Partial<typeof o>) => setSettings({ osc1: { ...o, ...next } })
  const setControl = (id: Osc1ControlSpec['id'], value: number) => patch({ presets: o.presets.map((preset, i) => i === o.mode ? { ...preset, [id]: value } : preset) })
  const setColor = (color: string) => patch({ presets: o.presets.map((preset, i) => i === o.mode ? { ...preset, color } : preset) })
  const setLetters = (change: Partial<Osc1LetterSettings>) => {
    const next = Array.from({ length: Math.max(letterCount, o.letters.length) }, (_, i) => o.letters[i] ?? DEFAULT_OSC1_LETTER)
    for (let i = 0; i < next.length; i++) if (letterIndex < 0 ? i < letterCount : i === letterIndex) next[i] = { ...next[i], ...change }
    patch({ letters: next })
  }

  const slider = (spec: Osc1ControlSpec) => (
    <SliderRow key={spec.id} id={`xyscope-osc1-${spec.id}`} label={spec.label} value={shown[spec.id]} min={spec.min} max={spec.max} step={spec.step}
      resetValue={osc1ModeSettings(o.mode)[spec.id]} formatValue={formatControl(spec)} description={spec.description} disabled={auto}
      onChange={value => setControl(spec.id, value)} />
  )


  return (
    <div className="rv-workspace-panel rv-xyscope-workspace-panel" data-xyscope-design="true" data-osc1-design="true">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">
        <div className="rv-ctrl-group" data-xyscope-design-groups="master-controls design react palette">
          <Collapsible label="Master Controls" icon={<AppIcon kind="sliders" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="master-controls" style={{ display: 'contents' }}>
              <ToggleRow id="xyscope-osc1-bpm-sync" label="BPM Sync" value={o.bpmSync} onChange={bpmSync => patch({ bpmSync })}
                description="On: Attack and Release follow the track's tempo when it has a beat grid, so a fast track reacts faster and a slow one more slowly. Off: they are exactly the times you set." />
              <ToggleRow id="xyscope-osc1-auto" label="Auto Performance" value={auto} onChange={autoPerformance => patch({ autoPerformance })}
                description="Coordinates all sixteen visual controls, the phosphor colour and each letter’s gain, direction and focus from live audio and section evidence. Switching off restores your saved values." />
              <SelectRow id="xyscope-osc1-mode" label="Response System" value={String(o.mode)} menuBoundarySelector=".vz-inspector" placement="below"
                options={OSC1_MODES.map((entry, i) => ({ value: String(i), label: `0${i + 1} / ${entry.name}` }))}
                onChange={value => patch({ mode: Number(value) })}
                description="Which way the audio opens the anchored letters. Each system keeps its own settings." />
              <div className="rv-ctrl-info" data-osc1-mode-info="true"><strong>{mode.tag}</strong><br />{mode.desc}</div>
              <ToggleRow id="xyscope-osc1-grid" label="Grid" value={o.grid} onChange={grid => patch({ grid })} description="Shows the scope graticule behind the beam." />
              <ToggleRow id="xyscope-osc1-hold" label="Hold Trace" value={o.hold} onChange={hold => patch({ hold })}
                description="Freezes the displayed trace while audio and analysis continue." />
            </div>
          </Collapsible>

          <Collapsible label="Design" icon={<AppIcon kind="paintBrush" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="design" style={{ display: 'contents' }}>
              <Collapsible label="XY Geometry"><div data-xyscope-subgroup="XY Geometry" style={{ display: 'contents' }}>{OSC1_GEOMETRY_CONTROLS.map(slider)}</div></Collapsible>
              <Collapsible label="Beam & Phosphor"><div data-xyscope-subgroup="Beam & Phosphor" style={{ display: 'contents' }}>{OSC1_BEAM_CONTROLS.map(slider)}</div></Collapsible>
              <Collapsible label="Letter Channels">
                <div data-xyscope-subgroup="Letter Channels" style={{ display: 'contents' }}>
                  <SelectRow id="xyscope-osc1-letter" label="Letter" value={String(letterIndex)} menuBoundarySelector=".vz-inspector" placement="below"
                    options={[{ value: '-1', label: 'All glyph channels' }, ...text.map((char, i) => ({ value: String(i), label: `${String(i + 1).padStart(2, '0')} / ${char === ' ' ? 'SPACE' : char}` }))]}
                    onChange={value => patch({ letterIndex: Number(value) })}
                    description="Each letter is its own XY stream. All glyph channels edits every letter and shows the first letter’s settings." />
                  <SliderRow id="xyscope-osc1-letter-gain" label="Channel depth" value={letter.gain * 100} min={0} max={150} step={1} resetValue={100}
                    formatValue={value => `${Math.round(value)}%`} description="How strongly this letter responds." disabled={auto || letterCount === 0}
                    onChange={value => setLetters({ gain: value / 100 })} />
                  <SliderRow id="xyscope-osc1-letter-offset" label="Direction offset" value={letter.offset * 180 / Math.PI} min={0} max={360} step={1} resetValue={0}
                    formatValue={value => `${Math.round(value)}°`} description="Rotates this letter’s frequency-to-direction mapping." disabled={auto || letterCount === 0}
                    onChange={value => setLetters({ offset: value * Math.PI / 180 })} />
                  <SelectRow id="xyscope-osc1-letter-focus" label="Audio focus" value={letter.focus} menuBoundarySelector=".vz-inspector" placement="below"
                    options={OSC1_FOCUS_OPTIONS.map(option => ({ value: option.value, label: option.label }))} disabled={auto || letterCount === 0}
                    onChange={value => setLetters({ focus: value as Osc1Focus })}
                    description="Which part of the spectrum this letter emphasises." />
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <IconChipButton disabled={auto || letterCount === 0} onClick={() => setLetters(DEFAULT_OSC1_LETTER)}>Reset Letter</IconChipButton>
                  </div>
                </div>
              </Collapsible>
            </div>
          </Collapsible>

          <Collapsible label="React" icon={<AppIcon kind="waveform" size={15} color="currentColor" />}>
            <div data-xyscope-parent-group="react" style={{ display: 'contents' }}>
              <Collapsible label="Live Response"><div data-xyscope-subgroup="Live Response" style={{ display: 'contents' }}>{OSC1_RESPONSE_CONTROLS.map(slider)}</div></Collapsible>
              <div className="rv-ctrl-info">Legibility bounds outward extension. Frequency and waveform changes drive the contour; letter centres stay fixed.</div>
            </div>
          </Collapsible>

          <Collapsible label="Palette" icon={<AppIcon kind="colorPalette" size={15} color="currentColor" />} bodyClassName="rv-cinema2-palette-body">
            <div data-xyscope-parent-group="palette" style={{ display: 'contents' }}>
              <PaletteColorRow id="xyscope-osc1-color" label="Phosphor Color" value={shown.color} disabled={auto}
                onChange={setColor}
                description="Colour of the beam and its glow in this response system. Auto Performance blends it with the music." />
            </div>
          </Collapsible>
        </div>
        <div className="rv-ctrl-group" data-xyscope-inspector-actions="true">
          <IconChipButton onClick={() => patch({ resetSignals: o.resetSignals + 1 })}>Reset Signals</IconChipButton>
          <IconChipButton disabled={auto} onClick={() => patch({ presets: o.presets.map((preset, i) => i === o.mode ? osc1ModeSettings(i) : preset) })}>Restore Response System</IconChipButton>
          <IconChipButton disabled={auto} onClick={() => setSettings({ osc1: normalizeOsc1Settings({ ...o, presets: undefined, letters: [] }) })}>Reset OSC 1</IconChipButton>
        </div>
      </div></div>
    </div>
  )
}
