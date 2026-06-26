// ── AudioSmoother ─────────────────────────────────────────────────────────────
//
// One-pole IIR low-pass filter with separate attack and release time constants.
//
// The coefficient is: c = 1 - exp(-dt / tau)
// This makes the response frame-rate independent: running N steps of dt each
// produces the same result as one step of N*dt.  The value never overshoots
// because |c| < 1 guarantees we always move strictly toward (not past) the target.

export class AudioSmoother {
  private _value = 0
  private _peakValue = 0
  private _holdTimer = 0

  constructor(
    private readonly _attackSec: number,
    private readonly _releaseSec: number,
    private readonly _peakHoldSec = 0,  // 0 = peak hold disabled
  ) {}

  /**
   * Advance the smoother by `dt` seconds toward `target` (clamped 0–1).
   * Returns the updated smoothed value.
   */
  update(target: number, dt: number): number {
    const t = safeClamp01(target)
    const tau = this._value < t ? this._attackSec : this._releaseSec
    const coeff = 1 - Math.exp(-dt / Math.max(0.0001, tau))
    this._value = safeClamp01(this._value + (t - this._value) * coeff)

    if (this._peakHoldSec > 0) {
      if (this._value >= this._peakValue) {
        this._peakValue = this._value
        this._holdTimer = this._peakHoldSec
      } else if (this._holdTimer > 0) {
        this._holdTimer = Math.max(0, this._holdTimer - dt)
      } else {
        // Decay the held peak at twice the release rate
        this._peakValue = Math.max(
          this._value,
          this._peakValue * Math.exp(-dt / Math.max(0.0001, this._releaseSec * 2)),
        )
      }
    }

    return this._value
  }

  reset(): void {
    this._value = 0
    this._peakValue = 0
    this._holdTimer = 0
  }

  get value(): number { return this._value }
  get peak():  number { return this._peakValue }
}

// ── TriggerEnvelope ───────────────────────────────────────────────────────────
//
// Single-shot decaying envelope.  Fired to 1.0 on an onset; decays
// exponentially toward 0.  Frame-rate independent for the same reason as
// AudioSmoother.  The value is floored to 0 below 1e-4 to avoid drifting
// infinitesimally above zero forever.

export class TriggerEnvelope {
  private _value = 0

  constructor(private readonly _decaySec: number) {}

  /** Set the envelope to 1.0. May be called multiple times; value is reset to 1 each time. */
  trigger(): void { this._value = 1.0 }

  /** Decay the envelope by `dt` seconds. Returns the current value. */
  update(dt: number): number {
    if (this._value > 0) {
      this._value *= Math.exp(-dt / Math.max(0.0001, this._decaySec))
      if (this._value < 1e-4) this._value = 0
    }
    return this._value
  }

  reset(): void { this._value = 0 }

  get value(): number { return this._value }
}

// ── AudioSmootherSet ──────────────────────────────────────────────────────────
//
// A fixed collection of smoothers and trigger envelopes for all audio uniforms.
// The bridge owns one instance and calls `update()` each frame with raw values
// from the MI frame (or fallback values when MI is absent).

export class AudioSmootherSet {
  // Spectral bands — fast attack so beats feel punchy; moderate release
  readonly sub     = new AudioSmoother(0.005, 0.080)
  readonly bass    = new AudioSmoother(0.005, 0.080)
  readonly lowMid  = new AudioSmoother(0.010, 0.100)
  readonly mid     = new AudioSmoother(0.010, 0.100)
  readonly highMid = new AudioSmoother(0.010, 0.100)
  readonly high    = new AudioSmoother(0.015, 0.120)
  readonly air     = new AudioSmoother(0.015, 0.120)

  // Percussion energies — very fast attack, moderate release
  readonly kick  = new AudioSmoother(0.003, 0.120)
  readonly snare = new AudioSmoother(0.003, 0.120)
  readonly hat   = new AudioSmoother(0.003, 0.100)

  // Aggregate energy — slower to avoid jumpiness
  readonly energy = new AudioSmoother(0.050, 0.200)

  // Spectral features — moderate smoothing
  readonly spectralCentroid  = new AudioSmoother(0.050, 0.150)
  readonly spectralFlux      = new AudioSmoother(0.010, 0.100)
  readonly spectralSpread    = new AudioSmoother(0.050, 0.150)
  readonly spectralFlatness  = new AudioSmoother(0.050, 0.200)

  // Structural features — slow smoothing (they change on bar/section boundaries)
  readonly tension       = new AudioSmoother(0.050, 0.150)
  readonly buildProgress = new AudioSmoother(0.100, 0.300)
  readonly dropImpact    = new AudioSmoother(0.005, 0.250)

  // Hit triggers — decay time in seconds
  readonly kickHitEnv     = new TriggerEnvelope(0.12)
  readonly snareHitEnv    = new TriggerEnvelope(0.12)
  readonly hatHitEnv      = new TriggerEnvelope(0.10)
  readonly beatHitEnv     = new TriggerEnvelope(0.15)
  readonly downbeatHitEnv = new TriggerEnvelope(0.20)

  private readonly _allSmoothers: AudioSmoother[]
  private readonly _allEnvelopes: TriggerEnvelope[]

  constructor() {
    this._allSmoothers = [
      this.sub, this.bass, this.lowMid, this.mid, this.highMid, this.high, this.air,
      this.kick, this.snare, this.hat,
      this.energy,
      this.spectralCentroid, this.spectralFlux, this.spectralSpread, this.spectralFlatness,
      this.tension, this.buildProgress, this.dropImpact,
    ]
    this._allEnvelopes = [
      this.kickHitEnv, this.snareHitEnv, this.hatHitEnv,
      this.beatHitEnv, this.downbeatHitEnv,
    ]
  }

  /** Reset all smoothers and envelopes to 0. Call on track change or stop. */
  resetAll(): void {
    for (const s of this._allSmoothers) s.reset()
    for (const e of this._allEnvelopes) e.reset()
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeClamp01(v: number): number {
  if (!isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
