// ── SVG Capability Analysis ───────────────────────────────────────────────────
// Determines what a raw SVG document can do: vector geometry, embedded raster,
// complex features, etc.  Used at upload time and by Auto render-mode resolution.
// Works in Node (Vitest) via regex fallback when DOMParser is unavailable.

export interface SvgCapabilityAnalysis {
  isValidSvg: boolean
  hasVectorGeometry: boolean
  hasEmbeddedRaster: boolean
  hasExternalRaster: boolean
  hasTextElements: boolean
  hasComplexFeatures: boolean
  supportedVectorElementCount: number
  unsupportedElementTypes: string[]
  reactivePathCompatible: boolean
  originalArtworkCompatible: boolean
  recommendedRenderMode: 'reactivePath' | 'originalArtwork'
  reason?: string
}

// Tags that produce compilable vector geometry (matches svgGlyphUtils pipeline)
const VECTOR_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])

// Tags that indicate complex SVG features that may be lost by path extraction
const COMPLEX_TAGS = new Set([
  'mask', 'clippath', 'filter', 'lineargradient', 'radialgradient',
  'pattern', 'symbol', 'use', 'foreignobject',
])

// ── Regex-based analysis (Node/Vitest) ────────────────────────────────────────

function analyzeRegex(rawSvg: string): SvgCapabilityAnalysis {
  const lower = rawSvg.toLowerCase()

  const isValidSvg = lower.includes('<svg')

  if (!isValidSvg) {
    return {
      isValidSvg: false,
      hasVectorGeometry: false,
      hasEmbeddedRaster: false,
      hasExternalRaster: false,
      hasTextElements: false,
      hasComplexFeatures: false,
      supportedVectorElementCount: 0,
      unsupportedElementTypes: [],
      reactivePathCompatible: false,
      originalArtworkCompatible: false,
      recommendedRenderMode: 'originalArtwork',
      reason: 'Not a valid SVG document',
    }
  }

  // Vector geometry detection
  let vectorCount = 0
  for (const tag of VECTOR_TAGS) {
    const re = new RegExp(`<${tag}[\\s/>]`, 'gi')
    const matches = rawSvg.match(re)
    if (matches) {
      // Quick heuristic: check for non-empty geometry
      if (tag === 'path') {
        const dRe = /\bd=["'][^"']+["']/gi
        const dMatches = rawSvg.match(dRe)
        if (dMatches) vectorCount += dMatches.length
      } else if (tag === 'circle') {
        const rRe = /\br=["']([^"']+)["']/gi
        let m: RegExpExecArray | null
        while ((m = rRe.exec(rawSvg)) !== null) {
          if (parseFloat(m[1]) > 0) vectorCount++
        }
      } else if (tag === 'rect') {
        const wRe = /\bwidth=["']([^"']+)["']/gi
        let m: RegExpExecArray | null
        while ((m = wRe.exec(rawSvg)) !== null) {
          if (parseFloat(m[1]) > 0) vectorCount++
        }
      } else {
        vectorCount += matches.length
      }
    }
  }

  // Raster detection
  const hasEmbeddedRaster = /\bdata:image\/(png|jpeg|jpg|gif|webp|bmp)/i.test(rawSvg) &&
    /<image[\s>]/i.test(rawSvg)
  const hasExternalRaster = /<image[^>]+(?:href|xlink:href)=["'][^"']*(?:\.png|\.jpg|\.jpeg|\.gif|\.webp|\.bmp)/i.test(rawSvg)

  // Text elements
  const hasTextElements = /<text[\s>]/i.test(rawSvg)

  // Complex features
  let hasComplexFeatures = false
  const unsupportedFound: string[] = []
  for (const tag of COMPLEX_TAGS) {
    if (new RegExp(`<${tag}[\\s>/]`, 'i').test(rawSvg)) {
      hasComplexFeatures = true
      unsupportedFound.push(tag)
    }
  }
  // Embedded CSS
  if (/<style[\s>]/i.test(rawSvg)) {
    hasComplexFeatures = true
    if (!unsupportedFound.includes('style')) unsupportedFound.push('style')
  }

  const hasVectorGeometry = vectorCount > 0
  const isRasterOnly = hasEmbeddedRaster && !hasVectorGeometry
  const reactivePathCompatible = hasVectorGeometry && !isRasterOnly
  const originalArtworkCompatible = isValidSvg

  let recommendedRenderMode: 'reactivePath' | 'originalArtwork'
  let reason: string | undefined
  if (!hasVectorGeometry) {
    recommendedRenderMode = 'originalArtwork'
    reason = 'No supported vector geometry found — using Original Artwork for full fidelity.'
  } else if (isRasterOnly) {
    recommendedRenderMode = 'originalArtwork'
    reason = 'File contains an embedded raster image rather than vector paths.'
  } else if (hasComplexFeatures || hasTextElements || (hasEmbeddedRaster && hasVectorGeometry)) {
    recommendedRenderMode = 'originalArtwork'
    reason = 'SVG uses complex features (masks, gradients, filters, or embedded images) — Original Artwork preserves the complete design.'
  } else {
    recommendedRenderMode = 'reactivePath'
    reason = 'Simple vector geometry detected — Reactive Path can deform this SVG with audio.'
  }

  return {
    isValidSvg,
    hasVectorGeometry,
    hasEmbeddedRaster,
    hasExternalRaster,
    hasTextElements,
    hasComplexFeatures,
    supportedVectorElementCount: vectorCount,
    unsupportedElementTypes: unsupportedFound,
    reactivePathCompatible,
    originalArtworkCompatible,
    recommendedRenderMode,
    reason,
  }
}

// ── DOM-based analysis (browser) ──────────────────────────────────────────────

function analyzeDom(rawSvg: string): SvgCapabilityAnalysis {
  let doc: Document
  try {
    const parser = new DOMParser()
    doc = parser.parseFromString(rawSvg, 'image/svg+xml')
  } catch {
    return analyzeRegex(rawSvg)
  }

  if (doc.querySelector('parseerror, parsererror')) {
    return {
      isValidSvg: false,
      hasVectorGeometry: false,
      hasEmbeddedRaster: false,
      hasExternalRaster: false,
      hasTextElements: false,
      hasComplexFeatures: false,
      supportedVectorElementCount: 0,
      unsupportedElementTypes: [],
      reactivePathCompatible: false,
      originalArtworkCompatible: false,
      recommendedRenderMode: 'originalArtwork',
      reason: 'Not a valid SVG document (XML parse error)',
    }
  }

  const svgRoot = doc.querySelector('svg')
  if (!svgRoot) {
    return {
      isValidSvg: false,
      hasVectorGeometry: false,
      hasEmbeddedRaster: false,
      hasExternalRaster: false,
      hasTextElements: false,
      hasComplexFeatures: false,
      supportedVectorElementCount: 0,
      unsupportedElementTypes: [],
      reactivePathCompatible: false,
      originalArtworkCompatible: false,
      recommendedRenderMode: 'originalArtwork',
      reason: 'Not a valid SVG document (no <svg> root)',
    }
  }

  // Count usable vector elements
  let vectorCount = 0
  for (const tag of VECTOR_TAGS) {
    const els = Array.from(doc.querySelectorAll(tag))
    for (const el of els) {
      if (tag === 'path') {
        const d = el.getAttribute('d')?.trim()
        if (d && d.length > 1) vectorCount++
      } else if (tag === 'circle') {
        const r = parseFloat(el.getAttribute('r') ?? '0')
        if (r > 0) vectorCount++
      } else if (tag === 'ellipse') {
        const rx = parseFloat(el.getAttribute('rx') ?? '0')
        const ry = parseFloat(el.getAttribute('ry') ?? '0')
        if (rx > 0 && ry > 0) vectorCount++
      } else if (tag === 'rect') {
        const w = parseFloat(el.getAttribute('width') ?? '0')
        const h = parseFloat(el.getAttribute('height') ?? '0')
        if (w > 0 && h > 0) vectorCount++
      } else if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') ?? '0')
        const y1 = parseFloat(el.getAttribute('y1') ?? '0')
        const x2 = parseFloat(el.getAttribute('x2') ?? '0')
        const y2 = parseFloat(el.getAttribute('y2') ?? '0')
        if (x1 !== x2 || y1 !== y2) vectorCount++
      } else if (tag === 'polyline' || tag === 'polygon') {
        const pts = el.getAttribute('points')?.trim()
        if (pts && pts.length > 0) vectorCount++
      }
    }
  }

  // Raster detection
  const imageEls = Array.from(doc.querySelectorAll('image'))
  let hasEmbeddedRaster = false
  let hasExternalRaster = false
  for (const img of imageEls) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href') ?? ''
    if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp)/i.test(href)) {
      hasEmbeddedRaster = true
    } else if (/\.(png|jpg|jpeg|gif|webp|bmp)/i.test(href)) {
      hasExternalRaster = true
    } else if (href) {
      // Unknown image reference
      hasExternalRaster = true
    }
  }

  const hasTextElements = doc.querySelectorAll('text, tspan, textPath').length > 0

  const unsupportedFound: string[] = []
  let hasComplexFeatures = false
  for (const tag of COMPLEX_TAGS) {
    if (doc.querySelectorAll(tag).length > 0) {
      hasComplexFeatures = true
      unsupportedFound.push(tag)
    }
  }
  if (doc.querySelectorAll('style').length > 0) {
    hasComplexFeatures = true
    if (!unsupportedFound.includes('style')) unsupportedFound.push('style')
  }

  const hasVectorGeometry = vectorCount > 0
  const isRasterOnly = (hasEmbeddedRaster || hasExternalRaster) && !hasVectorGeometry
  const reactivePathCompatible = hasVectorGeometry && !isRasterOnly
  const originalArtworkCompatible = true

  let recommendedRenderMode: 'reactivePath' | 'originalArtwork'
  let reason: string | undefined

  if (!hasVectorGeometry) {
    recommendedRenderMode = 'originalArtwork'
    reason = 'No supported vector geometry found — using Original Artwork for full fidelity.'
  } else if (isRasterOnly) {
    recommendedRenderMode = 'originalArtwork'
    reason = 'File contains an embedded raster image rather than vector paths.'
  } else if (hasComplexFeatures || hasTextElements || (hasEmbeddedRaster && hasVectorGeometry)) {
    recommendedRenderMode = 'originalArtwork'
    reason = 'SVG uses complex features (masks, gradients, filters, or embedded images) — Original Artwork preserves the complete design.'
  } else {
    recommendedRenderMode = 'reactivePath'
    reason = 'Simple vector geometry detected — Reactive Path can deform this SVG with audio.'
  }

  return {
    isValidSvg: true,
    hasVectorGeometry,
    hasEmbeddedRaster,
    hasExternalRaster,
    hasTextElements,
    hasComplexFeatures,
    supportedVectorElementCount: vectorCount,
    unsupportedElementTypes: unsupportedFound,
    reactivePathCompatible,
    originalArtworkCompatible,
    recommendedRenderMode,
    reason,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyzes an SVG string and returns a capability report.
 * Uses DOMParser in browser environments and a regex fallback in Node/Vitest.
 * Does not execute any scripts contained in the SVG.
 */
export function analyzeSvgCapabilities(rawSvg: string): SvgCapabilityAnalysis {
  if (typeof rawSvg !== 'string' || !rawSvg.trim()) {
    return {
      isValidSvg: false,
      hasVectorGeometry: false,
      hasEmbeddedRaster: false,
      hasExternalRaster: false,
      hasTextElements: false,
      hasComplexFeatures: false,
      supportedVectorElementCount: 0,
      unsupportedElementTypes: [],
      reactivePathCompatible: false,
      originalArtworkCompatible: false,
      recommendedRenderMode: 'originalArtwork',
      reason: 'Empty or non-string input',
    }
  }

  if (typeof DOMParser !== 'undefined') {
    return analyzeDom(rawSvg)
  }
  return analyzeRegex(rawSvg)
}

/**
 * Resolves which render mode to actually use given the user's preference
 * and the SVG's capability analysis.
 */
export function resolveSvgRenderMode(
  requestedMode: 'auto' | 'reactivePath' | 'originalArtwork',
  capabilities: SvgCapabilityAnalysis,
): 'reactivePath' | 'originalArtwork' {
  if (requestedMode === 'originalArtwork') return 'originalArtwork'
  if (requestedMode === 'reactivePath') {
    return capabilities.reactivePathCompatible ? 'reactivePath' : 'originalArtwork'
  }
  // Auto
  return capabilities.recommendedRenderMode
}
