import {
  MAX_PIX_GRID_ACTIVE_GROUPS,
  MAX_PIX_GRID_CELL_RUNS_PER_GROUP,
  MAX_PIX_GRID_CONNECTED_REGION_CELLS,
  MAX_PIX_GRID_GROUPS,
  MAX_PIX_GRID_SVG_SOURCE_CHARACTERS,
} from './PixGridLimits'
import type {
  PixGridCellRect,
  PixGridCellRun,
  PixGridGeometricGroupPattern,
  PixGridGroup,
  PixGridGroupMaskDefinition,
  PixGridGroupSource,
  PixGridReactionAssignment,
} from './PixGridTypes'

export interface PixGridCompiledMask {
  key: string
  width: number
  height: number
  bits: Uint32Array
  cellCount: number
  bounds: PixGridCellRect | null
  runs: PixGridCellRun[]
}

export interface PixGridMaskPixelSource {
  width: number
  height: number
  pixels: Uint8Array | Uint8ClampedArray
  key?: string
  mediaRevision?: number
}

export interface PixGridSvgGroupCandidate {
  id: string
  name: string
  kind: 'group' | 'path' | 'fill'
  elementId?: string
  fillColor?: string
}

export type PixGridSmartGroupMethod = 'dominantColor' | 'luminanceBands' | 'alpha' | 'layerAlpha' | 'connectedRegions' | 'geometric' | 'selection' | 'svg'

const MASK_CACHE_LIMIT = 128
const maskCache = new Map<string, PixGridCompiledMask>()

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max))
}

function safeColor(value: string | null | undefined, fallback = '#4ac7db'): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function stableUnit(seed: string): number {
  return stableHash(seed) / 0xffffffff
}

