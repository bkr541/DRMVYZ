import { SliderRow, SelectRow, ToggleRow, Collapsible } from '../ReactControlRows'
import { Dropdown } from '../../../shared/Dropdown/Dropdown'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
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

function formatSoundDrawingPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function getSoundDrawingDisplaceModeLabel(value: OscillatorAudioDisplaceMode): string {
  return SOUND_DRAWING_DISPLACE_MODE_OPTIONS.find(option => option.value === value)?.label ?? 'Normal'
}

export function SoundDrawingReactivityMockup({ state }: { state: SoundDrawingMockState }) {
  const { osc, set } = state

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
