import * as opentype from 'opentype.js'

import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  compileCinema2Object3DSvgGeometry,
  compileCinema2Object3DTextGeometry,
} from '../spatial/Cinema2Object3DGeometry'
import { Cinema2Object3DRenderer } from '../spatial/Cinema2Object3DRenderer'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'

export const CINEMA2_OBJECT3D_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('object3d')
export const CINEMA2_OBJECT3D_MODULE_VERSION = 1 as const

interface Cinema2Object3DSvgSourceConfig {
  kind: 'svg'
  sourceId: string
  revision: string | number
  rawSvg: string
  curveTolerance?: number
}

interface Cinema2Object3DTextSourceConfig {
  kind: 'text'
  sourceId: string
  revision: string | number
  fontIdentity: string
  fontDataBase64: string
  text: string
  letterSpacing?: number
  lineHeight?: number
  alignment?: 'left' | 'center' | 'right'
}

type Cinema2Object3DSourceConfig = Cinema2Object3DSvgSourceConfig | Cinema2Object3DTextSourceConfig

interface Cinema2Object3DConfig {
  source: Cinema2Object3DSourceConfig
  material: {
    color: Cinema2Color
    emissiveIntensity: number
  }
}

const DEFAULT_COLOR = Object.freeze([1, 1, 1, 1]) as Cinema2Color

export const cinema2Object3DModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_OBJECT3D_MODULE_TYPE_ID,
  version: CINEMA2_OBJECT3D_MODULE_VERSION,
  validate(module: Readonly<Cinema2ModuleManifest>) {
    return validateObject3DConfig(module.config)
  },
  create(context: Cinema2ModuleCreateContext) {
    const config = parseObject3DConfig(context.module.config)
    const geometry = config.source.kind === 'svg'
      ? compileCinema2Object3DSvgGeometry({
          sourceId: config.source.sourceId,
          revision: config.source.revision,
          rawSvg: config.source.rawSvg,
          options: config.source.curveTolerance == null ? undefined : { curveTolerance: config.source.curveTolerance },
        })
      : compileCinema2Object3DTextGeometry({
          font: parseFontData(config.source.fontDataBase64),
          fontIdentity: `${config.source.sourceId}:${config.source.fontIdentity}`,
          fontRevision: config.source.revision,
          text: config.source.text,
          letterSpacing: config.source.letterSpacing,
          lineHeight: config.source.lineHeight,
          alignment: config.source.alignment,
        })
    if (!geometry.ok) throw new Error(`Cinema 2.0 Object3D ${config.source.kind} geometry failed: ${geometry.error}`)

    const renderer = context.resources.acquire(
      `object3d:${geometry.value.key}`,
      'Cinema2Object3DRenderer',
      gl => new Cinema2Object3DRenderer(gl, geometry.value.key, geometry.value.mesh),
      value => value.dispose(),
    )

    const provider = Object.freeze({
      id: `${context.module.id}:object3d`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        const nodes = execution.spatialNodes ?? []
        const drawable = nodes.filter(node => node.visible && node.coordinateSpace === 'world')
        if (drawable.length === 0) return
        if (!execution.depthAvailable) {
          throw new Error(`Cinema 2.0 Object3D module "${context.module.id}" requires a render target with a depth attachment.`)
        }
        const color = resolveColor(context, 'color', config.material.color)
        const emissiveIntensity = resolveNumber(context, 'emissiveIntensity', config.material.emissiveIntensity, 0)
        for (const node of drawable) {
          renderer.draw({
            modelMatrix: node.worldMatrix,
            width: execution.width,
            height: execution.height,
            material: { color, emissiveIntensity },
          })
        }
      },
    })

    return {
      lifecycle: { update: () => {}, dispose: () => {} },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

function validateObject3DConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  const source = asObject(config?.source)
  if (!source) {
    diagnostics.push(diagnostic('CINEMA2_OBJECT3D_SOURCE_REQUIRED', '$.config.source', 'Object3D module requires a source object.'))
    return Object.freeze(diagnostics)
  }
  if (source.kind !== 'svg' && source.kind !== 'text') {
    diagnostics.push(diagnostic('CINEMA2_OBJECT3D_SOURCE_KIND_INVALID', '$.config.source.kind', 'Object3D source kind must be "svg" or "text".'))
  }
  if (typeof source.sourceId !== 'string' || source.sourceId.trim().length === 0) {
    diagnostics.push(diagnostic('CINEMA2_OBJECT3D_SOURCE_ID_INVALID', '$.config.source.sourceId', 'Object3D sourceId must be a non-empty string.'))
  }
  if (typeof source.revision !== 'string' && (typeof source.revision !== 'number' || !Number.isFinite(source.revision))) {
    diagnostics.push(diagnostic('CINEMA2_OBJECT3D_SOURCE_REVISION_INVALID', '$.config.source.revision', 'Object3D source revision must be a finite number or string.'))
  }
  if (source.kind === 'svg') {
    if (typeof source.rawSvg !== 'string' || source.rawSvg.trim().length === 0) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_SVG_INVALID', '$.config.source.rawSvg', 'Object3D SVG source must contain non-empty SVG markup.'))
    }
    if (source.curveTolerance != null && (typeof source.curveTolerance !== 'number' || !Number.isFinite(source.curveTolerance) || source.curveTolerance <= 0)) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_TESSELLATION_INVALID', '$.config.source.curveTolerance', 'Object3D SVG curveTolerance must be a positive finite number.'))
    }
  } else if (source.kind === 'text') {
    if (typeof source.fontIdentity !== 'string' || source.fontIdentity.trim().length === 0) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_FONT_IDENTITY_INVALID', '$.config.source.fontIdentity', 'Object3D text source requires a stable font identity.'))
    }
    if (typeof source.fontDataBase64 !== 'string' || source.fontDataBase64.trim().length === 0) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_FONT_DATA_INVALID', '$.config.source.fontDataBase64', 'Object3D text source requires base64 OpenType font data.'))
    }
    if (typeof source.text !== 'string' || source.text.trim().length === 0) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_TEXT_INVALID', '$.config.source.text', 'Object3D text source requires non-empty text.'))
    }
    if (source.letterSpacing != null && (typeof source.letterSpacing !== 'number' || !Number.isFinite(source.letterSpacing))) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_TEXT_SPACING_INVALID', '$.config.source.letterSpacing', 'Object3D text letterSpacing must be finite.'))
    }
    if (source.lineHeight != null && (typeof source.lineHeight !== 'number' || !Number.isFinite(source.lineHeight) || source.lineHeight <= 0)) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_TEXT_LINE_HEIGHT_INVALID', '$.config.source.lineHeight', 'Object3D text lineHeight must be positive and finite.'))
    }
    if (source.alignment != null && !['left', 'center', 'right'].includes(String(source.alignment))) {
      diagnostics.push(diagnostic('CINEMA2_OBJECT3D_TEXT_ALIGNMENT_INVALID', '$.config.source.alignment', 'Object3D text alignment must be left, center or right.'))
    }
  }
  const material = asObject(config?.material)
  if (material?.color != null && !isColor(material.color)) {
    diagnostics.push(diagnostic('CINEMA2_OBJECT3D_COLOR_INVALID', '$.config.material.color', 'Object3D material color must contain four finite values from 0 through 1.'))
  }
  if (material?.emissiveIntensity != null && (typeof material.emissiveIntensity !== 'number' || !Number.isFinite(material.emissiveIntensity) || material.emissiveIntensity < 0)) {
    diagnostics.push(diagnostic('CINEMA2_OBJECT3D_EMISSIVE_INVALID', '$.config.material.emissiveIntensity', 'Object3D emissiveIntensity must be a finite non-negative number.'))
  }
  return Object.freeze(diagnostics)
}

