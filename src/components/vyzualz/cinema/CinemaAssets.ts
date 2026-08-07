import type {
  CinemaAssetBindingDefinition,
  CinemaAssetRole,
  CinemaBlendMode,
  CinemaBrandColorPolicy,
  CinemaBrandRole,
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
  CinemaVector2,
} from './CinemaDomain'
import { isCinemaJsonValue } from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import type {
  CinemaAssetBindingId,
  CinemaAssetId,
  CinemaNodeId,
} from './CinemaIdentifiers'
import { parseCinemaStableId } from './CinemaIdentifiers'
import { normalizeCinemaBrandColorPolicy } from './CinemaBrandKitBridge'

export const CINEMA_ASSET_ROLES: readonly CinemaAssetRole[] = Object.freeze([
  'logo', 'image', 'video', 'album-artwork', 'mask', 'material', 'displacement',
  'environment', 'lyric-background', 'node-output', 'font', 'audio',
])
export const CINEMA_ASSET_FITS = Object.freeze(['contain', 'cover', 'stretch', 'none'] as const)
export const CINEMA_ASSET_BLEND_MODES: readonly CinemaBlendMode[] = Object.freeze([
  'normal', 'add', 'screen', 'multiply', 'lighten', 'darken', 'difference', 'overlay', 'masked',
])
export const CINEMA_BRAND_ROLES: readonly CinemaBrandRole[] = Object.freeze([
  'primary', 'secondary', 'accent', 'background', 'foreground', 'highlight', 'shadow',
])

export type CinemaAssetMediaKind = 'image' | 'video' | 'svg' | 'font' | 'audio' | 'node-output' | 'unknown'

/** Runtime-only snapshot from the canonical media library. Never persist this shape. */
export interface CinemaExternalAssetSnapshot {
  assetId: CinemaAssetId
  revision: string | number
  name: string
  mimeType: string | null
  mediaKind: CinemaAssetMediaKind
  runtimeUrl: string | null
  width?: number
  height?: number
  durationSec?: number
  deleted?: boolean
  nodeOutputNodeId?: CinemaNodeId
}

export type CinemaAssetFallbackKind = 'transparent' | 'checkerboard' | 'silent' | 'system-font'

export interface CinemaAssetFallbackDescriptor {
  kind: CinemaAssetFallbackKind
  color: readonly [number, number, number, number]
  reason: 'missing' | 'deleted' | 'incompatible' | 'recursive' | 'unavailable'
}