export function createPixGridGroupId(prefix = 'pix-grid-group'): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`
  return `${prefix}-${random}`
}

export function createDefaultPixGridReactionAssignment(index = 0): PixGridReactionAssignment {
  return {
    id: createPixGridGroupId('pix-grid-reaction'),
    name: `Reaction ${index + 1}`,
    enabled: true,
    source: 'bass',
    target: 'brightness',
    targetScope: 'group',
    targetId: null,
    amount: 0.75,
    polarity: 'positive',
    invert: false,
    inputRange: [0, 1],
    outputRange: [0, 1],
    curve: 'linear',
    threshold: 0,
    attack: 0.03,
    hold: 0.04,
    release: 0.18,
    cooldown: 0,
    smoothing: 0.08,
    quantization: 'none',
    retrigger: 'restart',
    minimumConfidence: 0,
    capabilityFallback: 'energy',
    bassReactivityEnabled: true,
    conditions: {},
    priority: 0,
    clamp: [0, 1],
    blend: 'add',
    paletteRole: 'accent',
    color: '#ffffff',
    seedOffset: 0,
  }
}

export function createPixGridGroup(input: {
  name: string
  source: PixGridGroupSource
  mask: PixGridGroupMaskDefinition
  runs?: PixGridCellRun[]
  layerId?: string | null
  priority?: number
  displayColor?: string | null
}): PixGridGroup {
  const runs = (input.runs ?? (input.mask.kind === 'runs' ? input.mask.runs : [])).slice(0, MAX_PIX_GRID_CELL_RUNS_PER_GROUP)
  return {
    id: createPixGridGroupId(),
    name: input.name.trim().slice(0, 96) || 'Pixel Group',
    source: input.source,
    mask: input.mask.kind === 'runs' ? { kind: 'runs', runs } : input.mask,
    cellRuns: runs,
    layerId: input.layerId ?? null,
    layerScope: input.layerId ? [input.layerId] : null,
    smartRuleId: input.source === 'manualSelection' ? null : input.source,
    enabled: true,
    visible: true,
    contentVisible: true,
    priority: clampInt(input.priority ?? 0, -100, 100),
    overlapBehavior: 'stack',
    reactions: [],
    displayColor: input.displayColor == null ? '#4ac7db' : safeColor(input.displayColor),
  }
}

export function pixGridRunsFromBitset(bits: Uint32Array, width: number, height: number): PixGridCellRun[] {
  const runs: PixGridCellRun[] = []
  for (let y = 0; y < height && runs.length < MAX_PIX_GRID_CELL_RUNS_PER_GROUP; y += 1) {
    let start = -1
    for (let x = 0; x <= width; x += 1) {
      const active = x < width && pixGridMaskHasCell(bits, y * width + x)
      if (active && start < 0) start = x
      if (!active && start >= 0) {
        runs.push([y, start, x - start])
        start = -1
      }
    }
  }
  return runs
}

export function pixGridBitsetFromRuns(runs: readonly PixGridCellRun[], width: number, height: number): Uint32Array {
  const bits = new Uint32Array(Math.ceil(width * height / 32))
  for (const [rawRow, rawStart, rawLength] of runs.slice(0, MAX_PIX_GRID_CELL_RUNS_PER_GROUP)) {
    const row = clampInt(rawRow, 0, Math.max(0, height - 1))
    const start = clampInt(rawStart, 0, Math.max(0, width - 1))
    const end = clampInt(start + Math.max(0, rawLength), start, width)
    for (let x = start; x < end; x += 1) pixGridSetMaskCell(bits, row * width + x)
  }
  return bits
}

export function pixGridMaskHasCell(bits: Uint32Array, index: number): boolean {
  return (bits[index >>> 5] & (1 << (index & 31))) !== 0
}

export function pixGridSetMaskCell(bits: Uint32Array, index: number): void {
  bits[index >>> 5] |= 1 << (index & 31)
}

function boundsForBits(bits: Uint32Array, width: number, height: number): PixGridCellRect | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!pixGridMaskHasCell(bits, y * width + x)) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function countBits(bits: Uint32Array): number {
  let count = 0
  for (const word of bits) {
    let value = word >>> 0
    while (value) {
      value &= value - 1
      count += 1
    }
  }
  return count
}

function pixelSourceKey(source: PixGridMaskPixelSource): string {
  if (source.key) return source.key
  let hash = 2166136261
  for (let index = 0; index < source.pixels.length; index += 1) {
    hash ^= source.pixels[index]
    hash = Math.imul(hash, 16777619)
  }
  return `${source.width}x${source.height}:${source.mediaRevision ?? 0}:${source.pixels.byteLength}:${(hash >>> 0).toString(36)}`
}

function maskKey(group: PixGridGroup, width: number, height: number, sourceKey = ''): string {
  return [
    'pix-grid-mask-v2', group.id, width, height, group.source, JSON.stringify(group.mask),
    JSON.stringify(group.cellRuns), sourceKey,
  ].join('|')
}

function cacheMask(mask: PixGridCompiledMask): PixGridCompiledMask {
  maskCache.delete(mask.key)
  maskCache.set(mask.key, mask)
  while (maskCache.size > MASK_CACHE_LIMIT) {
    const oldest = maskCache.keys().next().value as string | undefined
    if (!oldest) break
    maskCache.delete(oldest)
  }
  return mask
}

function geometricCell(pattern: PixGridGeometricGroupPattern, x: number, y: number, width: number, height: number, mask: Extract<PixGridGroupMaskDefinition, { kind: 'geometric' }>, groupId: string): boolean {
  const nx = (x + 0.5) / Math.max(1, width)
  const ny = (y + 0.5) / Math.max(1, height)
  const count = clampInt(mask.count ?? 4, 1, 32)
  const index = ((clampInt(mask.index ?? 0, -128, 128) % count) + count) % count
  const thickness = clamp(mask.thickness ?? 0.12, 0.01, 0.49)
  switch (pattern) {
    case 'border': return nx < thickness || nx > 1 - thickness || ny < thickness || ny > 1 - thickness
    case 'center': return Math.abs(nx - 0.5) <= thickness && Math.abs(ny - 0.5) <= thickness
    case 'left': return nx < 0.5
    case 'right': return nx >= 0.5
    case 'top': return ny < 0.5
    case 'bottom': return ny >= 0.5
    case 'quadrantTopLeft': return nx < 0.5 && ny < 0.5
    case 'quadrantTopRight': return nx >= 0.5 && ny < 0.5
    case 'quadrantBottomLeft': return nx < 0.5 && ny >= 0.5
    case 'quadrantBottomRight': return nx >= 0.5 && ny >= 0.5
    case 'horizontalBands': return Math.floor(ny * count) === index
    case 'verticalBands': return Math.floor(nx * count) === index
    case 'alternatingRowsA': return y % 2 === 0
    case 'alternatingRowsB': return y % 2 === 1
    case 'alternatingColumnsA': return x % 2 === 0
    case 'alternatingColumnsB': return x % 2 === 1
    case 'checkerboardA': return (x + y) % 2 === 0
    case 'checkerboardB': return (x + y) % 2 === 1
    case 'diagonalBands': return ((Math.floor((nx + ny) * count) % count) + count) % count === index
    case 'radialRings': {
      const radius = Math.hypot(nx - 0.5, ny - 0.5) / Math.SQRT1_2
      return Math.min(count - 1, Math.floor(radius * count)) === index
    }
    case 'deterministicClusters': {
      const seed = `${mask.seed ?? 1}:${groupId}:${Math.floor(x / Math.max(1, width / count))}:${Math.floor(y / Math.max(1, height / count))}`
      return Math.floor(stableUnit(seed) * count) === index
    }
    default: return false
  }
}

function pixelLuminance(source: PixGridMaskPixelSource, x: number, y: number): number {
  const offset = (y * source.width + x) * 4
  return (source.pixels[offset] * 0.2126 + source.pixels[offset + 1] * 0.7152 + source.pixels[offset + 2] * 0.0722) / 255
}

function hexRgb(color: string): readonly [number, number, number] {
  const safe = safeColor(color, '#ffffff')
  return [Number.parseInt(safe.slice(1, 3), 16), Number.parseInt(safe.slice(3, 5), 16), Number.parseInt(safe.slice(5, 7), 16)]
}

function colorDistance(source: PixGridMaskPixelSource, x: number, y: number, target: readonly [number, number, number]): number {
  const offset = (y * source.width + x) * 4
  const dr = source.pixels[offset] - target[0]
  const dg = source.pixels[offset + 1] - target[1]
  const db = source.pixels[offset + 2] - target[2]
  return Math.sqrt((dr * dr + dg * dg + db * db) / (3 * 255 * 255))
}

function compileSourceMask(group: PixGridGroup, width: number, height: number, source: PixGridMaskPixelSource): Uint32Array {
  const bits = new Uint32Array(Math.ceil(width * height / 32))
  const mask = group.mask
  const target = mask.kind === 'colorRange' ? hexRgb(mask.color) : null
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(source.height - 1, Math.floor(y / height * source.height))
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor(x / width * source.width))
      const sourceOffset = (sy * source.width + sx) * 4
      const alpha = source.pixels[sourceOffset + 3] / 255
      let active = false
      if (mask.kind === 'layerAlpha') active = mask.foreground ? alpha >= mask.threshold : alpha < mask.threshold
      else if (mask.kind === 'colorRange' && target) active = alpha > 0 && colorDistance(source, sx, sy, target) <= mask.tolerance
      else if (mask.kind === 'luminanceRange') {
        const luminance = pixelLuminance(source, sx, sy)
        active = alpha > 0 && luminance >= mask.min && luminance <= mask.max
      } else if (mask.kind === 'svgMetadata' && mask.fillColor) {
        active = alpha > 0 && colorDistance(source, sx, sy, hexRgb(mask.fillColor)) <= 0.08
      }
      if (active) pixGridSetMaskCell(bits, y * width + x)
    }
  }
  return bits
}

function compileConnectedRegion(mask: Extract<PixGridGroupMaskDefinition, { kind: 'connectedRegion' }>, width: number, height: number, source: PixGridMaskPixelSource): Uint32Array {
  const bits = new Uint32Array(Math.ceil(width * height / 32))
  const visited = new Uint8Array(width * height)
  const seedX = clampInt(mask.seedX, 0, width - 1)
  const seedY = clampInt(mask.seedY, 0, height - 1)
  const sx = Math.min(source.width - 1, Math.floor(seedX / width * source.width))
  const sy = Math.min(source.height - 1, Math.floor(seedY / height * source.height))
  const seedOffset = (sy * source.width + sx) * 4
  if (source.pixels[seedOffset + 3] / 255 < mask.alphaThreshold) return bits
  const target: readonly [number, number, number] = [source.pixels[seedOffset], source.pixels[seedOffset + 1], source.pixels[seedOffset + 2]]
  const queue = new Int32Array(Math.min(width * height, Math.max(1, Math.min(mask.maxCells, MAX_PIX_GRID_CONNECTED_REGION_CELLS))))
  let head = 0
  let tail = 0
  queue[tail++] = seedY * width + seedX
  visited[seedY * width + seedX] = 1
  while (head < tail && head < queue.length) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)
    const px = Math.min(source.width - 1, Math.floor(x / width * source.width))
    const py = Math.min(source.height - 1, Math.floor(y / height * source.height))
    const offset = (py * source.width + px) * 4
    if (source.pixels[offset + 3] / 255 < mask.alphaThreshold || colorDistance(source, px, py, target) > mask.tolerance) continue
    pixGridSetMaskCell(bits, index)
    const neighbors = [index - 1, index + 1, index - width, index + width]
    for (const neighbor of neighbors) {
      if (neighbor < 0 || neighbor >= width * height || visited[neighbor]) continue
      const nx = neighbor % width
      const ny = Math.floor(neighbor / width)
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
      visited[neighbor] = 1
      if (tail < queue.length) queue[tail++] = neighbor
    }
  }
  return bits
}

export function compilePixGridGroupMask(
  group: PixGridGroup,
  width: number,
  height: number,
  source?: PixGridMaskPixelSource | null,
): PixGridCompiledMask {
  const safeWidth = Math.max(1, Math.floor(width))
  const safeHeight = Math.max(1, Math.floor(height))
  const sourceKey = source ? pixelSourceKey(source) : ''
  const key = maskKey(group, safeWidth, safeHeight, sourceKey)
  const cached = maskCache.get(key)
  if (cached) {
    maskCache.delete(key)
    maskCache.set(key, cached)
    return cached
  }
  let bits: Uint32Array
  if (group.mask.kind === 'geometric') {
    bits = new Uint32Array(Math.ceil(safeWidth * safeHeight / 32))
    for (let y = 0; y < safeHeight; y += 1) {
      for (let x = 0; x < safeWidth; x += 1) {
        if (geometricCell(group.mask.pattern, x, y, safeWidth, safeHeight, group.mask, group.id)) {
          pixGridSetMaskCell(bits, y * safeWidth + x)
        }
      }
    }
  } else if (group.cellRuns.length > 0 || group.mask.kind === 'runs') {
    const maskRuns = group.mask.kind === 'runs' ? group.mask.runs : []
    const sourceRuns = group.cellRuns.length > 0 ? group.cellRuns : maskRuns
    bits = pixGridBitsetFromRuns(sourceRuns, safeWidth, safeHeight)
  } else if (source && group.mask.kind === 'connectedRegion') {
    bits = compileConnectedRegion(group.mask, safeWidth, safeHeight, source)
  } else if (source && ['layerAlpha', 'colorRange', 'luminanceRange', 'svgMetadata'].includes(group.mask.kind)) {
    bits = compileSourceMask(group, safeWidth, safeHeight, source)
  } else {
    bits = new Uint32Array(Math.ceil(safeWidth * safeHeight / 32))
  }
  const runs = pixGridRunsFromBitset(bits, safeWidth, safeHeight)
  return cacheMask({ key, width: safeWidth, height: safeHeight, bits, cellCount: countBits(bits), bounds: boundsForBits(bits, safeWidth, safeHeight), runs })
}

export function materializePixGridGroup(group: PixGridGroup, width: number, height: number, source?: PixGridMaskPixelSource | null): PixGridGroup {
  const compiled = compilePixGridGroupMask(group, width, height, source)
  return { ...group, cellRuns: compiled.runs, mask: { kind: 'runs', runs: compiled.runs } }
}

export function createPixGridSelectionGroup(selection: PixGridCellRect, width: number, height: number, layerId: string | null): PixGridGroup {
  const bits = new Uint32Array(Math.ceil(width * height / 32))
  const minX = clampInt(selection.x, 0, width - 1)
  const minY = clampInt(selection.y, 0, height - 1)
  const maxX = clampInt(selection.x + selection.width, minX + 1, width)
  const maxY = clampInt(selection.y + selection.height, minY + 1, height)
  for (let y = minY; y < maxY; y += 1) for (let x = minX; x < maxX; x += 1) pixGridSetMaskCell(bits, y * width + x)
  const runs = pixGridRunsFromBitset(bits, width, height)
  return createPixGridGroup({ name: 'Marquee Selection', source: 'manualSelection', mask: { kind: 'runs', runs }, runs, layerId })
}

export function createPixGridGeometricGroups(pattern: PixGridGeometricGroupPattern, width: number, height: number, layerId: string | null, count = 4): PixGridGroup[] {
  const sourceMap: Partial<Record<PixGridGeometricGroupPattern, PixGridGroupSource>> = {
    border: 'border', center: 'center', left: 'leftRight', right: 'leftRight', top: 'topBottom', bottom: 'topBottom',
    quadrantTopLeft: 'quadrant', quadrantTopRight: 'quadrant', quadrantBottomLeft: 'quadrant', quadrantBottomRight: 'quadrant',
    horizontalBands: 'horizontalBands', verticalBands: 'verticalBands', alternatingRowsA: 'alternatingRows', alternatingRowsB: 'alternatingRows',
    alternatingColumnsA: 'alternatingColumns', alternatingColumnsB: 'alternatingColumns', checkerboardA: 'checkerboard', checkerboardB: 'checkerboard',
    diagonalBands: 'diagonalBands', radialRings: 'radialRings', deterministicClusters: 'deterministicClusters',
  }
  const pairedPatterns: Partial<Record<PixGridGeometricGroupPattern, PixGridGeometricGroupPattern[]>> = {
    left: ['left', 'right'], right: ['left', 'right'],
    top: ['top', 'bottom'], bottom: ['top', 'bottom'],
    quadrantTopLeft: ['quadrantTopLeft', 'quadrantTopRight', 'quadrantBottomLeft', 'quadrantBottomRight'],
    quadrantTopRight: ['quadrantTopLeft', 'quadrantTopRight', 'quadrantBottomLeft', 'quadrantBottomRight'],
    quadrantBottomLeft: ['quadrantTopLeft', 'quadrantTopRight', 'quadrantBottomLeft', 'quadrantBottomRight'],
    quadrantBottomRight: ['quadrantTopLeft', 'quadrantTopRight', 'quadrantBottomLeft', 'quadrantBottomRight'],
    alternatingRowsA: ['alternatingRowsA', 'alternatingRowsB'], alternatingRowsB: ['alternatingRowsA', 'alternatingRowsB'],
    alternatingColumnsA: ['alternatingColumnsA', 'alternatingColumnsB'], alternatingColumnsB: ['alternatingColumnsA', 'alternatingColumnsB'],
    checkerboardA: ['checkerboardA', 'checkerboardB'], checkerboardB: ['checkerboardA', 'checkerboardB'],
  }
  const paired = pairedPatterns[pattern]
  if (paired) {
    return paired.map((candidate, index) => createPixGridGroup({
      name: candidate.replace(/([A-Z])/g, ' $1').trim(),
      source: sourceMap[candidate] ?? 'manualSelection',
      mask: { kind: 'geometric', pattern: candidate, count: paired.length, index, seed: 1 },
      layerId,
      priority: index,
    }))
  }
  const plural = ['horizontalBands', 'verticalBands', 'diagonalBands', 'radialRings', 'deterministicClusters'].includes(pattern)
  const total = plural ? clampInt(count, 2, 12) : 1
  return Array.from({ length: total }, (_, index) => createPixGridGroup({
    name: total > 1 ? `${pattern.replace(/([A-Z])/g, ' $1')} ${index + 1}` : pattern.replace(/([A-Z])/g, ' $1'),
    source: sourceMap[pattern] ?? 'manualSelection',
    mask: { kind: 'geometric', pattern, count: total, index, seed: 1 },
    layerId,
    priority: index,
  })).slice(0, MAX_PIX_GRID_GROUPS)
}
function sourceCellBits(source: PixGridMaskPixelSource, predicate: (x: number, y: number, offset: number) => boolean): Uint32Array {
  const bits = new Uint32Array(Math.ceil(source.width * source.height / 32))
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4
      if (predicate(x, y, offset)) pixGridSetMaskCell(bits, y * source.width + x)
    }
  }
  return bits
}

function groupFromSourceBits(name: string, sourceKind: PixGridGroupSource, bits: Uint32Array, source: PixGridMaskPixelSource, layerId: string | null, color?: string): PixGridGroup | null {
  const runs = pixGridRunsFromBitset(bits, source.width, source.height)
  if (runs.length === 0) return null
  return createPixGridGroup({ name, source: sourceKind, mask: { kind: 'runs', runs }, runs, layerId, displayColor: color ?? '#4ac7db' })
}

export function createPixGridDominantColorGroups(source: PixGridMaskPixelSource, layerId: string | null, maxGroups = 6): PixGridGroup[] {
  const histogram = new Map<number, number>()
  for (let offset = 0; offset < source.pixels.length; offset += 4) {
    if (source.pixels[offset + 3] < 16) continue
    const r = source.pixels[offset] >> 5
    const g = source.pixels[offset + 1] >> 5
    const b = source.pixels[offset + 2] >> 5
    const key = (r << 6) | (g << 3) | b
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }
  const bins = [...histogram.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, clampInt(maxGroups, 1, 12))
  return bins.flatMap(([key], index) => {
    const r = ((key >> 6) & 7) * 32 + 16
    const g = ((key >> 3) & 7) * 32 + 16
    const b = (key & 7) * 32 + 16
    const color = `#${[r, g, b].map(value => clampInt(value, 0, 255).toString(16).padStart(2, '0')).join('')}`
    const bits = sourceCellBits(source, (_x, _y, offset) => {
      if (source.pixels[offset + 3] < 16) return false
      return (source.pixels[offset] >> 5) === ((key >> 6) & 7)
        && (source.pixels[offset + 1] >> 5) === ((key >> 3) & 7)
        && (source.pixels[offset + 2] >> 5) === (key & 7)
    })
    const group = groupFromSourceBits(`Color ${index + 1}`, 'colorRange', bits, source, layerId, color)
    return group ? [group] : []
  })
}