function parseObject3DConfig(config: Cinema2JsonObject | undefined): Cinema2Object3DConfig {
  const diagnostics = validateObject3DConfig(config)
  if (diagnostics.length > 0) throw new Error(diagnostics.map(entry => `${entry.path}: ${entry.message}`).join('; '))
  const source = asObject(config?.source)!
  const material = asObject(config?.material)
  return {
    source: source.kind === 'text'
      ? {
          kind: 'text',
          sourceId: String(source.sourceId),
          revision: source.revision as string | number,
          fontIdentity: String(source.fontIdentity),
          fontDataBase64: String(source.fontDataBase64),
          text: String(source.text),
          letterSpacing: typeof source.letterSpacing === 'number' ? source.letterSpacing : undefined,
          lineHeight: typeof source.lineHeight === 'number' ? source.lineHeight : undefined,
          alignment: source.alignment === 'center' || source.alignment === 'right' ? source.alignment : 'left',
        }
      : {
          kind: 'svg',
          sourceId: String(source.sourceId),
          revision: source.revision as string | number,
          rawSvg: String(source.rawSvg),
          curveTolerance: typeof source.curveTolerance === 'number' ? source.curveTolerance : undefined,
        },
    material: {
      color: isColor(material?.color) ? Object.freeze([...material.color]) as Cinema2Color : DEFAULT_COLOR,
      emissiveIntensity: typeof material?.emissiveIntensity === 'number' ? material.emissiveIntensity : 0,
    },
  }
}

function parseFontData(value: string): opentype.Font {
  try {
    const decode = globalThis.atob
    if (typeof decode !== 'function') throw new Error('base64 decoding is unavailable')
    const binary = decode(value.replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return opentype.parse(bytes.buffer)
  } catch (error) {
    throw new Error(`Cinema 2.0 Object3D text font could not be parsed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function resolveColor(context: Cinema2ModuleCreateContext, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = context.parameters.get(name)
  return isColor(value) ? Object.freeze([...value]) as Cinema2Color : fallback
}

function resolveNumber(context: Cinema2ModuleCreateContext, name: string, fallback: number, min: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, value) : fallback
}

function isColor(value: unknown): value is Cinema2Color {
  return Array.isArray(value)
    && value.length === 4
    && value.every(component => typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1)
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function diagnostic(code: string, path: string, message: string): Cinema2ModuleDiagnostic {
  return Object.freeze({ code, path, message })
}
