import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { NumberInputRow, SliderRow, SelectRow, ToggleRow, Collapsible } from './ReactControlRows'
import type {
  NeonLatticeBlackoutMode,
  NeonLatticeCompositionMode,
  NeonLatticeDecayStyle,
  NeonLatticeDiscreteTriggerSource,
  NeonLatticeLaneAssignmentMode,
  NeonLatticePaletteRole,
  NeonLatticeQualityTier,
  NeonLatticeSettings,
  NeonLatticeSnapDivision,
  NeonLatticeSpanMode,
  NeonLatticeTrigger,
} from './ReactTypes'
import { DEFAULT_NEON_LATTICE_SETTINGS } from './ReactTypes'
import { clamp01 } from './renderers/reactRenderUtils'

function clampNumber(value: number, min = 0, max = Infinity): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function GroupResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="rv-ctrl-footer">
      <button type="button" className="rv-reset-btn" onClick={onClick} aria-label={label}>{label}</button>
    </div>
  )
}

const SPAN_OPTIONS = [
  { value: 'presetDefined', label: 'Preset Defined' },
  { value: 'fullCanvas', label: 'Full Canvas' },
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
  { value: 'random', label: 'Deterministic Random' },
]

const PALETTE_ROLE_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'accent', label: 'Accent' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'background', label: 'Background' },
]

