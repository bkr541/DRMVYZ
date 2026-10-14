// Khronos glTF Validator plus the Cinema 2.0 engine checks. A model passes when the validator reports no errors and the engine checks find no
// error-level problem (unsupported required extensions, invalid geometry, over-budget triangle count).
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import validator from 'gltf-validator'

const SEVERITY = ['error', 'warning', 'info', 'hint']

/** Runs the Khronos validator over raw GLB/glTF bytes. */
export async function validateBytes(bytes, uri, options = {}) {
  const report = await validator.validateBytes(bytes, {
    uri,
    maxIssues: options.maxIssues ?? 200,
    externalResourceFunction: options.externalResourceFunction ?? (async resource => { throw new Error(`external resource "${resource}" is not shipped; Cinema 2.0 models embed everything in the GLB`) }),
    ignoredIssues: options.ignoredIssues ?? [],
  })
  const issues = (report.issues?.messages ?? []).map(message => ({
    severity: SEVERITY[message.severity] ?? 'info',
    code: message.code,
    message: message.message,
    pointer: message.pointer ?? null,
  }))
  return {
    validatorVersion: validator.version(),
    numErrors: report.issues?.numErrors ?? 0,
    numWarnings: report.issues?.numWarnings ?? 0,
    numInfos: report.issues?.numInfos ?? 0,
    numHints: report.issues?.numHints ?? 0,
    truncated: report.issues?.truncated ?? false,
    generator: report.info?.generator ?? null,
    extensionsUsed: report.info?.extensionsUsed ?? [],
    extensionsRequired: report.info?.extensionsRequired ?? [],
    issues,
  }
}

/** Reads the file from disk and validates it. A `.gltf` with external files resolves them relative to its folder. */
export async function validateFile(path, options = {}) {
  const bytes = new Uint8Array(await readFile(path))
  const folder = dirname(path)
  return validateBytes(bytes, basename(path), {
    ...options,
    externalResourceFunction: path.toLowerCase().endsWith('.gltf')
      ? async resource => new Uint8Array(await readFile(join(folder, decodeURIComponent(resource))))
      : undefined,
  })
}
