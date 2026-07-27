import { useSharedAudio } from '../../../../context/AudioEngineContext'
import type {
  ScopeSignalMode,
  ScopeTimebaseMode,
  ScopeTriggerMode,
  ScopeTriggerSlope,
  ScopeTriggerSource,
  SoundDrawingScopeState,
} from '../../../../audio/scope'
import { isScopeStereoMeasurementMode } from '../../../../audio/scope'
import { SliderRow, SelectRow, ToggleRow, CtrlSection, Collapsible } from '../ReactControlRows'
import type { OscillatorSettings } from '../ReactTypes'

interface Props {
  osc: OscillatorSettings
  set: (patch: Partial<OscillatorSettings>) => void
}

/**
 * Professional scope signal controls.
 *
 * Progressive disclosure per the control contract: signal mode and the two
 * controls that most change what the user sees stay at the top level; the
 * precise trigger, timebase, and conditioning parameters live behind
 * collapsibles so a new user reaches a stable trace without opening any of them.
 *
 * Beam, phosphor, and CRT controls are deliberately absent — they belong to the
 * renderer patches and would be inert here.
 */
export function SoundDrawingProScopeControls({ osc, set }: Props) {
  const engine = useSharedAudio()
  const scope = osc.scope

  const patchScope = (patch: Partial<SoundDrawingScopeState>) => {
    set({ scope: { ...scope, ...patch } })
  }
  const patchTrigger = (patch: Partial<SoundDrawingScopeState['trigger']>) => {
    patchScope({ trigger: { ...scope.trigger, ...patch } })
  }
  const patchTimebase = (patch: Partial<SoundDrawingScopeState['timebase']>) => {
    patchScope({ timebase: { ...scope.timebase, ...patch } })
  }
  const patchConditioner = (patch: Partial<SoundDrawingScopeState['signalConditioner']>) => {
    patchScope({ signalConditioner: { ...scope.signalConditioner, ...patch } })
  }

  const captureStatus = engine.scopeStereoTap?.getStatus() ?? null
  const captureUnavailable = captureStatus == null || !captureStatus.active
  const monoSource = captureStatus != null && captureStatus.channelCount < 2
  const claimsStereo = isScopeStereoMeasurementMode(scope.signalMode)

  return (
    <>
      <CtrlSection label="Pro Scope" />

      {/*
        Honesty about the signal path. A stereo mode selected over a mono source,
        or with capture unavailable, still draws something — the user needs to
        know the display is not the measurement its name implies.
      */}
      {captureUnavailable && (
        <p className="rv-osc-scope-note" role="status">
          Stereo capture unavailable — showing the standard waveform. Start playback,
          or check that audio worklets are permitted in this build.
        </p>
      )}
      {!captureUnavailable && monoSource && claimsStereo && (
        <p className="rv-osc-scope-note" role="status">
          Source is mono. Stereo modes will read as a perfect centre image because
          both channels are identical, not because the mix is correlated.
        </p>
      )}

      <SelectRow
        label="Signal"
        value={scope.signalMode}
        onChange={v => patchScope({ signalMode: v as ScopeSignalMode })}
        description="What the display plots. Measurement modes read real channel relationships; portrait modes are expressive."
        options={[
          { value: 'stereoXY',        label: 'Stereo X/Y (measurement)' },
          { value: 'midSideXY',       label: 'Mid / Side (measurement)' },
          { value: 'sumDifferenceXY', label: 'Sum / Difference (measurement)' },
          { value: 'dualWaveform',    label: 'Dual Channel (measurement)' },
          { value: 'left',            label: 'Left' },
          { value: 'right',           label: 'Right' },
          { value: 'mono',            label: 'Mono Sum' },
          { value: 'monoDelayXY',     label: 'Mono Delay Portrait' },
        ]}
      />

      <SliderRow
        label="Input Gain"
        value={scope.signalConditioner.gainY}
        onChange={v => patchConditioner({ gainX: v, gainY: v })}
        min={0.1}
        max={8}
        step={0.1}
      />

      <SliderRow
        label="Trigger Stability"
        value={scope.trigger.continuityWeight}
        onChange={v => patchTrigger({ continuityWeight: v, periodAssist: v })}
        description="Higher favours a still trace; lower reacts faster to changes in the signal."
      />

      <Collapsible label="Timebase" defaultOpen={false}>
        <SelectRow
          label="Mode"
          value={scope.timebase.mode}
          onChange={v => patchTimebase({ mode: v as ScopeTimebaseMode })}
          options={[
            { value: 'auto',         label: 'Auto' },
            { value: 'seconds',      label: 'Fixed Time' },
            { value: 'cycles',       label: 'Locked Cycles' },
            { value: 'beatRelative', label: 'Beat Relative' },
          ]}
        />
        {scope.timebase.mode !== 'cycles' && (
          <SliderRow
            label="Milliseconds / Display"
            value={scope.timebase.secondsPerDisplay * 1000}
            onChange={v => patchTimebase({ secondsPerDisplay: v / 1000 })}
            min={1}
            max={200}
            step={1}
          />
        )}
        {(scope.timebase.mode === 'cycles' || scope.timebase.mode === 'auto') && (
          <SliderRow
            label="Visible Cycles"
            value={scope.timebase.visibleCycles}
            onChange={v => patchTimebase({ visibleCycles: v })}
            min={0.5}
            max={16}
            step={0.5}
          />
        )}
        {scope.timebase.mode === 'beatRelative' && (
          <SelectRow
            label="Beat Division"
            value={scope.timebase.beatDivision}
            onChange={v => patchTimebase({ beatDivision: v as SoundDrawingScopeState['timebase']['beatDivision'] })}
            options={[
              { value: '1/16',   label: '1/16' },
              { value: '1/8',    label: '1/8' },
              { value: '1/4',    label: '1/4' },
              { value: '1/2',    label: '1/2' },
              { value: '1beat',  label: '1 Beat' },
              { value: '2beats', label: '2 Beats' },
              { value: '1bar',   label: '1 Bar' },
            ]}
          />
        )}
        <SliderRow
          label="Horizontal Position"
          value={scope.timebase.horizontalPosition}
          onChange={v => patchTimebase({ horizontalPosition: v })}
          min={-1}
          max={1}
          step={0.01}
        />
        <SliderRow
          label="Window Smoothing"
          value={scope.timebase.smoothing}
          onChange={v => patchTimebase({ smoothing: v })}
          max={0.99}
        />
      </Collapsible>

      <Collapsible label="Trigger" defaultOpen={false}>
        <SelectRow
          label="Mode"
          value={scope.trigger.mode}
          onChange={v => patchTrigger({ mode: v as ScopeTriggerMode })}
          description="Auto reacquires and falls back to free-run; Normal holds the last trigger."
          options={[
            { value: 'auto',    label: 'Auto' },
            { value: 'normal',  label: 'Normal' },
            { value: 'freeRun', label: 'Free Run' },
            { value: 'single',  label: 'Single' },
          ]}
        />
        <SelectRow
          label="Source"
          value={scope.trigger.source}
          onChange={v => patchTrigger({ source: v as ScopeTriggerSource })}
          options={[
            { value: 'mid',        label: 'Mid' },
            { value: 'left',       label: 'Left' },
            { value: 'right',      label: 'Right' },
            { value: 'side',       label: 'Side' },
            { value: 'sum',        label: 'Sum' },
            { value: 'difference', label: 'Difference' },
          ]}
        />
        <SelectRow
          label="Slope"
          value={scope.trigger.slope}
          onChange={v => patchTrigger({ slope: v as ScopeTriggerSlope })}
          options={[
            { value: 'rising',  label: 'Rising' },
            { value: 'falling', label: 'Falling' },
            { value: 'either',  label: 'Either' },
          ]}
        />
        <SliderRow
          label="Level"
          value={scope.trigger.level}
          onChange={v => patchTrigger({ level: v })}
          min={-1}
          max={1}
          step={0.01}
        />
        <SliderRow
          label="Hysteresis"
          value={scope.trigger.hysteresis}
          onChange={v => patchTrigger({ hysteresis: v })}
          max={0.5}
          step={0.005}
          description="Noise immunity. The signal must leave this band before the trigger re-arms."
        />
        <SliderRow
          label="Holdoff (ms)"
          value={scope.trigger.holdoffSeconds * 1000}
          onChange={v => patchTrigger({ holdoffSeconds: v / 1000 })}
          max={100}
          step={0.5}
        />
        <SliderRow
          label="Pre-Trigger"
          value={scope.trigger.preTriggerRatio}
          onChange={v => patchTrigger({ preTriggerRatio: v })}
        />
      </Collapsible>

      <Collapsible label="Signal Conditioning" defaultOpen={false}>
        <SelectRow
          label="Coupling"
          value={scope.signalConditioner.coupling}
          onChange={v => patchConditioner({ coupling: v === 'ac' ? 'ac' : 'dc' })}
          description="AC removes any DC offset before plotting."
          options={[
            { value: 'dc', label: 'DC' },
            { value: 'ac', label: 'AC' },
          ]}
        />
        <SliderRow
          label="X Gain"
          value={scope.signalConditioner.gainX}
          onChange={v => patchConditioner({ gainX: v })}
          min={0.1}
          max={8}
          step={0.1}
        />
        <SliderRow
          label="Y Gain"
          value={scope.signalConditioner.gainY}
          onChange={v => patchConditioner({ gainY: v })}
          min={0.1}
          max={8}
          step={0.1}
        />
        <ToggleRow
          label="Invert X"
          value={scope.signalConditioner.invertX}
          onChange={v => patchConditioner({ invertX: v })}
        />
        <ToggleRow
          label="Invert Y"
          value={scope.signalConditioner.invertY}
          onChange={v => patchConditioner({ invertY: v })}
        />
        <ToggleRow
          label="Swap Axes"
          value={scope.signalConditioner.swapAxes}
          onChange={v => patchConditioner({ swapAxes: v })}
        />
        {scope.signalMode === 'monoDelayXY' && (
          <SliderRow
            label="Portrait Delay (ms)"
            value={scope.monoDelayMs}
            onChange={v => patchScope({ monoDelayMs: v })}
            min={0.05}
            max={50}
            step={0.05}
          />
        )}
      </Collapsible>
    </>
  )
}