export function NeonLatticeEnginePanel() {
  const {
    settings,
    setNeonLatticeSettings,
    resetNeonLatticeSettings,
    resetNeonLatticeSettingsToPreset,
    triggerPerformanceAction,
  } = useReactStore(useShallow(s => ({
    settings: s.neonLatticeSettings,
    setNeonLatticeSettings: s.setNeonLatticeSettings,
    resetNeonLatticeSettings: s.resetNeonLatticeSettings,
    resetNeonLatticeSettingsToPreset: s.resetNeonLatticeSettingsToPreset,
    triggerPerformanceAction: s.triggerPerformanceAction,
  })))

  const set = (partial: Partial<NeonLatticeSettings>) => setNeonLatticeSettings(partial)
  const setPattern = (partial: Partial<NeonLatticeSettings['lanePattern']>) => set({
    lanePattern: { ...settings.lanePattern, ...partial },
  })
  const setEnvelope = (partial: Partial<NeonLatticeSettings['lineEnvelope']>) => set({
    lineEnvelope: { ...settings.lineEnvelope, ...partial },
  })
  const setOrientation = (key: keyof NeonLatticeSettings['orientationWeights'], value: number) => set({
    orientationWeights: { ...settings.orientationWeights, [key]: clamp01(value) },
  })

  const laneEnabled = settings.compositionMode !== 'legacyLattice'
  const legacyEnabled = settings.compositionMode !== 'laneSequencer'
  const diagonalEnabled = settings.orientationWeights.diagonalUp > 0 || settings.orientationWeights.diagonalDown > 0

  return (
    <>
      <Collapsible label="Composition" defaultOpen>
        <SelectRow
          label="Composition Mode"
          value={settings.compositionMode}
          onChange={value => set({ compositionMode: value as NeonLatticeCompositionMode })}
          options={[
            { value: 'legacyLattice', label: 'Legacy Lattice' },
            { value: 'laneSequencer', label: 'Lane Sequencer' },
            { value: 'hybrid', label: 'Hybrid' },
          ]}
          description="Legacy preserves autonomous lattice behavior. Lane Sequencer uses authored musical lanes. Hybrid combines both."
        />
        {legacyEnabled && (
          <>
            <SliderRow label="Rail Density" value={settings.railDensity} onChange={value => set({ railDensity: clamp01(value) })} />
            <SliderRow label="Center Bias" value={settings.centerBias} onChange={value => set({ centerBias: clamp01(value) })} />
            <SliderRow label="Rail Lifetime (s)" value={settings.railLifetime} min={0.5} max={12} step={0.1} onChange={value => set({ railLifetime: clampNumber(value, 0.5, 12) })} />
          </>
        )}
      </Collapsible>

      {laneEnabled && (
        <Collapsible label="Authored Lane Pattern" defaultOpen>
          <SliderRow
            label="Lane Count"
            value={settings.lanePattern.laneCount}
            min={1} max={32} step={1}
            onChange={value => setPattern({ laneCount: Math.round(clampNumber(value, 1, 32)) })}
            description="The number of stable line positions available to the sequencer."
          />
          <SliderRow
            label="Pattern Length"
            value={settings.lanePattern.sequenceLength}
            min={1} max={64} step={1}
            onChange={value => setPattern({ sequenceLength: Math.round(clampNumber(value, 1, 64)) })}
            description="How many authored steps repeat before the lane pattern wraps."
          />
          <SelectRow
            label="Lane Assignment Mode"
            value={settings.laneAssignmentMode}
            onChange={value => set({ laneAssignmentMode: value as NeonLatticeLaneAssignmentMode })}
            options={[
              { value: 'sequence', label: 'Sequence Offset' },
              { value: 'centerOut', label: 'Center Out' },
              { value: 'outsideIn', label: 'Outside In' },
              { value: 'random', label: 'Seeded Random' },
              { value: 'presetDefined', label: 'Preset Steps' },
            ]}
          />
          <SliderRow label="Chord Size" value={settings.chordSize} min={1} max={16} step={1} onChange={value => set({ chordSize: Math.round(clampNumber(value, 1, 16)) })} />
          <ToggleRow label="Mirror Layout" value={settings.lanePattern.mirrored} onChange={mirrored => setPattern({ mirrored })} />
          <NumberInputRow label="Pattern Seed" value={settings.lanePattern.seed} min={1} max={2147483647} step={1} onChange={value => setPattern({ seed: Math.round(clampNumber(value, 1, 2147483647)) })} />
          <div className="rv-ctrl-footer">
            <button
              type="button"
              className="rv-reset-btn"
              onClick={() => triggerPerformanceAction('neonLattice.reseed')}
              aria-label="Reseed active Neon Lattice pattern"
              title="Reseed the live pattern without changing stored settings"
            >
              Reseed Active Pattern
            </button>
          </div>
        </Collapsible>
      )}

      <Collapsible label="Orientation and Span" defaultOpen>
        <SliderRow label="Vertical Weight" value={settings.orientationWeights.vertical} onChange={value => setOrientation('vertical', value)} />
        <SliderRow label="Horizontal Weight" value={settings.orientationWeights.horizontal} onChange={value => setOrientation('horizontal', value)} />
        <SliderRow label="Diagonal-Up Weight" value={settings.orientationWeights.diagonalUp} onChange={value => setOrientation('diagonalUp', value)} />
        <SliderRow label="Diagonal-Down Weight" value={settings.orientationWeights.diagonalDown} onChange={value => setOrientation('diagonalDown', value)} />
        <SliderRow
          label="Diagonal Angle"
          value={settings.diagonalAngleDegrees}
          min={10} max={80} step={1}
          disabled={!diagonalEnabled}
          onChange={value => set({ diagonalAngleDegrees: clampNumber(value, 10, 80) })}
          description="Enabled when either diagonal orientation has a non-zero weight."
        />
        <SelectRow label="Vertical Span" value={settings.verticalSpanMode} onChange={value => set({ verticalSpanMode: value as NeonLatticeSpanMode })} options={SPAN_OPTIONS} />
        <SelectRow label="Horizontal Span" value={settings.horizontalSpanMode} onChange={value => set({ horizontalSpanMode: value as NeonLatticeSpanMode })} options={SPAN_OPTIONS} />
        <SelectRow label="Diagonal Span" value={settings.diagonalSpanMode} disabled={!diagonalEnabled} onChange={value => set({ diagonalSpanMode: value as NeonLatticeSpanMode })} options={SPAN_OPTIONS} />
        {laneEnabled && (
          <SliderRow
            label="Gate Length (beats)"
            value={settings.lineEnvelope.gateLengthBeats}
            min={0.0625} max={16} step={0.0625}
            onChange={value => setEnvelope({ gateLengthBeats: clampNumber(value, 0.0625, 16) })}
            description="How long an authored line stays held in musical beats before release."
          />
        )}
      </Collapsible>

      <Collapsible label="Musical Timing" defaultOpen>
        <SelectRow
          label="Pulse Trigger"
          value={settings.trigger}
          onChange={value => set({ trigger: value as NeonLatticeTrigger })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'beat', label: 'Beat' },
            { value: 'downbeat', label: 'Downbeat' },
            { value: 'kick', label: 'Kick' },
            { value: 'snare', label: 'Snare' },
            { value: 'drop', label: 'Drop' },
          ]}
        />
        <SliderRow label="Pulse Speed" value={settings.pulseSpeed} onChange={value => set({ pulseSpeed: clamp01(value) })} />
        <SelectRow
          label="Snap Division"
          value={String(settings.snapDivision)}
          onChange={value => set({ snapDivision: Number(value) as NeonLatticeSnapDivision })}
          options={[
            { value: '1', label: 'Whole Note' },
            { value: '2', label: 'Half Note' },
            { value: '4', label: 'Quarter Note' },
            { value: '8', label: 'Eighth Note' },
            { value: '16', label: 'Sixteenth Note' },
          ]}
        />
        <SliderRow label="Reseed Interval (bars)" value={settings.reseedInterval} min={0} max={64} step={1} onChange={value => set({ reseedInterval: Math.round(clampNumber(value, 0, 64)) })} />
      </Collapsible>

      <div className="rv-ctrl-footer">
        <button type="button" className="rv-reset-btn" onClick={resetNeonLatticeSettingsToPreset} title="Restore values authored by the selected preset">Reset to Current Preset</button>
        <button type="button" className="rv-reset-btn" onClick={resetNeonLatticeSettings} title="Reset all Neon Lattice settings to defaults">Reset Engine Settings</button>
      </div>
    </>
  )
}

