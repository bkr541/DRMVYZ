import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { isForbiddenRepositoryPath } from './repository-hygiene.mjs'

export const root = resolve(import.meta.dirname, '..')
export const policy = JSON.parse(readFileSync(resolve(root, 'assets/repository-asset-policy.json'), 'utf8'))
export const binary = /\.(?:glb|gltf|bin|blend|fbx|obj|png|jpe?g|webp|gif|svg|avif|bmp|ico|icns|mp[34]|webm|mov|wav|flac|ogg|hdr|exr|ktx2?|otf|ttf|woff2?|wasm|task|onnx|tflite|gz|zip|7z|pdf)$/i
const source = /\.(?:tsx?|jsx?|[cm]js|[cm]ts|css|scss|html|md|json|sql|ya?ml|toml|xml|plist|gradle|kts|kt|java|swift|c|h|cpp|hpp|py|sh|command|glsl|vert|frag|wgsl|txt|lock)$/i
const allowedNewRoot = /^(?:src|public|electron|native|scripts|assets|docs|supabase|android-tv-receiver|build|\.github)\//
const allowedRootName = /^(?:README\.md|AGENTS\.md|package(?:-lock)?\.json|(?:vite|vitest[^/]*|playwright|eslint)\.config\.[a-z]+|tsconfig(?:\.[^/]+)?\.json|\.gitignore|\.gitattributes|\.env\.example)$/
export function gitPaths(cwd, args) {
  return execFileSync('git', args, { cwd, maxBuffer: 32 * 1024 * 1024 }).toString('utf8').split('\0').filter(Boolean)
}
export function privateOrGenerated(path) {
  return isForbiddenRepositoryPath(path) || /^(?:output|release)\//.test(path) || /(?:^|\/)(?:\.git|\.asset-sources|\.development|\.review-notes|user-media|user-recordings|user-screenshots|\.secrets|\.ssh|\.aws|\.gradle|\.playwright)(?:\/|$)/i.test(path)
    || /(?:^|\/)(?:local\.properties|\.envrc|(?:credentials|secrets|service[-_]?account|access[-_]?token|private[-_]?key)(?:[.-][^/]+)?|id_(?:rsa|ed25519)(?:\.pub)?)$/i.test(path)
    || /\.(?:pem|key|p12|pfx|jks|keystore|zip|dmg|exe|msi|appimage)$/i.test(path)
}
export function classify(path) {
  if (privateOrGenerated(path)) return 'private/generated'
  if (path.startsWith('asset-sources/')) return 'preserved original'
  if (path.startsWith('docs/') && binary.test(path)) return 'documentation binary'
  if (path.startsWith('Sound Drawing/') && binary.test(path)) return 'educational asset'
  if (path.startsWith('scripts/cinema2-assets/sources/') && binary.test(path)) return 'build/test source'
  if (path.startsWith('public/') && binary.test(path)) return 'runtime binary'
  if (path.startsWith('src/test/') && binary.test(path)) return 'test fixture'
  if (binary.test(path)) return 'other binary'
  return 'source/documentation'
}
export function inventory(cwd = root, { includeNew = true } = {}) {
  const tracked = new Set(gitPaths(cwd, ['ls-files', '-z', '--cached']))
  const extras = includeNew ? gitPaths(cwd, ['ls-files', '-z', '--others', '--exclude-standard']) : []
  const result = []
  for (const path of [...new Set([...tracked, ...extras])].sort()) {
    // Git paths are repository relative. Never follow a symlink, including parent directories.
    if (path.split('/').some(part => part === '..' || part === '' || part.includes('\\'))) throw new Error(`Unsafe Git path: ${path}`)
    let info
    try {
      const pieces = path.split('/')
      for (let n = 1; n <= pieces.length; n++) {
        info = lstatSync(resolve(cwd, ...pieces.slice(0, n)))
        if (info.isSymbolicLink()) break
      }
    } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    if (!info.isFile() || info.isSymbolicLink()) { result.push({ path, size: 0, category: 'non-regular file', tracked: tracked.has(path), excluded: true }); continue }
    const isTracked = tracked.has(path)
    // Unstaged new binaries and arbitrary root files are deliberately not included.
    const category = classify(path)
    const approvedNew = (allowedNewRoot.test(path) && source.test(path) && !binary.test(path)) || allowedRootName.test(path)
    result.push({ path, size: info.size, category, tracked: isTracked, excluded: !isTracked && !approvedNew })
  }
  return result
}
export function sha256(cwd, path) { return createHash('sha256').update(readFileSync(resolve(cwd, path))).digest('hex') }
export function select(entry, mode = 'standard') {
  if (entry.excluded || entry.category === 'private/generated' || entry.category === 'preserved original') return false
  if (mode !== 'full-assets' && ['documentation binary', 'educational asset'].includes(entry.category)) return false
  if (mode === 'source-only' && binary.test(entry.path) && entry.size >= 256 * 1024) return false
  return true
}
export function assetIssues(entries, cfg = policy) {
  const known = new Set(cfg.retainedLegacyAssets)
  const tracked = entries.filter(e => e.tracked)
  const issues = tracked.filter(e => e.category === 'private/generated' || e.category === 'non-regular file' || (['documentation binary','educational asset','preserved original','build/test source'].includes(e.category) && !known.has(e.path)))
  const total = tracked.reduce((sum,e) => sum+e.size,0)
  return { issues, total, overBudget: total > cfg.repositoryBudgetMiB * 1048576 }
}
export function extension(path) { return extname(path).toLowerCase() || '(none)' }
