import { SliderRow, SelectRow, ToggleRow, Collapsible } from '../ReactControlRows'
import { Dropdown } from '../../../shared/Dropdown/Dropdown'
import { LetterAssignmentEditor } from '../ReactModulationPanel'
import type {
  OscillatorAudioDisplaceMode,
  OscillatorTextLetterReactionMode,
  OscillatorTextWaveformMode,
} from '../ReactTypes'
import type { SoundDrawingMockState } from './useSoundDrawingMockState'

// ── SoundDrawingReactivityMockup ───────────────────────────────────────────
//
// Disconnected copy of ReactModulationPanel.tsx's Sound Drawing branch
// (right rail, REACT tab, ROUTING subtab in production) — Audio Reactivity,
// Text Letter Motion / Waveform Distortion (text source only), and
// Frequency Response. Driven by the shared mock state's osc/set.

const SOUND_DRAWING_DISPLACE_MODE_OPTIONS: Array<{ value: OscillatorAudioDisplaceMode, label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'radial', label: 'Radial' },
  { value: 'tangent', label: 'Tangent' },
  { value: 'xy', label: 'XY' },
]

export function SoundDrawingReactivityMockup({ state }: { state: SoundDrawingMockState }) {
  const { osc, set } = state

  return (
    <div className="rv-ctrl-group">
      <Collapsible label="Audio Reactivity" defaultOpen>
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
        <SliderRow label="Displacement" value={osc.audioDisplacement} onChange={v => set({ audioDisplacement: v })} color="#4ac7db" />
      </Collapsible>

      {osc.sourceType === 'text' && (
        <>
          <Collapsible label="Text Letter Motion" defaultOpen>
            <SelectRow
              label="Letter Reaction"
              value={osc.textLetterReactionMode}
              onChange={v => set({ textLetterReactionMode: v as OscillatorTextLetterReactionMode })}
              options={[
                { value: 'uniform', label: 'Uniform' },
                { value: 'alternating', label: 'Alternating' },
                { value: 'frequencySplit', label: 'Frequency Split' },
                { value: 'ripple', label: 'Ripple' },
                { value: 'custom', label: 'Custom' },
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
              onChange={v => set({ textWaveformMode: v as OscillatorTextWaveformMode })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'normal', label: 'Normal' },
                { value: 'radial', label: 'Radial' },
                { value: 'tangent', label: 'Tangent' },
                { value: 'xy', label: 'XY' },
              ]}
            />
            <SliderRow label="Text Wave Amount" value={osc.textWaveformAmount} onChange={v => set({ textWaveformAmount: v })} min={0} max={0.30} step={0.005} color="#4ac7db" />
            <SliderRow label="Text Wave Cycles" value={osc.textWaveformCycles} onChange={v => set({ textWaveformCycles: v })} min={1} max={16} step={1} color="#61d6aa" />
            <SliderRow label="Text Wave Scroll" value={osc.textWaveformScroll} onChange={v => set({ textWaveformScroll: v })} min={0} max={2} step={0.01} color="#b84fc9" />
          </Collapsible>
        </>
      )}

      <Collapsible label="Frequency Response" defaultOpen>
        <SliderRow label="Bass → Scale" value={osc.bassScale} onChange={v => set({ bassScale: v })} color="#d8b95a" />
        <SliderRow label="Mid → Twist" value={osc.midTwist} onChange={v => set({ midTwist: v })} color="#61d6aa" />
        <ToggleRow
          label="Alternate"
          value={osc.altTwist}
          onChange={v => set({ altTwist: v })}
          title="Randomly alternate twist direction on each beat"
        />
        <SliderRow label="High → Jitter" value={osc.highJitter} onChange={v => set({ highJitter: v })} color="#b84fc9" />
        <SliderRow label="Beat → Bloom" value={osc.beatBloom} onChange={v => set({ beatBloom: v })} color="#c0314a" />
      </Collapsible>
    </div>
  )
}
