import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
export function optionalSourceDirectory(root, preset, fallback) {
  return process.env.STAGELESS_SOURCE_ASSETS
    ? resolve(process.env.STAGELESS_SOURCE_ASSETS, preset)
    : resolve(root, fallback)
}
export function requiredSource(directory, file) {
  const path = resolve(directory, file)
  if (!existsSync(path)) throw new Error(`Optional original asset missing: ${path}. Restore the preserved original or set STAGELESS_SOURCE_ASSETS to a directory containing the preset subfolder. Normal builds use public/cinema2/models instead.`)
  return path
}
