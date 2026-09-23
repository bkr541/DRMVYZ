import {
  ARM_MESH_TRIANGLES,
  FLASH_TRIANGLE_INDEX,
  HEAD_MESH_TRIANGLES,
  meshTrianglePoints,
  type MeshTriangle,
} from './cinema2HumanMeshGeometry'
import type { Cinema2HumanStill } from './cinema2ConceptSamples'

// ── Cinema2HumanMeshRenderer ─────────────────────────────────────────────────
//
// Pure SVG render of a HUM:AN concept still — a low-poly wireframe bust that
// forms, sparks, and transforms into an iridescent holographic mesh with
// arms reaching into frame. `uid` must be unique per mounted instance.

const STRIPE_EVERY = 5

function hueFor(index: number): number {
  return (index * 47) % 360
}

export function Cinema2HumanMeshRenderer({ still, uid }: { still: Cinema2HumanStill; uid: string }) {
  const meshCount = Math.max(1, Math.round(HEAD_MESH_TRIANGLES.length * still.meshFraction))
  const triangles: MeshTriangle[] = still.showArms
    ? [...HEAD_MESH_TRIANGLES.slice(0, meshCount), ...ARM_MESH_TRIANGLES]
    : HEAD_MESH_TRIANGLES.slice(0, meshCount)

  const bgId = `${uid}-bg`
  const stripeId = `${uid}-stripe`
  const glowId = `${uid}-glow`

  return (
    <svg viewBox="0 0 200 200" className="ll-c2-still-svg" aria-hidden="true">
      <defs>
        <radialGradient id={bgId} cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#0c1820" />
          <stop offset="100%" stopColor="#03060a" />
        </radialGradient>
        <pattern id={stripeId} width="6" height="6" patternTransform="rotate(30)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#000" />
          <rect width="3" height="6" fill="#fff" />
        </pattern>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {still.colorization > 0 && triangles.map((_, index) => {
          const hue = hueFor(index)
          return (
            <linearGradient key={index} id={`${uid}-g${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={`hsl(${hue},90%,62%)`} />
              <stop offset="100%" stopColor={`hsl(${(hue + 70) % 360},90%,55%)`} />
            </linearGradient>
          )
        })}
      </defs>

      <rect width="200" height="200" fill={`url(#${bgId})`} />

      <g filter={`url(#${glowId})`}>
        {triangles.map((triangle, index) => {
          const filled = still.colorization > 0 && index / triangles.length < still.colorization
          const isStripe = filled && index % STRIPE_EVERY === 0
          const fill = !filled ? 'none' : isStripe ? `url(#${stripeId})` : `url(#${uid}-g${index})`
          return (
            <polygon
              key={index}
              points={meshTrianglePoints(triangle)}
              fill={fill}
              fillOpacity={filled ? (isStripe ? 0.85 : 0.55) : 0}
              stroke="rgba(220,245,250,0.8)"
              strokeWidth={0.6}
            />
          )
        })}

        {still.flash && still.meshFraction >= 1 && (
          <polygon
            points={meshTrianglePoints(HEAD_MESH_TRIANGLES[FLASH_TRIANGLE_INDEX]!)}
            fill="#ffffff"
            fillOpacity={0.95}
          />
        )}
      </g>
    </svg>
  )
}
