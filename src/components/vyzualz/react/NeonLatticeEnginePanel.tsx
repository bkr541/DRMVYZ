import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, SelectRow, ToggleRow, Collapsible } from './ReactControlRows'
import type { NeonLatticeTrigger, NeonLatticeSnapDivision, NeonLatticeDecayStyle, NeonLatticeBlackoutMode, NeonLatticeSettings } from './ReactTypes'
import { clamp01 } from './renderers/reactRenderUtils'

function clampPosNum(v: number, min = 0, max = Infinity): number {
  return Math.max(min, Math.min(max, v))
}

export function NeonLatticeEnginePanel() {
  const { settings, setNeonLatticeSettings, resetNeonLatticeSettings } = useReactStore(
    useShallow(s => ({
      settings:                 s.neonLatticeSettings,
      setNeonLatticeSettings:   s.setNeonLatticeSettings,
      resetNeonLatticeSettings: s.resetNeonLatticeSettings,
    })),
  )

  const set = (partial: Parameters<typeof setNeonLatticeSettings>[0]) =>
    setNeonLatticeSettings(partial)

  return (
    <>
      {/* ── Structure ──────────────────────────────────────────────────────── */}
      <Collapsible label="Structure" defaultOpen>
        <SliderRow
          label="Rail Density"
          value={settings.railDensity}
          min={0} max={1} step={0.01}
          onChange={v => set({ railDensity: clamp01(v) })}
        />
        <SliderRow
          label="Vertical Bias"
          value={settings.verticalBias}
          min={0} max={1} step={0.01}
          onChange={v => set({ verticalBias: clamp01(v) })}
        />
        <SliderRow
          label="Center Bias"
          value={settings.centerBias}
          min={0} max={1} step={0.01}
          onChange={v => set({ centerBias: clamp01(v) })}
        />
        <SliderRow
          label="Rail Lifetime (s)"
          value={settings.railLifetime}
          min={0.5} max={12} step={0.1}
          onChange={v => set({ railLifetime: clampPosNum(v, 0.5, 12) })}
        />
        <SliderRow
          label="Block Density"
          value={settings.blockDensity}
          min={0} max={1} step={0.01}
          onChange={v => set({ blockDensity: clamp01(v) })}
        />
        <SliderRow
          label="Block Hold (s)"
          value={settings.blockHold}
          min={0.1} max={4} step={0.05}
          onChange={v => set({ blockHold: clampPosNum(v, 0.1, 4) })}
        />
      </Collapsible>

      {/* ── Musical Timing ────────────────────────────────────────────────── */}
      <Collapsible label="Musical Timing" defaultOpen>
        <SelectRow
          label="Pulse Trigger"
          value={settings.trigger}
          onChange={v => set({ trigger: v as NeonLatticeTrigger })}
          options={[
            { value: 'none',      label: 'None'      },
            { value: 'beat',      label: 'Beat'      },
            { value: 'downbeat',  label: 'Downbeat'  },
            { value: 'kick',      label: 'Kick'      },
            { value: 'snare',     label: 'Snare'     },
            { value: 'drop',      label: 'Drop'      },
          ]}
        />
        <SliderRow
          label="Pulse Speed"
          value={settings.pulseSpeed}
          min={0} max={1} step={0.01}
          onChange={v => set({ pulseSpeed: clamp01(v) })}
        />
        <SelectRow
          label="Snap Division"
          value={String(settings.snapDivision)}
          onChange={v => set({ snapDivision: Number(v) as NeonLatticeSnapDivision })}
          options={[
            { value: '1',  label: '1 (whole)'   },
            { value: '2',  label: '1/2'         },
            { value: '4',  label: '1/4 (beat)'  },
            { value: '8',  label: '1/8'         },
            { value: '16', label: '1/16'        },
          ]}
        />
        <SliderRow
          label="Reseed Interval (bars)"
          value={settings.reseedInterval}
          min={0} max={64} step={1}
          onChange={v => set({ reseedInterval: Math.round(clampPosNum(v, 0, 64)) })}
        />
      </Collapsible>

      <div className="rv-ctrl-footer">
        <button
          type="button"
          className="rv-reset-btn"
          onClick={resetNeonLatticeSettings}
          title="Reset all Neon Lattice settings to defaults"
        >
          Reset Engine Settings
        </button>
      </div>
    </>
  )
}

