import type { ShaderCompileFailure } from './shaderRuntimeTypes'

// ── Result type ───────────────────────────────────────────────────────────────

export type ShaderCompileResult =
  | { shader: WebGLShader; error: null }
  | { shader: null; error: ShaderCompileFailure }

// ── Compiler ──────────────────────────────────────────────────────────────────

export class ShaderCompiler {
  private readonly gl: WebGL2RenderingContext

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  compile(type: 'vertex' | 'fragment', src: string, label: string): ShaderCompileResult {
    const gl = this.gl
    const glType = type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER

    const s = gl.createShader(glType)
    if (!s) {
      return {
        shader: null,
        error: {
          stage: type,
          label,
          log: 'gl.createShader() returned null — GPU resource exhaustion or context lost',
        },
      }
    }

    gl.shaderSource(s, src)
    gl.compileShader(s)

    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) ?? ''
      gl.deleteShader(s)
      return {
        shader: null,
        error: {
          stage: type,
          label,
          log,
          annotatedSource: annotateSource(src, log),
        },
      }
    }

    return { shader: s, error: null }
  }
}

// ── Source annotation ─────────────────────────────────────────────────────────

function annotateSource(src: string, log: string): string | undefined {
  // GLSL error logs typically contain "0:<line>:" or "ERROR: 0:<line>:"
  const lineMatch = log.match(/\b0:(\d+)\b/)
  if (!lineMatch) return undefined

  const errorLine = parseInt(lineMatch[1], 10)
  const lines = src.split('\n')
  const start = Math.max(0, errorLine - 3)
  const end = Math.min(lines.length, errorLine + 2)

  return lines
    .slice(start, end)
    .map((line, i) => {
      const lineNum = start + i + 1
      const marker = lineNum === errorLine ? '>>>' : '   '
      return `${marker} ${String(lineNum).padStart(4)} | ${line}`
    })
    .join('\n')
}
