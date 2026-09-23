import { Cinema2ConceptStillRenderer } from './Cinema2ConceptStillRenderer'
import { Cinema2HumanMeshRenderer } from './Cinema2HumanMeshRenderer'
import type { Cinema2ConceptStill } from './cinema2ConceptSamples'

// ── Cinema2StillPreview ──────────────────────────────────────────────────────
//
// Dispatches a concept still to its renderer by `kind`, so callers (the
// filmstrip, the center canvas, the preset-list thumbnails) don't need to
// know which concept's shape they're holding.

export function Cinema2StillPreview({ still, uid }: { still: Cinema2ConceptStill; uid: string }) {
  if (still.kind === 'humanMesh') return <Cinema2HumanMeshRenderer still={still} uid={uid} />
  return <Cinema2ConceptStillRenderer still={still} uid={uid} />
}