/** Visual styling controls shown in the FX tab for Neon Lattice. */
export function NeonLatticeFxControls() {
  const {
    settings,
    trailDecay,
    setNeonLatticeSettings,
    setReactTrailDecay,
  } = useReactStore(useShallow(s => ({
    settings:                 s.neonLatticeSettings,
    trailDecay:               s.reactTrailDecay,
    setNeonLatticeSettings:   s.setNeonLatticeSettings,
    setReactTrailDecay:       s.setReactTrailDecay,
  })))

  const set = (partial: Partial<NeonLatticeSettings>) => setNeonLatticeSettings(partial)

  return (
    <>
      <Collapsible label="Lattice Finish" defaultOpen>
        <SliderRow
          label="Trail Persistence"
          value={1 - trailDecay}
          onChange={v => setReactTrailDecay(1 - clamp01(v))}
          color="#4ac7db"
          description="Longer persistence leaves brighter rail paths behind moving pulses."
        />
        <SelectRow
          label="Trail Character"
          value={settings.decayStyle}
          onChange={v => set({ decayStyle: v as NeonLatticeDecayStyle })}
          options={[
            { value: 'exponential', label: 'Smooth Fade' },
            { value: 'linear',      label: 'Linear Fade' },
            { value: 'hold',        label: 'Hold and Cut' },
            { value: 'pulse',       label: 'Pulsing Decay' },
          ]}
        />
        <SliderRow label="Rail Bloom" value={settings.bloom} onChange={v => set({ bloom: clamp01(v) })} color="#b84fc9" />
        <SliderRow label="Intersection Flares" value={settings.flareAmount} onChange={v => set({ flareAmount: clamp01(v) })} color="#d8b95a" />
        <SliderRow label="Impact Shockwaves" value={settings.shockwaveAmount} onChange={v => set({ shockwaveAmount: clamp01(v) })} color="#61d6aa" />
        <SliderRow label="Cyan Accent Mix" value={settings.cyanAccentChance} onChange={v => set({ cyanAccentChance: clamp01(v) })} color="#4ac7db" />
      </Collapsible>

      <Collapsible label="Camera and Depth" defaultOpen>
        <SliderRow label="Depth Separation" value={settings.depth} onChange={v => set({ depth: clamp01(v) })} color="#61d6aa" />
        <SliderRow label="Parallax" value={settings.parallax} onChange={v => set({ parallax: clamp01(v) })} color="#4ac7db" />
        <SliderRow label="Camera Drift" value={settings.cameraMotion} onChange={v => set({ cameraMotion: clamp01(v) })} color="#d8b95a" />
      </Collapsible>

      <Collapsible label="Performance Gating" defaultOpen>
        <SelectRow
          label="Blackout Mode"
          value={settings.blackoutMode}
          onChange={v => set({ blackoutMode: v as NeonLatticeBlackoutMode })}
          options={[
            { value: 'none',    label: 'Off' },
            { value: 'instant', label: 'Impact Cut' },
            { value: 'fadeOut', label: 'Pre-Drop Fade' },
            { value: 'strobe',  label: 'Black Strobe' },
          ]}
        />
      </Collapsible>
    </>
  )
}

/** Audio and Music Intelligence routing shown in the MOD tab. */
export function NeonLatticeModulationControls() {
  const { settings, setNeonLatticeSettings } = useReactStore(
    useShallow(s => ({
      settings:               s.neonLatticeSettings,
      setNeonLatticeSettings: s.setNeonLatticeSettings,
    })),
  )
  const set = (partial: Partial<NeonLatticeSettings>) => setNeonLatticeSettings(partial)
  const disabled = !settings.audioReactive

  return (
    <>
      <Collapsible label="Audio Reaction" defaultOpen>
        <ToggleRow
          label="Reactive Engine"
          value={settings.audioReactive}
          onChange={audioReactive => set({ audioReactive })}
          description="Disables audio modulation while preserving the authored lattice look."
        />
        <SliderRow label="Response Smoothing" value={settings.audioSmoothing} onChange={v => set({ audioSmoothing: clamp01(v) })} disabled={disabled} color="#61d6aa" />
        <SliderRow label="Noise Gate" value={settings.audioGate} onChange={v => set({ audioGate: clamp01(v) })} disabled={disabled} color="#d8b95a" />
      </Collapsible>

      <Collapsible label="Frequency Routing" defaultOpen>
        <SliderRow label="Bass → Brightness" value={settings.bassBrightnessResponse} onChange={v => set({ bassBrightnessResponse: clamp01(v) })} disabled={disabled} color="#d8b95a" />
        <SliderRow label="Kick → Vertical Rails" value={settings.kickRailResponse} onChange={v => set({ kickRailResponse: clamp01(v) })} disabled={disabled} color="#c0314a" />
        <SliderRow label="Snare → Horizontal Rails" value={settings.snareRailResponse} onChange={v => set({ snareRailResponse: clamp01(v) })} disabled={disabled} color="#4ac7db" />
        <SliderRow label="Beat → Pulses" value={settings.beatPulseResponse} onChange={v => set({ beatPulseResponse: clamp01(v) })} disabled={disabled} color="#61d6aa" />
        <SliderRow label="Mids → Blocks" value={settings.midBlockResponse} onChange={v => set({ midBlockResponse: clamp01(v) })} disabled={disabled} color="#b84fc9" />
        <SliderRow label="Highs → Flares" value={settings.highFlareResponse} onChange={v => set({ highFlareResponse: clamp01(v) })} disabled={disabled} color="#4ac7db" />
      </Collapsible>

      <Collapsible label="Music Intelligence" defaultOpen>
        <SliderRow label="Energy → Rail Density" value={settings.energyDensityResponse} onChange={v => set({ energyDensityResponse: clamp01(v) })} disabled={disabled} color="#4ac7db" />
        <SliderRow label="Build → Motion" value={settings.buildMotionResponse} onChange={v => set({ buildMotionResponse: clamp01(v) })} disabled={disabled} color="#61d6aa" />
        <SliderRow label="Drop → Shockwaves" value={settings.dropImpactResponse} onChange={v => set({ dropImpactResponse: clamp01(v) })} disabled={disabled} color="#c0314a" />
        <SliderRow label="Section Dynamics" value={settings.sectionDynamics} onChange={v => set({ sectionDynamics: clamp01(v) })} disabled={disabled} color="#d8b95a" />
      </Collapsible>
    </>
  )
}
