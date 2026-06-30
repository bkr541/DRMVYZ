// Laser path point generation — all output coordinates are in canvas pixels.
// Every function is pure: no side effects, no state, no NaN/Infinity output.

export interface LaserPathInput {
  originX:     number  // canvas px
  originY:     number  // canvas px
  targetX:     number  // canvas px
  targetY:     number  // canvas px
  W:           number
  H:           number
  time:        number  // canonical audio transport time in milliseconds

  scale:       number
  rotation:    number  // degrees
  offsetX:     number  // normalized offset applied to target
  offsetY:     number
  scanSpeed:   number
  phaseOffset: number
  pointCount:  number
  spread:      number
  radius:      number
  complexity:  number
  pathProgress: number
  pathKind:    string
}

export interface LaserPoint { x: number; y: number }

function safeFinite(v: number, fb = 0): number {
  return Number.isFinite(v) ? v : fb
}

function deg2rad(d: number): number { return d * (Math.PI / 180) }

function rotatePoint(x: number, y: number, cx: number, cy: number, rad: number): LaserPoint {
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const dx = x - cx, dy = y - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

export function generateLaserPath(inp: LaserPathInput): LaserPoint[] {
  const {
    originX, originY, targetX, targetY,
    W, H, time,
    scale, rotation, offsetX, offsetY,
    scanSpeed, phaseOffset, pointCount, spread,
    radius, complexity, pathProgress, pathKind,
  } = inp

  // Apply offset to target
  const tx = safeFinite(targetX + offsetX * W)
  const ty = safeFinite(targetY + offsetY * H)
  const rotRad = deg2rad(safeFinite(rotation))
  const sc = Math.max(0.01, safeFinite(scale, 1))
  const t  = safeFinite(time)
  const speed = safeFinite(scanSpeed, 0.45)
  const phase = safeFinite(phaseOffset)
  const n = Math.max(1, Math.min(256, Math.round(safeFinite(pointCount, 18))))
  const sp = Math.max(0, Math.min(1, safeFinite(spread, 0.6)))
  const r  = Math.max(0, safeFinite(radius, 0.35)) * Math.min(W, H) * 0.5 * sc
  const cx4 = safeFinite(complexity, 0.5)

  // Angle from origin to target (base aim direction for fan-style paths)
  const aimDx = tx - originX, aimDy = ty - originY
  const aimAngle = Math.atan2(aimDy, aimDx)

  switch (pathKind) {

    // ── Static beam ─────────────────────────────────────────────────────────
    case 'staticBeam': {
      return [{ x: tx, y: ty }]
    }

    // ── Line sweep ──────────────────────────────────────────────────────────
    case 'lineSweep': {
      const sweep = Math.sin(t * speed * 0.04 + phase * Math.PI * 2) * sp * W * 0.4 * sc
      const angle = aimAngle + Math.PI / 2
      const px = tx + Math.cos(angle) * sweep
      const py = ty + Math.sin(angle) * sweep
      return [{ x: px, y: py }]
    }

    // ── Fan ─────────────────────────────────────────────────────────────────
    case 'fan': {
      const halfArc = sp * Math.PI * 0.7
      const pts: LaserPoint[] = []
      const dist = Math.hypot(tx - originX, ty - originY) * sc
      for (let i = 0; i < n; i++) {
        const frac = n > 1 ? i / (n - 1) : 0.5
        const angle = aimAngle - halfArc + frac * halfArc * 2
          + Math.sin(t * speed * 0.03 + phase * Math.PI * 2) * 0.15
        const pt: LaserPoint = {
          x: originX + Math.cos(angle) * dist,
          y: originY + Math.sin(angle) * dist,
        }
        pts.push(rotatePoint(pt.x, pt.y, tx, ty, rotRad))
      }
      return pts
    }

    // ── Cone ────────────────────────────────────────────────────────────────
    case 'cone': {
      const halfArc = sp * Math.PI * 0.4
      const pts: LaserPoint[] = []
      const dist = Math.hypot(tx - originX, ty - originY) * sc
      for (let i = 0; i < n; i++) {
        const frac = n > 1 ? i / (n - 1) : 0.5
        const angle = aimAngle - halfArc + frac * halfArc * 2
          + Math.sin(t * speed * 0.025 + phase * Math.PI * 2) * 0.08
        pts.push(rotatePoint(
          originX + Math.cos(angle) * dist,
          originY + Math.sin(angle) * dist,
          tx, ty, rotRad,
        ))
      }
      return pts
    }

    // ── Circle ──────────────────────────────────────────────────────────────
    case 'circle': {
      const pts: LaserPoint[] = []
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2
          + t * speed * 0.02 + phase * Math.PI * 2
        pts.push(rotatePoint(
          tx + Math.cos(angle) * r,
          ty + Math.sin(angle) * r,
          tx, ty, rotRad,
        ))
      }
      return pts
    }

    // ── Spiral ──────────────────────────────────────────────────────────────
    case 'spiral': {
      const pts: LaserPoint[] = []
      const turns = 1 + cx4 * 4
      for (let i = 0; i < n; i++) {
        const frac = i / Math.max(1, n - 1)
        const rFrac = frac * r
        const angle = frac * turns * Math.PI * 2
          + t * speed * 0.025 + phase * Math.PI * 2
        pts.push(rotatePoint(
          tx + Math.cos(angle) * rFrac,
          ty + Math.sin(angle) * rFrac,
          tx, ty, rotRad,
        ))
      }
      return pts
    }

    // ── Lissajous ───────────────────────────────────────────────────────────
    case 'lissajous': {
      const freqA = 2 + Math.round(cx4 * 3)
      const freqB = 3 + Math.round(cx4 * 2)
      const pts: LaserPoint[] = []
      for (let i = 0; i < n; i++) {
        const frac = i / n
        const theta = frac * Math.PI * 2 + t * speed * 0.02
        const lx = tx + Math.cos(freqA * theta + phase * Math.PI * 2) * r
        const ly = ty + Math.sin(freqB * theta) * r * (1 - sp * 0.3)
        pts.push(rotatePoint(lx, ly, tx, ty, rotRad))
      }
      return pts
    }

    // ── Grid ────────────────────────────────────────────────────────────────
    case 'grid': {
      const cols = Math.max(2, Math.round(Math.sqrt(n)))
      const rows = Math.max(2, Math.ceil(n / cols))
      const gW = r * 2 * sp
      const gH = r * 2 * sp * (1 - cx4 * 0.4)
      const pts: LaserPoint[] = []
      const scanLine = Math.floor((t * speed * 0.5) % rows)
      for (let row = 0; row < rows && pts.length < n; row++) {
        const yFrac = rows > 1 ? row / (rows - 1) : 0.5
        const yPos = ty - gH / 2 + yFrac * gH
        const dir = (row === scanLine) ? 1 : 0
        for (let col = 0; col < cols && pts.length < n; col++) {
          const xFrac = cols > 1 ? col / (cols - 1) : 0.5
          const xPos = tx - gW / 2 + xFrac * gW
            + dir * Math.sin(t * speed * 0.08) * gW * 0.1
          pts.push(rotatePoint(xPos, yPos, tx, ty, rotRad))
        }
      }
      return pts
    }

    // ── Tunnel ──────────────────────────────────────────────────────────────
    case 'tunnel': {
      const sides = Math.max(3, Math.round(4 + cx4 * 4))
      const rings = Math.max(1, Math.round(n / sides))
      const pts: LaserPoint[] = []
      const scrollPhase = ((t * speed * 0.03 + phase) % 1)
      for (let ring = 0; ring < rings; ring++) {
        const ringFrac = ((ring / rings + scrollPhase) % 1)
        const rr = ringFrac * r * 1.2
        for (let s = 0; s < sides; s++) {
          const angle = (s / sides) * Math.PI * 2 + rotRad
          pts.push({
            x: tx + Math.cos(angle) * rr,
            y: ty + Math.sin(angle) * rr * (1 - sp * 0.2),
          })
        }
      }
      return pts
    }

    // ── Constellation ───────────────────────────────────────────────────────
    case 'constellation': {
      const pts: LaserPoint[] = []
      for (let i = 0; i < n; i++) {
        // Stable pseudo-random placement using seeded offsets
        const seed1 = Math.sin(i * 127.1 + 311.7) * 43758.5
        const seed2 = Math.sin(i * 269.5 + 183.3) * 43758.5
        const px = (seed1 - Math.floor(seed1)) - 0.5
        const py = (seed2 - Math.floor(seed2)) - 0.5
        const driftX = Math.sin(t * speed * 0.008 + i * 0.7) * sp * 0.08 * W
        const driftY = Math.cos(t * speed * 0.007 + i * 0.5) * sp * 0.06 * H
        pts.push({
          x: tx + px * r * 2 + driftX,
          y: ty + py * r * 2 + driftY,
        })
      }
      return pts
    }

    // ── Path progress sub-sampling (any connected path sliced to progress) ─
    // svgPath / textPath: graceful fallback to lissajous
    case 'svgPath':
    case 'textPath': {
      // Future: parse and use stored path data. For now fall back to lissajous.
      return generateLaserPath({ ...inp, pathKind: 'lissajous' })
    }

    default:
      return [{ x: tx, y: ty }]
  }
}

// Slice a point array to 0…pathProgress (for driven scanning effects).
export function sliceByProgress(pts: LaserPoint[], progress: number): LaserPoint[] {
  if (progress >= 1 || pts.length <= 1) return pts
  if (progress <= 0) return pts.slice(0, 1)
  return pts.slice(0, Math.max(1, Math.ceil(pts.length * progress)))
}
