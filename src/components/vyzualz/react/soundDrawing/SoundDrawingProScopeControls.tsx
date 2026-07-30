import { useSharedAudio } from '../../../../context/AudioEngineContext'
import type {
  ScopeGraticuleStyle,
  ScopePhosphorModel,
  ScopeSignalMode,
  ScopeTimebaseMode,
  ScopeTriggerMode,
  ScopeTriggerSlope,
  ScopeTriggerSource,
  SoundDrawingScopeState,
} from '../../../../audio/scope'
import {
  SCOPE_PRESETS,
  isScopeStereoMeasurementMode,
  relinkScopeAxisGains,
  resolveScopeAxisGainLinkState,
  resolveScopePresetProvenance,
  resolveScopePresetState,
  resolveScopeSettledScaleDiagnostics,
  resolveScopeStabilityMacro,
  scopeSignalModeUsesXGain,
} from '../../../../audio/scope'
import { SliderRow, SelectRow, ToggleRow, ColorRow, CtrlSection, Collapsible } from '../ReactControlRows'
import type { OscillatorSettings } from '../ReactTypes'
import { SOUND_DRAWING_VISUAL_SIZE_MAX, SOUND_DRAWING_VISUAL_SIZE_MIN } from './SoundDrawingVisualSize'

const PRESET_GROUP_LABEL: Record<'measurement' | 'analog' | 'signature', string> = {
  measurement: 'Measure',
  analog: 'Analog',
  signature: 'Signature',
}

interface Props {
  osc: OscillatorSettings
  set: (patch: Partial<OscillatorSettings>) => void
  hideTraceSize?: boolean
}

/**
 * Professional scope signal controls.
 *
 * Progressive disclosure per the control contract: signal mode and the two
 * controls that most change what the user sees stay at the top level; the
 * precise trigger, timebase, and conditioning parameters live behind
 * collapsibles so a new user reaches a stable trace without opening any of them.
 *
 * Beam and phosphor tuning stay renderer-owned and are derived from the quality
 * plan rather than exposed here. CRT presentation is a look the user authors, so
 * it gets a collapsible of its own.
 */