export interface CinemaAssetBindingNormalizationResult {
  ok: boolean
  value: CinemaAssetBindingDefinition | null
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaResolvedAuthoredAssetBinding {
  binding: Readonly<CinemaAssetBindingDefinition>
  source: Readonly<CinemaExternalAssetSnapshot> | null
  available: boolean
  fallback: Readonly<CinemaAssetFallbackDescriptor> | null
  diagnostics: readonly CinemaDiagnostic[]
}

export function normalizeCinemaAssetBinding(
  input: unknown,
): CinemaAssetBindingNormalizationResult {
  const diagnostics: CinemaDiagnostic[] = []
  if (!isPlainRecord(input) || !isCinemaJsonValue(input)) {
    diagnostics.push(assetBindingDiagnostic('Cinema asset binding must contain plain JSON data only.'))
    return { ok: false, value: null, diagnostics: createCinemaDiagnosticSnapshot(diagnostics) }
  }

  const id = parseCinemaStableId<CinemaAssetBindingId>(input.id, 'asset binding')
  const assetId = parseCinemaStableId<CinemaAssetId>(input.assetId, 'asset')
  diagnostics.push(...id.diagnostics, ...assetId.diagnostics)
  const role = CINEMA_ASSET_ROLES.includes(input.role as CinemaAssetRole)
    ? input.role as CinemaAssetRole
    : null
  if (!role) diagnostics.push(assetBindingDiagnostic('Cinema asset binding role is invalid.', { role: String(input.role) }))

  const fit = CINEMA_ASSET_FITS.includes(input.fit as never)
    ? input.fit as CinemaAssetBindingDefinition['fit']
    : 'contain'
  if (input.fit !== undefined && fit !== input.fit) {
    diagnostics.push(assetBindingDiagnostic('Cinema asset fit was normalized to contain.', { fit: String(input.fit) }, 'warning'))
  }

  const crop = input.crop === undefined ? undefined : normalizeCrop(input.crop, diagnostics)
  const position = input.position === undefined ? undefined : normalizeVector2(input.position, [0.5, 0.5], diagnostics, 'position')
  const scale = input.scale === undefined ? undefined : normalizeVector2(input.scale, [1, 1], diagnostics, 'scale', 0.0001, 1000)
  const rotationRadians = input.rotationRadians === undefined
    ? undefined
    : finiteNumber(input.rotationRadians, 0, diagnostics, 'rotationRadians')
  const preserveOriginalColors = input.preserveOriginalColors !== false
  const colorizeWithBrandRole = CINEMA_BRAND_ROLES.includes(input.colorizeWithBrandRole as CinemaBrandRole)
    ? input.colorizeWithBrandRole as CinemaBrandRole
    : undefined
  if (input.colorizeWithBrandRole !== undefined && colorizeWithBrandRole === undefined) {
    diagnostics.push(assetBindingDiagnostic('Cinema asset Brand Kit role is invalid.', {
      role: String(input.colorizeWithBrandRole),
    }))
  }
  const brandColorPolicy: CinemaBrandColorPolicy | undefined = colorizeWithBrandRole
    ? normalizeCinemaBrandColorPolicy(input.brandColorPolicy, 'derived')
    : undefined
  if (input.brandColorPolicy !== undefined
    && input.brandColorPolicy !== 'exact'
    && input.brandColorPolicy !== 'derived'
    && input.brandColorPolicy !== 'free') {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_BRAND_POLICY_INVALID',
      severity: 'warning',
      message: 'Cinema asset Brand Kit policy was normalized.',
      details: { value: String(input.brandColorPolicy), normalized: brandColorPolicy ?? 'free' },
    }))
  }
  const opacity = clampFinite(input.opacity, 1, 0, 1, diagnostics, 'opacity')
  const blendMode = CINEMA_ASSET_BLEND_MODES.includes(input.blendMode as CinemaBlendMode)
    ? input.blendMode as CinemaBlendMode
    : 'normal'
  if (input.blendMode !== undefined && blendMode !== input.blendMode) {
    diagnostics.push(assetBindingDiagnostic('Cinema asset blend mode was normalized to normal.', {
      blendMode: String(input.blendMode),
    }, 'warning'))
  }

  if (!id.ok || !assetId.ok || !role) {
    return { ok: false, value: null, diagnostics: createCinemaDiagnosticSnapshot(diagnostics) }
  }

  const value: CinemaAssetBindingDefinition = Object.freeze({
    id: id.value,
    assetId: assetId.value,
    role,
    fit,
    ...(crop ? { crop } : {}),
    ...(position ? { position } : {}),
    ...(scale ? { scale } : {}),
    ...(rotationRadians !== undefined ? { rotationRadians } : {}),
    preserveOriginalColors,
    ...(colorizeWithBrandRole ? { colorizeWithBrandRole } : {}),
    ...(brandColorPolicy ? { brandColorPolicy } : {}),
    opacity,
    blendMode,
  })
  const snapshot = createCinemaDiagnosticSnapshot(diagnostics)
  return { ok: snapshot.counts.error === 0 && snapshot.counts.fatal === 0, value, diagnostics: snapshot }
}

