import type { Cinema2ConceptStill } from './cinema2ConceptSamples'

// ── Cinema2ConceptStillRenderer ────────────────────────────────────────────
//
// Pure SVG render of a single concept still — no shader code, no Cinema2
// module/runtime. `uid` must be unique per mounted instance (many stills can
// be on screen at once, in the filmstrip and the big preview) so their
// <defs> ids never collide.

export function Cinema2ConceptStillRenderer({ still, uid }: { still: Cinema2ConceptStill; uid: string }) {
  const bgId = `${uid}-bg`
  const coreId = `${uid}-core`
  const glowId = `${uid}-glow`

  return (
    <svg viewBox="0 0 200 200" className="ll-c2-still-svg" aria-hidden="true">
      <defs>
        <radialGradient id={bgId} cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#0c1820" />
          <stop offset="100%" stopColor="#03060a" />
        </radialGradient>
        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eafcff" />
          <stop offset="45%" stopColor="#67f7ff" />
          <stop offset="100%" stopColor="#0678a0" stopOpacity="0.4" />
        </radialGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="200" height="200" fill={`url(#${bgId})`} />

      <g filter={`url(#${glowId})`}>
        {Array.from({ length: still.rayCount }, (_, index) => {
          const angle = (index / still.rayCount) * Math.PI * 2
          const x1 = 100 + Math.cos(angle) * still.coreRadius
          const y1 = 100 + Math.sin(angle) * still.coreRadius
          const x2 = 100 + Math.cos(angle) * (still.coreRadius + still.rayLength)
          const y2 = 100 + Math.sin(angle) * (still.coreRadius + still.rayLength)
          return (
            <line
              key={index}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#4ac7db"
              strokeWidth={1.3}
              strokeLinecap="round"
              opacity={still.rayOpacity}
            />
          )
        })}

        {still.sparkles.map((sparkle, index) => (
          <circle
            key={index}
            cx={sparkle.x}
            cy={sparkle.y}
            r={sparkle.size}
            fill="#8ef4ff"
            opacity={sparkle.opacity}
          />
        ))}

        <circle cx="100" cy="100" r={still.coreRadius} fill={`url(#${coreId})`} opacity={Math.min(1, 0.55 + still.coreGlow * 0.45)} />
      </g>
    </svg>
  )
}
