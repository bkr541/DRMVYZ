import type { ShaderDefinition, ShaderPassDef } from './shaderRegistryTypes'
import { FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'

export type ShaderSourceStage = 'vertex' | 'fragment'

export interface ShaderSourceIssue {
  code:
    | 'MISSING_VERSION'
    | 'UNSUPPORTED_VERSION'
    | 'MISSING_MAIN'
    | 'UNBALANCED_DELIMITER'
    | 'RESERVED_IDENTIFIER'
    | 'LEGACY_WEBGL1_TOKEN'
    | 'MISSING_PARAM_UNIFORM'
    | 'MISSING_INPUT_UNIFORM'
  message: string
  line?: number
  identifier?: string
}

export interface ShaderSourceUnit {
  label: string
  stage: ShaderSourceStage
  source: string
  pass?: ShaderPassDef
}

// Reserved words from the GLSL ES 3.00 specification. Several of these are
// deliberately reserved for future language revisions even though they have no
// current grammar production. They still cannot be used as identifiers.
export const GLSL_ES_300_RESERVED_IDENTIFIERS = new Set([
  'asm', 'class', 'union', 'enum', 'typedef', 'template', 'this', 'resource',
  'goto', 'inline', 'noinline', 'public', 'static', 'extern', 'external',
  'interface', 'long', 'short', 'half', 'fixed', 'unsigned', 'superp',
  'input', 'output', 'hvec2', 'hvec3', 'hvec4', 'fvec2', 'fvec3', 'fvec4',
  'sampler3DRect', 'filter', 'sizeof', 'cast', 'namespace', 'using',
  'common', 'partition', 'active',
])

const TYPE_PATTERN = [
  'void', 'bool', 'int', 'uint', 'float',
  'bvec[234]', 'ivec[234]', 'uvec[234]', 'vec[234]',
  'mat[234]', 'mat[234]x[234]',
  'sampler2D', 'sampler3D', 'samplerCube', 'sampler2DShadow',
  'sampler2DArray', 'sampler2DArrayShadow', 'isampler2D', 'isampler3D',
  'isamplerCube', 'isampler2DArray', 'usampler2D', 'usampler3D',
  'usamplerCube', 'usampler2DArray',
].join('|')

const LEGACY_WEBGL1_TOKENS = ['gl_FragColor', 'gl_FragData', 'texture2D', 'textureCube', 'attribute', 'varying']

/** Remove comments while preserving newlines so issue line numbers stay useful. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, match => ' '.repeat(match.length))
}

function lineAt(source: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++
  return line
}

function collectStructTypes(source: string): string[] {
  return [...source.matchAll(/\bstruct\s+([A-Za-z_]\w*)\s*\{/g)].map(match => match[1])
}

export function extractUniformDeclarations(source: string): Map<string, string> {
  const clean = stripComments(source)
  const uniforms = new Map<string, string>()
  const re = /\buniform\s+(?:(?:lowp|mediump|highp)\s+)?([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*(?:\[[^\]]+\])?\s*;/g
  for (const match of clean.matchAll(re)) uniforms.set(match[2], match[1])
  return uniforms
}

export function validateGlslSource(source: string, stage: ShaderSourceStage): ShaderSourceIssue[] {
  const issues: ShaderSourceIssue[] = []
  const clean = stripComments(source)
  const firstMeaningful = clean.split('\n').find(line => line.trim().length > 0)?.trim() ?? ''

  if (!firstMeaningful.startsWith('#version')) {
    issues.push({ code: 'MISSING_VERSION', message: 'GLSL source must begin with #version 300 es.' })
  } else if (firstMeaningful !== '#version 300 es') {
    issues.push({ code: 'UNSUPPORTED_VERSION', message: `Expected "#version 300 es", found "${firstMeaningful}".` })
  }

  if (!/\bvoid\s+main\s*\(\s*\)/.test(clean)) {
    issues.push({ code: 'MISSING_MAIN', message: `${stage} shader does not declare void main().` })
  }

  const delimiterStack: { char: string; offset: number }[] = []
  const openerFor: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (char === '(' || char === '[' || char === '{') delimiterStack.push({ char, offset: i })
    else if (char === ')' || char === ']' || char === '}') {
      const expected = openerFor[char]
      const top = delimiterStack.pop()
      if (!top || top.char !== expected) {
        issues.push({
          code: 'UNBALANCED_DELIMITER',
          message: `Unexpected "${char}" delimiter.`,
          line: lineAt(clean, i),
        })
        break
      }
    }
  }
  if (delimiterStack.length > 0) {
    const top = delimiterStack[delimiterStack.length - 1]
    issues.push({
      code: 'UNBALANCED_DELIMITER',
      message: `Unclosed "${top.char}" delimiter.`,
      line: lineAt(clean, top.offset),
    })
  }

  const structTypes = collectStructTypes(clean).map(type => type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const declarationTypes = [TYPE_PATTERN, ...structTypes].join('|')
  const declarationRe = new RegExp(
    `\\b(?:const\\s+)?(?:(?:lowp|mediump|highp)\\s+)?(?:${declarationTypes})\\s+([A-Za-z_]\\w*)`,
    'g',
  )
  for (const match of clean.matchAll(declarationRe)) {
    const identifier = match[1]
    if (GLSL_ES_300_RESERVED_IDENTIFIERS.has(identifier)) {
      issues.push({
        code: 'RESERVED_IDENTIFIER',
        identifier,
        line: lineAt(clean, match.index ?? 0),
        message: `Identifier "${identifier}" is reserved by GLSL ES 3.00.`,
      })
    }
  }

  for (const token of LEGACY_WEBGL1_TOKENS) {
    const re = new RegExp(`\\b${token}\\b`)
    const match = re.exec(clean)
    if (match) {
      issues.push({
        code: 'LEGACY_WEBGL1_TOKEN',
        identifier: token,
        line: lineAt(clean, match.index),
        message: `WebGL1 token "${token}" is not supported in GLSL ES 3.00 shaders.`,
      })
    }
  }

  return issues
}

export function getShaderSourceUnits(def: ShaderDefinition): ShaderSourceUnit[] {
  if (def.passes && def.passes.length > 0) {
    return def.passes.flatMap(pass => [
      {
        label: `${def.id}/${pass.id}/vert`,
        stage: 'vertex' as const,
        source: pass.vertSrc && pass.vertSrc !== 'shared'
          ? pass.vertSrc
          : def.vertSrc && def.vertSrc !== 'shared'
            ? def.vertSrc
            : FULLSCREEN_VERT_SRC,
        pass,
      },
      { label: `${def.id}/${pass.id}/frag`, stage: 'fragment' as const, source: pass.fragSrc, pass },
    ])
  }

  return [
    {
      label: `${def.id}/__single__/vert`,
      stage: 'vertex',
      source: def.vertSrc && def.vertSrc !== 'shared' ? def.vertSrc : FULLSCREEN_VERT_SRC,
    },
    { label: `${def.id}/__single__/frag`, stage: 'fragment', source: def.fragSrc ?? '' },
  ]
}

/**
 * Deterministic source-level validation used by unit tests when a real WebGL2
 * compiler is unavailable. This complements, rather than replaces, browser
 * compilation coverage.
 */
export function validateShaderDefinitionSources(def: ShaderDefinition): ShaderSourceIssue[] {
  const issues = getShaderSourceUnits(def).flatMap(unit =>
    validateGlslSource(unit.source, unit.stage).map(issue => ({
      ...issue,
      message: `${unit.label}: ${issue.message}`,
    })),
  )

  const allUniforms = new Set<string>()
  for (const unit of getShaderSourceUnits(def)) {
    for (const name of extractUniformDeclarations(unit.source).keys()) allUniforms.add(name)
  }

  for (const param of def.params) {
    if (!allUniforms.has(param.uniformName)) {
      issues.push({
        code: 'MISSING_PARAM_UNIFORM',
        identifier: param.uniformName,
        message: `${def.id}: parameter "${param.id}" targets undeclared uniform "${param.uniformName}".`,
      })
    }
  }

  for (const pass of def.passes ?? []) {
    const uniforms = extractUniformDeclarations(pass.fragSrc)
    for (const raw of pass.inputs) {
      const uniformName = typeof raw === 'string' ? raw.replace(/-/g, '_') : raw.uniformName
      if (uniforms.get(uniformName) !== 'sampler2D') {
        issues.push({
          code: 'MISSING_INPUT_UNIFORM',
          identifier: uniformName,
          message: `${def.id}/${pass.id}: input sampler "${uniformName}" must be declared as uniform sampler2D.`,
        })
      }
    }
  }

  return issues
}