export function resolveCinemaAuthoredAssetBindings(input: {
  composition: Readonly<CinemaCompositionDefinition>
  instance?: Readonly<CinemaCompositionInstance> | null
  sources: readonly Readonly<CinemaExternalAssetSnapshot>[]
}): {
  bindings: ReadonlyMap<CinemaAssetBindingId, Readonly<CinemaResolvedAuthoredAssetBinding>>
  diagnostics: CinemaDiagnosticSnapshot
} {
  const diagnostics: CinemaDiagnostic[] = []
  const sources = new Map(input.sources.map(source => [source.assetId, source]))
  const overrides = new Map<CinemaAssetBindingId, CinemaCompositionInstance['assetBindingOverrides'][number]['values']>()
  if (input.instance?.compositionId === input.composition.id) {
    for (const override of input.instance.assetBindingOverrides) overrides.set(override.bindingId, override.values)
  }
  const resolved = new Map<CinemaAssetBindingId, Readonly<CinemaResolvedAuthoredAssetBinding>>()
  const nodeOutputEdges = new Map<CinemaNodeId, CinemaNodeId[]>()

  for (const authored of input.composition.assetBindings) {
    const normalized = normalizeCinemaAssetBinding({ ...authored, ...(overrides.get(authored.id) ?? {}) })
    diagnostics.push(...normalized.diagnostics.diagnostics)
    if (!normalized.value) continue
    const binding = normalized.value
    const source = sources.get(binding.assetId) ?? null
    const bindingDiagnostics: CinemaDiagnostic[] = []
    let fallback: CinemaAssetFallbackDescriptor | null = null

    if (!source) {
      bindingDiagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_ASSET_MISSING',
        severity: 'warning',
        message: `Cinema asset "${binding.assetId}" is missing; a deterministic fallback is active.`,
        attribution: { compositionId: input.composition.id, assetId: binding.assetId },
      }))
      fallback = createCinemaAssetFallback(binding.role, 'missing')
    } else if (source.deleted) {
      bindingDiagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_ASSET_MISSING',
        severity: 'warning',
        message: `Cinema asset "${binding.assetId}" was deleted; a deterministic fallback is active.`,
        attribution: { compositionId: input.composition.id, assetId: binding.assetId },
        details: { deleted: true },
      }))
      fallback = createCinemaAssetFallback(binding.role, 'deleted')
    } else if (!isCinemaAssetRoleCompatible(binding.role, source.mediaKind, source.mimeType)) {
      bindingDiagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_ASSET_CAPABILITY_MISMATCH',
        severity: 'warning',
        message: `Cinema asset "${binding.assetId}" is incompatible with role "${binding.role}".`,
        attribution: { compositionId: input.composition.id, assetId: binding.assetId },
        details: { role: binding.role, mediaKind: source.mediaKind, mimeType: source.mimeType ?? '' },
      }))
      fallback = createCinemaAssetFallback(binding.role, 'incompatible')
    }

    if (binding.role === 'node-output' && source?.nodeOutputNodeId) {
      for (const node of input.composition.nodes) {
        if (!(node.assetBindingIds ?? []).includes(binding.id)) continue
        const edges = nodeOutputEdges.get(node.id) ?? []
        edges.push(source.nodeOutputNodeId)
        nodeOutputEdges.set(node.id, edges)
      }
    }

    diagnostics.push(...bindingDiagnostics)
    resolved.set(binding.id, Object.freeze({
      binding,
      source,
      available: fallback == null && (source?.runtimeUrl != null || source?.mediaKind === 'node-output'),
      fallback,
      diagnostics: Object.freeze(bindingDiagnostics),
    }))
  }

  const recursiveNodes = findRecursiveNodeOutputBindings(nodeOutputEdges)
  if (recursiveNodes.size > 0) {
    for (const [bindingId, entry] of resolved) {
      if (entry.binding.role !== 'node-output' || !entry.source?.nodeOutputNodeId) continue
      const owners = input.composition.nodes.filter(node => (node.assetBindingIds ?? []).includes(bindingId))
      if (!owners.some(node => recursiveNodes.has(node.id))) continue
      const diagnostic = createCinemaDiagnostic({
        code: 'CINEMA_ASSET_RECURSIVE_BINDING',
        severity: 'error',
        message: `Cinema node-output asset binding "${bindingId}" creates a recursive dependency.`,
        attribution: { compositionId: input.composition.id, assetId: entry.binding.assetId },
        details: { bindingId },
      })
      diagnostics.push(diagnostic)
      resolved.set(bindingId, Object.freeze({
        ...entry,
        available: false,
        fallback: createCinemaAssetFallback(entry.binding.role, 'recursive'),
        diagnostics: Object.freeze([...entry.diagnostics, diagnostic]),
      }))
    }
  }

  return { bindings: resolved, diagnostics: createCinemaDiagnosticSnapshot(diagnostics) }
}