/** Visual styling controls shown in the FX tab for Neon Lattice. */
export function NeonLatticeFxControls() {
  const { settings, trailDecay, setNeonLatticeSettings, setReactTrailDecay } = useReactStore(useShallow(s => ({
    settings: s.neonLatticeSettings,
    trailDecay: s.reactTrailDecay,
    setNeonLatticeSettings: s.setNeonLatticeSettings,
    setReactTrailDecay: s.setReactTrailDecay,
  })))
  const set = (partial: Partial<NeonLatticeSettings>) => setNeonLatticeSettings(partial)
  const setEnvelope = (partial: Partial<NeonLatticeSettings['lineEnvelope']>) => set({
    lineEnvelope: { ...settings.lineEnvelope, ...partial },
  })

  return (
    <>
      <Collapsible label="Line Layering" defaultOpen>
        <SliderRow label="Core Width" value={settings.coreWidth} min={0.1} max={4} step={0.05} onChange={value => set({ coreWidth: clampNumber(value, 0.1, 4) })} />
        <SliderRow label="Body Width" value={settings.bodyWidth} min={0.1} max={8} step={0.05} onChange={value => set({ bodyWidth: clampNumber(value, 0.1, 8) })} />
        <SliderRow label="Halo Width" value={settings.haloWidth} min={0} max={20} step={0.1} onChange={value => set({ haloWidth: clampNumber(value, 0, 20) })} />
        <SliderRow label="Core Intensity" value={settings.coreIntensity} min={0} max={2} step={0.01} onChange={value => set({ coreIntensity: clampNumber(value, 0, 2) })} />
        <SliderRow label="Body Intensity" value={settings.bodyIntensity} min={0} max={2} step={0.01} onChange={value => set({ bodyIntensity: clampNumber(value, 0, 2) })} />
        <SliderRow label="Halo Intensity" value={settings.haloIntensity} onChange={value => set({ haloIntensity: clamp01(value) })} />
        <SliderRow label="Halo Falloff" value={settings.haloFalloff} onChange={value => set({ haloFalloff: clamp01(value) })} />
        <ToggleRow label="White-Hot Center" value={settings.highlightCenterHot} onChange={highlightCenterHot => set({ highlightCenterHot })} />
        <GroupResetButton
          label="Reset Line Finish"
          onClick={() => set({
            coreWidth: DEFAULT_NEON_LATTICE_SETTINGS.coreWidth,
            bodyWidth: DEFAULT_NEON_LATTICE_SETTINGS.bodyWidth,
            haloWidth: DEFAULT_NEON_LATTICE_SETTINGS.haloWidth,
            coreIntensity: DEFAULT_NEON_LATTICE_SETTINGS.coreIntensity,
            bodyIntensity: DEFAULT_NEON_LATTICE_SETTINGS.bodyIntensity,
            haloIntensity: DEFAULT_NEON_LATTICE_SETTINGS.haloIntensity,
            haloFalloff: DEFAULT_NEON_LATTICE_SETTINGS.haloFalloff,
            highlightCenterHot: DEFAULT_NEON_LATTICE_SETTINGS.highlightCenterHot,
          })}
        />
      </Collapsible>

      <Collapsible label="Envelope" defaultOpen>
        <SliderRow label="Attack (beats)" value={settings.lineEnvelope.attackBeats} min={0} max={4} step={0.01} onChange={value => setEnvelope({ attackBeats: clampNumber(value, 0, 4) })} />
        <SliderRow label="Hold (beats)" value={settings.lineEnvelope.holdBeats} min={0} max={16} step={0.05} onChange={value => setEnvelope({ holdBeats: clampNumber(value, 0, 16) })} />
        <SliderRow label="Gate (beats)" value={settings.lineEnvelope.gateLengthBeats} min={0.0625} max={16} step={0.0625} onChange={value => setEnvelope({ gateLengthBeats: clampNumber(value, 0.0625, 16) })} />
        <SliderRow label="Release (beats)" value={settings.lineEnvelope.releaseBeats} min={0.01} max={8} step={0.01} onChange={value => setEnvelope({ releaseBeats: clampNumber(value, 0.01, 8) })} />
      </Collapsible>

      <Collapsible label="Bloom and Trails" defaultOpen>
        <SliderRow label="Trail Persistence" value={1 - trailDecay} onChange={value => setReactTrailDecay(1 - clamp01(value))} description="Longer persistence leaves brighter rail paths on the same capture-safe canvas." />
        <SelectRow
          label="Trail Character"
          value={settings.decayStyle}
          onChange={value => set({ decayStyle: value as NeonLatticeDecayStyle })}
          options={[
            { value: 'exponential', label: 'Smooth Fade' },
            { value: 'linear', label: 'Linear Fade' },
            { value: 'hold', label: 'Hold and Cut' },
            { value: 'pulse', label: 'Pulsing Decay' },
          ]}
        />
        <SliderRow label="Bloom Spread" value={settings.bloomSpread} min={0.25} max={2} step={0.01} onChange={value => set({ bloomSpread: clampNumber(value, 0.25, 2) })} />
        <SliderRow label="Bloom Gain" value={settings.bloomGain} min={0} max={1.5} step={0.01} onChange={value => set({ bloomGain: clampNumber(value, 0, 1.5) })} />
        <SliderRow label="Rail Bloom" value={settings.bloom} min={0} max={2} step={0.01} onChange={value => set({ bloom: clampNumber(value, 0, 2) })} />
        <SliderRow label="Line Flicker" value={settings.lineFlicker} onChange={value => set({ lineFlicker: clamp01(value) })} />
        <SliderRow label="Chord Bloom Boost" value={settings.chordBloomBoost} onChange={value => set({ chordBloomBoost: clamp01(value) })} />
        <SliderRow label="Phrase Flash Strength" value={settings.phraseFlashStrength} onChange={value => set({ phraseFlashStrength: clamp01(value) })} />
      </Collapsible>

      <Collapsible label="Palette and Quality" defaultOpen>
        <SelectRow
          label="Legacy Strike Color Role"
          value={settings.cyanStrikePaletteRole}
          onChange={value => set({ cyanStrikePaletteRole: value as NeonLatticePaletteRole })}
          options={PALETTE_ROLE_OPTIONS}
          description="The legacy cyanStrike action ID is preserved, but its color follows this Brand Kit role."
        />
        <SliderRow label="Accent Role Mix" value={settings.cyanAccentChance} onChange={value => set({ cyanAccentChance: clamp01(value) })} description="Legacy field preserved for preset compatibility. Color is resolved from the active palette." />
        <SelectRow
          label="Quality Tier"
          value={settings.qualityTier}
          onChange={value => set({ qualityTier: value as NeonLatticeQualityTier })}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          description="Scales halo passes, bloom resolution, flares, pulses, and simultaneous lines."
        />
      </Collapsible>

      <Collapsible label="Camera, Accents, and Gating" defaultOpen>
        <SliderRow label="Intersection Flares" value={settings.flareAmount} onChange={value => set({ flareAmount: clamp01(value) })} />
        <SliderRow label="Impact Shockwaves" value={settings.shockwaveAmount} onChange={value => set({ shockwaveAmount: clamp01(value) })} />
        <SliderRow label="Block Density" value={settings.blockDensity} onChange={value => set({ blockDensity: clamp01(value) })} />
        <SliderRow label="Block Hold (s)" value={settings.blockHold} min={0.1} max={4} step={0.05} onChange={value => set({ blockHold: clampNumber(value, 0.1, 4) })} />
        <SliderRow label="Depth Separation" value={settings.depth} onChange={value => set({ depth: clamp01(value) })} />
        <SliderRow label="Parallax" value={settings.parallax} onChange={value => set({ parallax: clamp01(value) })} />
        <SliderRow label="Camera Drift" value={settings.cameraMotion} onChange={value => set({ cameraMotion: clamp01(value) })} />
        <SelectRow
          label="Blackout Mode"
          value={settings.blackoutMode}
          onChange={value => set({ blackoutMode: value as NeonLatticeBlackoutMode })}
          options={[
            { value: 'none', label: 'Off' },
            { value: 'instant', label: 'Impact Cut' },
            { value: 'fadeOut', label: 'Pre-Drop Fade' },
            { value: 'strobe', label: 'Black Strobe' },
          ]}
        />
      </Collapsible>
    </>
  )
}

