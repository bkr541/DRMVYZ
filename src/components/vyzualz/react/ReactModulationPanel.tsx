import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, SelectRow, CtrlSection } from './ReactControlRows'
import type { OscillatorAudioDisplaceMode } from './ReactTypes'

// ── MOD panel ─────────────────────────────────────────────────────────────────
// Controls how audio/music data drives the active visual engine.
// Broad creative sliders (Intensity, Glow, Bass React) live in FX.
// Per-frequency and displacement routing live here.

export function ReactModulationPanel() {
  const {
    activeReactEngineId,
    oscillatorSettings, setOscillatorSettings,
  } = useReactStore(useShallow(s => ({
    activeReactEngineId:   s.activeReactEngineId,
    oscillatorSettings:    s.oscillatorSettings,
    setOscillatorSettings: s.setOscillatorSettings,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  const isSoundDrawing = activeReactEngineId === 'oscilloscope'

  // ── Non-oscilloscope engines: no per-frequency routing exists yet ──────────
  if (!isSoundDrawing) {
    return (
      <div className="rv-ctrl-group">
        <CtrlSection label="Audio Routing" />
        <div className="rv-ctrl-info">
          This engine currently uses global intensity/motion controls only.
          Adjust Bass React and Motion in the FX tab for broad audio response.
        </div>
        {/*
         * TODO: Add engine-specific audio routing when shaderPads and
         * cinematicPortal renderers expose per-frequency param hooks
         * (e.g. bassParticleScale, beatRingExpansion, fogPulseBass).
         */}
      </div>
    )
  }

  // ── Oscilloscope: full per-frequency routing ──────────────────────────────
  return (
    <div className="rv-ctrl-group">

      {/* ── Audio Reactivity: displacement routing ───────────────────── */}
      <CtrlSection label="Audio Reactivity" />
      <SelectRow
        label="Displace Mode"
        value={osc.audioDisplaceMode}
        onChange={v => set({ audioDisplaceMode: v as OscillatorAudioDisplaceMode })}
        options={[
          { value: 'normal',  label: 'Normal'  },
          { value: 'radial',  label: 'Radial'  },
          { value: 'tangent', label: 'Tangent' },
          { value: 'xy',      label: 'XY'      },
        ]}
      />
      <SliderRow
        label="Displacement"
        value={osc.audioDisplacement}
        onChange={v => set({ audioDisplacement: v })}
        color="#4ac7db"
      />

      {/* ── Frequency Response: per-band modulation amounts ──────────── */}
      <CtrlSection label="Frequency Response" />
      <SliderRow
        label="Bass → Scale"
        value={osc.bassScale}
        onChange={v => set({ bassScale: v })}
        color="#d8b95a"
      />
      <SliderRow
        label="Mid → Twist"
        value={osc.midTwist}
        onChange={v => set({ midTwist: v })}
        color="#61d6aa"
      />
      <SliderRow
        label="High → Jitter"
        value={osc.highJitter}
        onChange={v => set({ highJitter: v })}
        color="#b84fc9"
      />
      <SliderRow
        label="Beat → Bloom"
        value={osc.beatBloom}
        onChange={v => set({ beatBloom: v })}
        color="#c0314a"
      />

      {/*
       * TODO: Motion Response group — add audio-driven rotation speed,
       * beat-pulse scale, and warp-response controls here once the
       * SoundDrawingRenderer exposes per-frame audio callbacks for those
       * parameters.  rotationSpeed is currently a constant and lives in
       * FX → Path until it becomes reactively modulated.
       */}

    </div>
  )
}