export function createPixGridLuminanceGroups(source: PixGridMaskPixelSource, layerId: string | null, bands = 4): PixGridGroup[] {
  const count = clampInt(bands, 2, 12)
  return Array.from({ length: count }, (_, index) => {
    const min = index / count
    const max = (index + 1) / count
    const bits = sourceCellBits(source, (x, y, offset) => source.pixels[offset + 3] >= 16 && pixelLuminance(source, x, y) >= min && (index === count - 1 ? pixelLuminance(source, x, y) <= max : pixelLuminance(source, x, y) < max))
    return groupFromSourceBits(`Luminance ${index + 1}`, 'luminanceRange', bits, source, layerId)
  }).filter((group): group is PixGridGroup => group != null)
}

export function createPixGridLayerAlphaGroup(source: PixGridMaskPixelSource, layerId: string | null, threshold = 0.05): PixGridGroup | null {
  const foreground = sourceCellBits(source, (_x, _y, offset) => source.pixels[offset + 3] / 255 >= threshold)
  return groupFromSourceBits('Selected Layer Alpha', 'layerAlpha', foreground, source, layerId, '#ffffff')
}

export function createPixGridAlphaGroups(source: PixGridMaskPixelSource, layerId: string | null, threshold = 0.05): PixGridGroup[] {
  const foreground = sourceCellBits(source, (_x, _y, offset) => source.pixels[offset + 3] / 255 >= threshold)
  const background = sourceCellBits(source, (_x, _y, offset) => source.pixels[offset + 3] / 255 < threshold)
  return [
    groupFromSourceBits('Foreground', 'foregroundBackground', foreground, source, layerId, '#ffffff'),
    groupFromSourceBits('Background', 'foregroundBackground', background, source, layerId, '#2f495e'),
  ].filter((group): group is PixGridGroup => group != null)
}