function routeAmount(settings: NeonLatticeSettings, source: NeonLatticeDiscreteTriggerSource): number {
  return settings.triggerRoutes.find(route => route.source === source)?.amount ?? 0
}

/** Audio and Music Intelligence routing shown in the MOD tab. */
export function NeonLatticeModulationControls() {
  const { settings, setNeonLatticeSettings } = useReactStore(useShallow(s => ({
    settings: s.neonLatticeSettings,
    setNeonLatticeSettings: s.setNeonLatticeSettings,
  })))
  const set = (partial: Partial<NeonLatticeSettings>) => setNeonLatticeSettings(partial)
  const disabled = !settings.audioReactive
  const setRouteAmount = (source: NeonLatticeDiscreteTriggerSource, amount: number) => set({
    triggerRoutes: settings.triggerRoutes.map(route => route.source === source
      ? { ...route, enabled: amount > 0, amount: clamp01(amount) }
      : route),
  })
  const setMod = (key: keyof NeonLatticeSettings['modulationRoutes'], value: number) => set({
    modulationRoutes: { ...settings.modulationRoutes, [key]: clamp01(value) },
  })

  return (
    <>
      <Collapsible label="Audio Reaction" defaultOpen>
        <ToggleRow label="Reactive Engine" value={settings.audioReactive} onChange={audioReactive => set({ audioReactive })} description="Uses the canonical Music Intelligence frame. No Neon-specific analyzer or transport clock is created." />
        <SliderRow label="Response Smoothing" value={settings.audioSmoothing} onChange={value => set({ audioSmoothing: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Noise Gate" value={settings.audioGate} onChange={value => set({ audioGate: clamp01(value) })} disabled={disabled} />
      </Collapsible>

      <Collapsible label="Discrete Musical Triggers" defaultOpen>
        <SliderRow label="Beat → Lane Step" value={routeAmount(settings, 'beat')} onChange={value => setRouteAmount('beat', value)} disabled={disabled} />
        <SliderRow label="Downbeat → Chord" value={routeAmount(settings, 'downbeat')} onChange={value => setRouteAmount('downbeat', value)} disabled={disabled} />
        <SliderRow label="Kick → Pillar" value={routeAmount(settings, 'kick')} onChange={value => setRouteAmount('kick', value)} disabled={disabled} />
        <SliderRow label="Snare → Horizontal Strike" value={routeAmount(settings, 'snare')} onChange={value => setRouteAmount('snare', value)} disabled={disabled} />
        <SliderRow label="Hat → Thin Accent" value={routeAmount(settings, 'hat')} onChange={value => setRouteAmount('hat', value)} disabled={disabled} />
        <SliderRow label="Drop → Full Chord" value={routeAmount(settings, 'dropImpact')} onChange={value => setRouteAmount('dropImpact', value)} disabled={disabled} />
      </Collapsible>

      <Collapsible label="Continuous Modulation" defaultOpen>
        <SliderRow label="Bass → Bloom" value={settings.modulationRoutes.bassToBloom} onChange={value => setMod('bassToBloom', value)} disabled={disabled} />
        <SliderRow label="Bass → Width" value={settings.modulationRoutes.bassToWidth} onChange={value => setMod('bassToWidth', value)} disabled={disabled} />
        <SliderRow label="Energy → Chord Size" value={settings.modulationRoutes.energyToChordSize} onChange={value => setMod('energyToChordSize', value)} disabled={disabled} />
        <SliderRow label="Energy → Active Lanes" value={settings.modulationRoutes.energyToActiveLanes} onChange={value => setMod('energyToActiveLanes', value)} disabled={disabled} />
        <SliderRow label="Build → Pattern Rate" value={settings.modulationRoutes.buildToPatternRate} onChange={value => setMod('buildToPatternRate', value)} disabled={disabled} />
        <SliderRow label="Build → Density" value={settings.modulationRoutes.buildToDensity} onChange={value => setMod('buildToDensity', value)} disabled={disabled} />
      </Collapsible>

      <Collapsible label="Phrase Direction" defaultOpen>
        <SliderRow label="4 Beats → Accent Action" value={routeAmount(settings, 'phrase4')} onChange={value => setRouteAmount('phrase4', value)} disabled={disabled} description="Four beats are one standard 4/4 bar." />
        <SliderRow label="8 Beats → Layout Action" value={routeAmount(settings, 'phrase8')} onChange={value => setRouteAmount('phrase8', value)} disabled={disabled} description="Eight beats are two standard bars." />
        <SliderRow label="16 Beats → Phrase Action" value={routeAmount(settings, 'phrase16')} onChange={value => setRouteAmount('phrase16', value)} disabled={disabled} description="Sixteen beats are four standard bars." />
        <SliderRow label="32 Beats → Scene Action" value={routeAmount(settings, 'phrase32')} onChange={value => setRouteAmount('phrase32', value)} disabled={disabled} description="Thirty-two beats are eight standard bars and receive longest-boundary priority by default." />
        <SliderRow label="4-Beat Density Ramp" value={settings.modulationRoutes.phrase4ProgressToDensity} onChange={value => setMod('phrase4ProgressToDensity', value)} disabled={disabled} />
        <SliderRow label="8-Beat Bloom Widening" value={settings.modulationRoutes.phrase8ProgressToBloom} onChange={value => setMod('phrase8ProgressToBloom', value)} disabled={disabled} />
        <SliderRow label="16-Beat Lane Spacing" value={settings.modulationRoutes.phrase16ProgressToSpacing} onChange={value => setMod('phrase16ProgressToSpacing', value)} disabled={disabled} />
        <SliderRow label="32-Beat Diagonal Weight" value={settings.modulationRoutes.phrase32ProgressToDiagonalWeight} onChange={value => setMod('phrase32ProgressToDiagonalWeight', value)} disabled={disabled} />
      </Collapsible>

      <Collapsible label="Legacy Compatibility Routing" defaultOpen={false}>
        <SliderRow label="Bass → Brightness" value={settings.bassBrightnessResponse} onChange={value => set({ bassBrightnessResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Kick → Vertical Rails" value={settings.kickRailResponse} onChange={value => set({ kickRailResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Snare → Horizontal Rails" value={settings.snareRailResponse} onChange={value => set({ snareRailResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Beat → Pulses" value={settings.beatPulseResponse} onChange={value => set({ beatPulseResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Mids → Blocks" value={settings.midBlockResponse} onChange={value => set({ midBlockResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Highs → Flares" value={settings.highFlareResponse} onChange={value => set({ highFlareResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Energy → Rail Density" value={settings.energyDensityResponse} onChange={value => set({ energyDensityResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Build → Motion" value={settings.buildMotionResponse} onChange={value => set({ buildMotionResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Drop → Shockwaves" value={settings.dropImpactResponse} onChange={value => set({ dropImpactResponse: clamp01(value) })} disabled={disabled} />
        <SliderRow label="Section Dynamics" value={settings.sectionDynamics} onChange={value => set({ sectionDynamics: clamp01(value) })} disabled={disabled} />
      </Collapsible>
    </>
  )
}
