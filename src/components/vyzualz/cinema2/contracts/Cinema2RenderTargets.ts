export type Cinema2RenderTargetColorFormat = 'rgba8' | 'rgba16f' | 'rgba32f' | 'r8' | 'rg8'
export type Cinema2RenderTargetDepthFormat = 'none' | 'depth16' | 'depth24'
export type Cinema2RenderTargetFilter = 'linear' | 'nearest'
export type Cinema2RenderTargetWrap = 'clamp' | 'repeat' | 'mirror'
export type Cinema2RenderTargetOwnershipClass = 'transient' | 'persistent'
export type Cinema2RenderTargetSurfaceLayout = 'single' | 'paired'

export type Cinema2RenderTargetSize =
  | Readonly<{ kind: 'viewport'; widthScale?: number; heightScale?: number }>
  | Readonly<{ kind: 'fixed'; width: number; height: number }>

/** Serializable Stage 07A render-target storage descriptor. */
export interface Cinema2RenderTargetDescriptor {
  size: Cinema2RenderTargetSize
  colorFormat: Cinema2RenderTargetColorFormat
  depthFormat?: Cinema2RenderTargetDepthFormat
  filter?: Cinema2RenderTargetFilter
  wrap?: Cinema2RenderTargetWrap
  /** A pair is only storage. Temporal/history meaning belongs to later render stages. */
  surfaceLayout?: Cinema2RenderTargetSurfaceLayout
}

export interface Cinema2RenderTargetDescriptorDiagnostic {
  code: string
  message: string
  path: string
}

const COLOR_FORMATS = new Set<Cinema2RenderTargetColorFormat>(['rgba8', 'rgba16f', 'rgba32f', 'r8', 'rg8'])
const DEPTH_FORMATS = new Set<Cinema2RenderTargetDepthFormat>(['none', 'depth16', 'depth24'])
const FILTERS = new Set<Cinema2RenderTargetFilter>(['linear', 'nearest'])
const WRAPS = new Set<Cinema2RenderTargetWrap>(['clamp', 'repeat', 'mirror'])
const SURFACE_LAYOUTS = new Set<Cinema2RenderTargetSurfaceLayout>(['single', 'paired'])

/** Pure authored-data validation used by the render-graph compiler before any GL allocation. */
export function validateCinema2RenderTargetDescriptor(
  value: unknown,
  path: string,
): readonly Cinema2RenderTargetDescriptorDiagnostic[] {
  const diagnostics: Cinema2RenderTargetDescriptorDiagnostic[] = []
  if (!isPlainObject(value)) {
    return Object.freeze([Object.freeze({
      code: 'CINEMA2_RENDER_TARGET_DESCRIPTOR_INVALID',
      message: 'Render target descriptor must be an object.',
      path,
    })])
  }

  const size = value.size
  if (!isPlainObject(size)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_SIZE_INVALID', 'Render target descriptor requires a size object.', `${path}.size`))
  } else if (size.kind === 'fixed') {
    if (!isPositiveInteger(size.width)) diagnostics.push(error('CINEMA2_RENDER_TARGET_SIZE_INVALID', 'Fixed render target width must be a positive integer.', `${path}.size.width`))
    if (!isPositiveInteger(size.height)) diagnostics.push(error('CINEMA2_RENDER_TARGET_SIZE_INVALID', 'Fixed render target height must be a positive integer.', `${path}.size.height`))
  } else if (size.kind === 'viewport') {
    if (size.widthScale != null && !isPositiveFinite(size.widthScale)) diagnostics.push(error('CINEMA2_RENDER_TARGET_SIZE_INVALID', 'Viewport widthScale must be a positive finite number.', `${path}.size.widthScale`))
    if (size.heightScale != null && !isPositiveFinite(size.heightScale)) diagnostics.push(error('CINEMA2_RENDER_TARGET_SIZE_INVALID', 'Viewport heightScale must be a positive finite number.', `${path}.size.heightScale`))
  } else {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_SIZE_INVALID', `Unsupported render target size kind "${String(size.kind)}".`, `${path}.size.kind`))
  }

  if (!COLOR_FORMATS.has(value.colorFormat as Cinema2RenderTargetColorFormat)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_COLOR_FORMAT_INVALID', `Unsupported render target color format "${String(value.colorFormat)}".`, `${path}.colorFormat`))
  }
  if (value.depthFormat != null && !DEPTH_FORMATS.has(value.depthFormat as Cinema2RenderTargetDepthFormat)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_DEPTH_FORMAT_INVALID', `Unsupported render target depth format "${String(value.depthFormat)}".`, `${path}.depthFormat`))
  }
  if (value.filter != null && !FILTERS.has(value.filter as Cinema2RenderTargetFilter)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_FILTER_INVALID', `Unsupported render target filter "${String(value.filter)}".`, `${path}.filter`))
  }
  if (value.wrap != null && !WRAPS.has(value.wrap as Cinema2RenderTargetWrap)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_WRAP_INVALID', `Unsupported render target wrap "${String(value.wrap)}".`, `${path}.wrap`))
  }
  if (value.surfaceLayout != null && !SURFACE_LAYOUTS.has(value.surfaceLayout as Cinema2RenderTargetSurfaceLayout)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGET_SURFACE_LAYOUT_INVALID', `Unsupported render target surface layout "${String(value.surfaceLayout)}".`, `${path}.surfaceLayout`))
  }

  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

function isPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0
}

function isPositiveFinite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function error(code: string, message: string, path: string): Cinema2RenderTargetDescriptorDiagnostic {
  return { code, message, path }
}
