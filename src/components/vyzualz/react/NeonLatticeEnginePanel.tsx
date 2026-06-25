import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, SelectRow, ToggleRow, CtrlSection } from './ReactControlRows'
import type { NeonLatticeTrigger, NeonLatticeSnapDivision, NeonLatticeDecayStyle, NeonLatticeBlackoutMode } from './ReactTypes'
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
    <div className="rv-engine-panel rv-engine-panel--neonlattice">

      {/* ── Structure ──────────────────────────────────────────────────────── */}
      <CtrlSection label="Structure" />

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
      <SliderRow
        label="Cyan Accent Chance"
        value={settings.cyanAccentChance}
        min={0} max={1} step={0.01}
        onChange={v => set({ cyanAccentChance: clamp01(v) })}
      />
      <ToggleRow
        label="Shockwaves"
        value={settings.shockwaves}
        onChange={v => set({ shockwaves: v })}
      />
      <SelectRow
        label="Decay Style"
        value={settings.decayStyle}
        onChange={v => set({ decayStyle: v as NeonLatticeDecayStyle })}
        options={[
          { value: 'exponential', label: 'Exponential' },
          { value: 'linear',      label: 'Linear'      },
          { value: 'hold',        label: 'Hold'        },
          { value: 'pulse',       label: 'Pulse'       },
        ]}
      />

      {/* ── Motion and Depth ──────────────────────────────────────────────── */}
      <CtrlSection label="Motion and Depth" />

      <SliderRow
        label="Pulse Speed"
        value={settings.pulseSpeed}
        min={0} max={1} step={0.01}
        onChange={v => set({ pulseSpeed: clamp01(v) })}
      />
      <SliderRow
        label="Depth"
        value={settings.depth}
        min={0} max={1} step={0.01}
        onChange={v => set({ depth: clamp01(v) })}
      />
      <SliderRow
        label="Parallax"
        value={settings.parallax}
        min={0} max={1} step={0.01}
        onChange={v => set({ parallax: clamp01(v) })}
      />
      <SliderRow
        label="Camera Motion"
        value={settings.cameraMotion}
        min={0} max={1} step={0.01}
        onChange={v => set({ cameraMotion: clamp01(v) })}
      />

      {/* ── Accents ───────────────────────────────────────────────────────── */}
      <CtrlSection label="Accents" />

      <SliderRow
        label="Flare Amount"
        value={settings.flareAmount}
        min={0} max={1} step={0.01}
        onChange={v => set({ flareAmount: clamp01(v) })}
      />
      <SliderRow
        label="Bloom"
        value={settings.bloom}
        min={0} max={1} step={0.01}
        onChange={v => set({ bloom: clamp01(v) })}
      />
      <SelectRow
        label="Blackout Mode"
        value={settings.blackoutMode}
        onChange={v => set({ blackoutMode: v as NeonLatticeBlackoutMode })}
        options={[
          { value: 'none',    label: 'None'    },
          { value: 'instant', label: 'Instant' },
          { value: 'fadeOut', label: 'Fade Out'},
          { value: 'strobe',  label: 'Strobe'  },
        ]}
      />

      {/* ── Musical Timing ────────────────────────────────────────────────── */}
      <CtrlSection label="Musical Timing" />

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

      <div className="rv-engine-panel-reset">
        <button
          className="rv-btn rv-btn--ghost rv-btn--sm"
          onClick={resetNeonLatticeSettings}
          title="Reset all Neon Lattice settings to defaults"
        >
          Reset Engine Settings
        </button>
      </div>
    </div>
  )
}