export function SoundDrawingProScopeControls({ osc, set, hideTraceSize = false }: Props) {
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
  const patchBeam = (patch: Partial<SoundDrawingScopeState['beam']>) => {
    patchScope({ beam: { ...scope.beam, ...patch } })
  }
  const patchPhosphor = (patch: Partial<SoundDrawingScopeState['phosphor']>) => {
    patchScope({ phosphor: { ...scope.phosphor, ...patch } })
  }
  const patchMusic = (patch: Partial<SoundDrawingScopeState['music']>) => {
    patchScope({ music: { ...scope.music, ...patch } })
  }
  const patchCrt = (patch: Partial<SoundDrawingScopeState['crt']>) => {
    patchScope({ crt: { ...scope.crt, ...patch } })
  }

  const presetProvenance = resolveScopePresetProvenance(scope)
  const activePreset = presetProvenance.preset
  const gainLink = resolveScopeAxisGainLinkState(scope)
  const stabilityMacro = resolveScopeStabilityMacro(scope)
  const scaleDiagnostics = resolveScopeSettledScaleDiagnostics(osc.pathScale, scope)
  const xGainActive = scopeSignalModeUsesXGain(scope.signalMode)

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
        label="Preset"
        value={activePreset?.id ?? ''}
        onChange={v => { if (v) set({ scope: resolveScopePresetState(v) }) }}
        description="A complete recipe — signal, timebase, trigger, beam, phosphor, and tube. Everything below stays adjustable afterwards."
        options={[
          { value: '', label: presetProvenance.status === 'unknownLegacy' ? presetProvenance.label : 'Select a preset…' },
          ...SCOPE_PRESETS.map(preset => ({
            value: preset.id,
            label: `${PRESET_GROUP_LABEL[preset.group]} · ${preset.name}`,
          })),
        ]}
      />
      <p className="rv-ctrl-info rv-control-helper-copy" role="status" aria-live="polite">
        <strong>{presetProvenance.label}</strong> · {presetProvenance.description}
      </p>
      {activePreset && presetProvenance.status === 'modified' && (
        <button type="button" className="rv-reset-btn" onClick={() => set({ scope: resolveScopePresetState(activePreset.id) })}>
          Reset to {activePreset.name}
        </button>
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

      {!hideTraceSize && (
        <SliderRow
          label="Visual Size"
          value={osc.pathScale}
          onChange={v => set({ pathScale: v })}
          min={SOUND_DRAWING_VISUAL_SIZE_MIN}
          max={SOUND_DRAWING_VISUAL_SIZE_MAX}
          step={0.01}
          description="Immediate presentation scale. Signal calibration remains in Advanced Signal Conditioning."
        />
      )}

      <SliderRow
        label={`Stability Macro · ${stabilityMacro.label}`}
        value={stabilityMacro.value}
        onChange={v => patchTrigger({ continuityWeight: v, periodAssist: v })}
        description={stabilityMacro.mixed
          ? 'Custom: Continuity and Period Assist differ. Moving this macro intentionally relinks both algorithms.'
          : 'Linked macro: moves Continuity and Period Assist together without combining their runtime algorithms.'}
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
        <SliderRow
          label="Continuity"
          value={scope.trigger.continuityWeight}
          onChange={v => patchTrigger({ continuityWeight: v })}
          description="Weights drift from the previous within-window trigger position. Editing it does not change Period Assist."
        />
        <SliderRow
          label="Period Assist"
          value={scope.trigger.periodAssist}
          onChange={v => patchTrigger({ periodAssist: v })}
          description="Weights agreement with the estimated signal period. Editing it does not change Continuity."
        />
      </Collapsible>



      <Collapsible label="Beam" defaultOpen={false}>
        <SliderRow
          label="Core Width"
          value={scope.beam.coreWidthPx}
          onChange={v => patchBeam({ coreWidthPx: v })}
          min={0.25}
          max={6}
          step={0.05}
        />
        <SliderRow
          label="Halo Size"
          value={scope.beam.haloScale}
          onChange={v => patchBeam({ haloScale: v })}
          min={1}
          max={16}
          step={0.5}
        />
        <SliderRow
          label="Bass Width"
          value={scope.beam.bassWidthResponse}
          onChange={v => patchBeam({ bassWidthResponse: v })}
          description="How much bass thickens the beam. Zero keeps a constant width, which is what a measurement reading wants."
        />
        <SliderRow
          label="Velocity Brightness"
          value={scope.beam.velocityBrightness}
          onChange={v => patchBeam({ velocityBrightness: v })}
          description="A slow-moving beam reads brighter, the way a real spot dwells where it turns."
        />
        <SliderRow
          label="Corner Dwell"
          value={scope.beam.cornerDwell}
          onChange={v => patchBeam({ cornerDwell: v })}
        />
      </Collapsible>

      <Collapsible label="Phosphor" defaultOpen={false}>
        <SliderRow
          label="Persistence (s)"
          value={scope.phosphor.persistenceSeconds}
          onChange={v => patchPhosphor({ persistenceSeconds: v })}
          min={0.01}
          max={4}
          step={0.01}
          description="How long the trail takes to fade. Stated in seconds, so it holds at any frame rate."
        />
        <SliderRow
          label="Tight Bloom"
          value={scope.phosphor.tightBloom}
          onChange={v => patchPhosphor({ tightBloom: v })}
        />
        <SliderRow
          label="Medium Bloom"
          value={scope.phosphor.mediumBloom}
          onChange={v => patchPhosphor({ mediumBloom: v })}
        />
        <SliderRow
          label="Wide Bloom"
          value={scope.phosphor.wideBloom}
          onChange={v => patchPhosphor({ wideBloom: v })}
        />
        <SliderRow
          label="White Hot"
          value={scope.phosphor.whiteHot}
          onChange={v => patchPhosphor({ whiteHot: v })}
          description="How readily overlapping strokes desaturate toward white."
        />
        <SliderRow
          label="Background Lift"
          value={scope.phosphor.backgroundLift}
          onChange={v => patchPhosphor({ backgroundLift: v })}
        />
      </Collapsible>


      <Collapsible label="Music Reactivity" defaultOpen={false}>
        <p className="rv-ctrl-info rv-control-helper-copy">
          Music Intelligence modulates presentation only — glow, beam width, exposure,
          and trail length. The trace geometry never moves, so a measurement mode stays
          a measurement.
        </p>
        <SliderRow
          label="Beat Bloom"
          value={scope.music.beatBloom}
          onChange={v => patchMusic({ beatBloom: v })}
        />
        <SliderRow
          label="Kick Width"
          value={scope.music.kickWidth}
          onChange={v => patchMusic({ kickWidth: v })}
        />
        <SliderRow
          label="Bass Exposure"
          value={scope.music.bassExposure}
          onChange={v => patchMusic({ bassExposure: v })}
        />
        <SliderRow
          label="Build Exposure"
          value={scope.music.buildExposure}
          onChange={v => patchMusic({ buildExposure: v })}
          description="Lifts exposure as a build progresses toward a drop."
        />
        <SliderRow
          label="Drop Snap"
          value={scope.music.dropSnap}
          onChange={v => patchMusic({ dropSnap: v })}
          description="Shortens the trail on a drop, so the figure reads sharper."
        />
      </Collapsible>

      <Collapsible label="CRT Display" defaultOpen={false}>
        <ToggleRow
          label="CRT Presentation"
          value={scope.crt.enabled}
          onChange={v => patchCrt({ enabled: v })}
          description="Adds tube character over the finished image. Off by default; the trace itself is unchanged."
        />
        {scope.crt.enabled && (
          <>
            <SelectRow
              label="Phosphor"
              value={scope.crt.phosphorModel}
              onChange={v => patchCrt({ phosphorModel: v as ScopePhosphorModel })}
              description="A stylistic colour response, not an emulation of any specific tube."
              options={[
                { value: 'green', label: 'Lab Green' },
                { value: 'amber', label: 'Amber' },
                { value: 'blue',  label: 'Ice Blue' },
                { value: 'white', label: 'Neutral White' },
                { value: 'rgb',   label: 'RGB Vector (keeps trace colour)' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            {scope.crt.phosphorModel === 'custom' && (
              <ColorRow
                label="Phosphor Colour"
                value={scope.crt.customPhosphorColor}
                onChange={v => patchCrt({ customPhosphorColor: v })}
              />
            )}
            <SliderRow
              label="Scanlines"
              value={scope.crt.scanlineStrength}
              onChange={v => patchCrt({ scanlineStrength: v })}
            />
            <SliderRow
              label="Curvature"
              value={scope.crt.curvature}
              onChange={v => patchCrt({ curvature: v })}
            />
            <SliderRow
              label="Vignette"
              value={scope.crt.vignette}
              onChange={v => patchCrt({ vignette: v })}
            />
            <SliderRow
              label="Edge Focus Loss"
              value={scope.crt.edgeDefocus}
              onChange={v => patchCrt({ edgeDefocus: v })}
            />
            <SliderRow
              label="Grain"
              value={scope.crt.grain}
              onChange={v => patchCrt({ grain: v })}
            />
            <SelectRow
              label="Graticule"
              value={scope.crt.graticuleStyle}
              onChange={v => patchCrt({ graticuleStyle: v as ScopeGraticuleStyle })}
              description="A reference overlay for reading the display. Not calibrated measurement."
              options={[
                { value: 'none',        label: 'None' },
                { value: 'minimal',     label: 'Centre Axes' },
                { value: 'scope',       label: 'Scope Grid' },
                { value: 'vectorscope', label: 'Vectorscope Rings' },
              ]}
            />
            {scope.crt.graticuleStyle !== 'none' && (
              <SliderRow
                label="Graticule Brightness"
                value={scope.crt.graticuleBrightness}
                onChange={v => patchCrt({ graticuleBrightness: v })}
              />
            )}
          </>
        )}
      </Collapsible>

      <Collapsible label="Advanced Signal Conditioning" defaultOpen={false}>
        <ToggleRow
          label="Auto Gain"
          value={scope.signalConditioner.autoGain}
          onChange={v => patchConditioner({ autoGain: v })}
          description="Keeps the figure filling the display whatever the track level. Off to set the gain by hand."
        />
        {scope.signalConditioner.autoGain && (
          <SliderRow
            label="Fill Amount"
            value={scope.signalConditioner.autoGainTarget}
            onChange={v => patchConditioner({ autoGainTarget: v })}
            min={0.2}
            max={1}
            step={0.01}
          />
        )}
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
        <ToggleRow
          label="Link X/Y Trim"
          value={gainLink.linked}
          onChange={linked => {
            if (linked) set({ scope: relinkScopeAxisGains(scope) })
            else patchScope({ axisGainLinked: false })
          }}
          description={gainLink.linked
            ? 'Linked. Post Auto-Gain Trim writes both canonical axes.'
            : 'Custom X/Y. Relinking explicitly replaces both axes with their average.'}
        />
        <SliderRow
          label={`Post Auto-Gain Trim · ${gainLink.label}`}
          value={gainLink.linkedValue ?? (scope.signalConditioner.gainX + scope.signalConditioner.gainY) / 2}
          onChange={v => patchScope({
            axisGainLinked: true,
            signalConditioner: { ...scope.signalConditioner, gainX: v, gainY: v },
          })}
          min={0.1}
          max={8}
          step={0.1}
          disabled={!gainLink.linked}
          description="Smoothed signal-domain calibration after Auto Gain. This is not the primary visual-size control."
        />
        {!gainLink.linked && (
          <button type="button" className="rv-reset-btn" onClick={() => set({ scope: relinkScopeAxisGains(scope) })}>
            Relink X/Y at Average
          </button>
        )}
        <SliderRow
          label="X Trim"
          value={scope.signalConditioner.gainX}
          onChange={v => patchScope({
            axisGainLinked: false,
            signalConditioner: { ...scope.signalConditioner, gainX: v },
          })}
          min={0.1}
          max={8}
          step={0.1}
          disabled={!xGainActive}
          description={xGainActive
            ? 'Independent horizontal signal calibration. Editing it unlinks X and Y.'
            : 'Unavailable in waveform modes: horizontal position is timebase-driven, so X Trim does not control vertical amplitude.'}
        />
        <SliderRow
          label="Y Trim"
          value={scope.signalConditioner.gainY}
          onChange={v => patchScope({
            axisGainLinked: false,
            signalConditioner: { ...scope.signalConditioner, gainY: v },
          })}
          min={0.1}
          max={8}
          step={0.1}
          description="Independent vertical signal calibration. Editing it unlinks X and Y."
        />
        <p className="rv-ctrl-info">
          Resolved settled factors: X {scaleDiagnostics.settledXFactor.toFixed(2)}× · Y {scaleDiagnostics.settledYFactor.toFixed(2)}×
          {' '}(Visual Size {scaleDiagnostics.traceSize.toFixed(2)} × post-auto-gain trim). Auto Gain remains dynamic and separate.
        </p>
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