export function createPixGridConnectedRegionGroups(source: PixGridMaskPixelSource, layerId: string | null, options: { maxRegions?: number; maxCells?: number; alphaThreshold?: number; colorTolerance?: number } = {}): PixGridGroup[] {
  const maxRegions = clampInt(options.maxRegions ?? 12, 1, 32)
  const maxCells = clampInt(options.maxCells ?? MAX_PIX_GRID_CONNECTED_REGION_CELLS, 1, MAX_PIX_GRID_CONNECTED_REGION_CELLS)
  const alphaThreshold = clamp(options.alphaThreshold ?? 0.05, 0, 1)
  const colorTolerance = clamp(options.colorTolerance ?? 0.18, 0, 1)
  const visited = new Uint8Array(source.width * source.height)
  const results: Array<{ bits: Uint32Array; count: number; seed: number }> = []
  const queue = new Int32Array(Math.min(source.width * source.height, maxCells))
  for (let seed = 0; seed < source.width * source.height; seed += 1) {
    if (visited[seed]) continue
    const seedOffset = seed * 4
    if (source.pixels[seedOffset + 3] / 255 < alphaThreshold) { visited[seed] = 1; continue }
    const target: readonly [number, number, number] = [source.pixels[seedOffset], source.pixels[seedOffset + 1], source.pixels[seedOffset + 2]]
    const bits = new Uint32Array(Math.ceil(source.width * source.height / 32))
    let head = 0
    let tail = 0
    queue[tail++] = seed
    visited[seed] = 1
    let count = 0
    while (head < tail && count < maxCells) {
      const index = queue[head++]
      const x = index % source.width
      const y = Math.floor(index / source.width)
      const offset = index * 4
      if (source.pixels[offset + 3] / 255 < alphaThreshold || colorDistance(source, x, y, target) > colorTolerance) continue
      pixGridSetMaskCell(bits, index)
      count += 1
      for (const neighbor of [index - 1, index + 1, index - source.width, index + source.width]) {
        if (neighbor < 0 || neighbor >= visited.length || visited[neighbor]) continue
        const nx = neighbor % source.width
        const ny = Math.floor(neighbor / source.width)
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        visited[neighbor] = 1
        if (tail < queue.length) queue[tail++] = neighbor
      }
    }
    if (count > 0) results.push({ bits, count, seed })
  }
  return results.sort((a, b) => b.count - a.count || a.seed - b.seed).slice(0, maxRegions).flatMap((region, index) => {
    const group = groupFromSourceBits(`Region ${index + 1}`, 'connectedRegion', region.bits, source, layerId)
    return group ? [group] : []
  })
}