export function isCinemaAssetRoleCompatible(
  role: CinemaAssetRole,
  mediaKind: CinemaAssetMediaKind,
  mimeType: string | null,
): boolean {
  if (role === 'node-output') return mediaKind === 'node-output'
  if (role === 'video') return mediaKind === 'video' || mimeType?.startsWith('video/') === true
  if (role === 'font') return mediaKind === 'font' || mimeType?.startsWith('font/') === true
  if (role === 'audio') return mediaKind === 'audio' || mimeType?.startsWith('audio/') === true
  return mediaKind === 'image'
    || mediaKind === 'svg'
    || mimeType?.startsWith('image/') === true
}

export function createCinemaAssetFallback(
  role: CinemaAssetRole,
  reason: CinemaAssetFallbackDescriptor['reason'],
): Readonly<CinemaAssetFallbackDescriptor> {
  if (role === 'audio') return Object.freeze({ kind: 'silent', color: [0, 0, 0, 0] as const, reason })
  if (role === 'font') return Object.freeze({ kind: 'system-font', color: [0, 0, 0, 0] as const, reason })
  if (role === 'mask' || role === 'node-output') {
    return Object.freeze({ kind: 'transparent', color: [0, 0, 0, 0] as const, reason })
  }
  return Object.freeze({ kind: 'checkerboard', color: [0.18, 0.18, 0.18, 1] as const, reason })
}

function normalizeCrop(value: unknown, diagnostics: CinemaDiagnostic[]): readonly [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    diagnostics.push(assetBindingDiagnostic('Cinema asset crop was normalized to the full source.', undefined, 'warning'))
    return Object.freeze([0, 0, 1, 1])
  }
  const left = clampNumber(value[0], 0, 1, 0)
  const top = clampNumber(value[1], 0, 1, 0)
  const right = clampNumber(value[2], 0, 1, 1)
  const bottom = clampNumber(value[3], 0, 1, 1)
  if (right <= left || bottom <= top) {
    diagnostics.push(assetBindingDiagnostic('Cinema asset crop had no positive area and was normalized to the full source.', undefined, 'warning'))
    return Object.freeze([0, 0, 1, 1])
  }
  return Object.freeze([left, top, right, bottom])
}

function normalizeVector2(
  value: unknown,
  fallback: CinemaVector2,
  diagnostics: CinemaDiagnostic[],
  field: string,
  minimum = -1000,
  maximum = 1000,
): CinemaVector2 {
  if (!Array.isArray(value) || value.length !== 2) {
    diagnostics.push(assetBindingDiagnostic(`Cinema asset ${field} was normalized.`, undefined, 'warning'))
    return Object.freeze([...fallback]) as CinemaVector2
  }
  return Object.freeze([
    clampNumber(value[0], minimum, maximum, fallback[0]),
    clampNumber(value[1], minimum, maximum, fallback[1]),
  ]) as CinemaVector2
}

function finiteNumber(value: unknown, fallback: number, diagnostics: CinemaDiagnostic[], field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  diagnostics.push(assetBindingDiagnostic(`Cinema asset ${field} was normalized.`, undefined, 'warning'))
  return fallback
}

function clampFinite(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  diagnostics: CinemaDiagnostic[],
  field: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    if (value !== undefined) diagnostics.push(assetBindingDiagnostic(`Cinema asset ${field} was normalized.`, undefined, 'warning'))
    return fallback
  }
  return Math.min(maximum, Math.max(minimum, value))
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

function findRecursiveNodeOutputBindings(edges: ReadonlyMap<CinemaNodeId, readonly CinemaNodeId[]>): Set<CinemaNodeId> {
  const recursive = new Set<CinemaNodeId>()
  const visiting = new Set<CinemaNodeId>()
  const visited = new Set<CinemaNodeId>()
  const stack: CinemaNodeId[] = []
  const visit = (node: CinemaNodeId) => {
    if (visiting.has(node)) {
      const start = stack.indexOf(node)
      for (const member of stack.slice(Math.max(0, start))) recursive.add(member)
      recursive.add(node)
      return
    }
    if (visited.has(node)) return
    visiting.add(node)
    stack.push(node)
    for (const target of edges.get(node) ?? []) visit(target)
    stack.pop()
    visiting.delete(node)
    visited.add(node)
  }
  for (const node of edges.keys()) visit(node)
  return recursive
}

function assetBindingDiagnostic(
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
  severity: 'warning' | 'error' = 'error',
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_ASSET_BINDING_INVALID',
    severity,
    message,
    ...(details ? { details } : {}),
  })
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