function sanitizeSvgName(value: string, fallback: string): string {
  const cleaned = value.replace(/[^a-z0-9 _.-]/gi, ' ').replace(/\s+/g, ' ').trim()
  return (cleaned || fallback).slice(0, 96)
}

function normalizeSvgFill(value: string | null): string | null {
  if (!value) return null
  const compact = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(compact)) return compact
  if (/^#[0-9a-f]{3}$/.test(compact)) return `#${compact.slice(1).split('').map(char => char + char).join('')}`
  const rgb = compact.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (!rgb) return null
  return `#${rgb.slice(1).map(value => clampInt(Number(value), 0, 255).toString(16).padStart(2, '0')).join('')}`
}

export function extractPixGridSvgGroupCandidates(svgText: string): PixGridSvgGroupCandidate[] {
  if (typeof DOMParser === 'undefined' || svgText.length > MAX_PIX_GRID_SVG_SOURCE_CHARACTERS) return []
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  if (document.querySelector('parsererror, script, foreignObject, iframe, object, embed')) return []
  for (const element of Array.from(document.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim().toLowerCase()
      if (name.startsWith('on') || ((name === 'href' || name.endsWith(':href')) && value && !value.startsWith('#'))) return []
    }
  }
  const candidates: PixGridSvgGroupCandidate[] = []
  const seen = new Set<string>()
  const push = (candidate: PixGridSvgGroupCandidate) => {
    const key = `${candidate.kind}:${candidate.elementId ?? ''}:${candidate.fillColor ?? ''}`
    if (seen.has(key) || candidates.length >= 32) return
    seen.add(key)
    candidates.push(candidate)
  }
  for (const element of Array.from(document.querySelectorAll('g[id], path[id], rect[id], circle[id], ellipse[id], polygon[id], polyline[id]'))) {
    const elementId = element.getAttribute('id')?.trim()
    if (!elementId) continue
    const fillColor = normalizeSvgFill(element.getAttribute('fill')) ?? undefined
    push({ id: `svg-${stableHash(elementId).toString(36)}`, name: sanitizeSvgName(elementId, 'SVG Element'), kind: element.tagName.toLowerCase() === 'g' ? 'group' : 'path', elementId, fillColor })
  }
  const fills = new Map<string, number>()
  for (const element of Array.from(document.querySelectorAll('[fill]'))) {
    const fill = normalizeSvgFill(element.getAttribute('fill'))
    if (fill) fills.set(fill, (fills.get(fill) ?? 0) + 1)
  }
  for (const [fillColor] of [...fills.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    push({ id: `svg-fill-${fillColor.slice(1)}`, name: `Fill ${fillColor.toUpperCase()}`, kind: 'fill', fillColor })
  }
  return candidates
}

export function createPixGridSvgGroups(candidates: readonly PixGridSvgGroupCandidate[], source: PixGridMaskPixelSource, layerId: string | null): PixGridGroup[] {
  return candidates.slice(0, 16).flatMap(candidate => {
    if (!candidate.fillColor) return []
    const target = hexRgb(candidate.fillColor)
    const bits = sourceCellBits(source, (x, y, offset) => source.pixels[offset + 3] >= 16 && colorDistance(source, x, y, target) <= 0.08)
    const group = groupFromSourceBits(candidate.name, 'svgMetadata', bits, source, layerId, candidate.fillColor)
    return group ? [{ ...group, mask: { kind: 'runs', runs: group.cellRuns }, smartRuleId: candidate.elementId ?? candidate.fillColor }] : []
  })
}

export function activePixGridGroups(groups: readonly PixGridGroup[]): PixGridGroup[] {
  return groups
    .filter(group => group.enabled)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, MAX_PIX_GRID_ACTIVE_GROUPS)
}

export function clearPixGridGroupMaskCache(): void {
  maskCache.clear()
}
