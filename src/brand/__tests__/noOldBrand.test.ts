// @vitest-environment node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALLOWED_TOKEN_PATTERNS,
  IGNORED_LINE_TEXT,
  IGNORED_PATH_PATTERNS,
} from './noOldBrandAllowList'
import { PENDING_FILES } from './noOldBrandPending'

/**
 * Guard for the DRMVYZ -> STAGELESS rename (docs/stageless-rename.md).
 * DVYDRM is the owner's DJ name and is intentionally NOT checked.
 *
 * Ratchet: files in PENDING_FILES still contain old-brand text and are
 * tolerated until their phase lands. A pending file with no hits fails, so the
 * list must shrink as work completes. The goal is an empty PENDING_FILES.
 */

const root = process.cwd()
const SCAN_ROOTS = [
  'src', 'electron', 'native', 'index.html', 'package.json', 'README.md', 'THIRD_PARTY_NOTICES.md',
  'public/cinema2/attributions.json', 'android-tv-receiver/app/src/main/res/values/strings.xml',
  'supabase/functions', 'scripts/run-electron-dev.mjs', 'scripts/electron-dev-processes.mjs',
]
const SCAN_EXT = /\.(ts|tsx|css|html|cjs|mjs|json|xml)$|^[^/]+\.md$/
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|<!--|#)/

function collect(rel: string, out: string[]): void {
  const abs = path.join(root, rel)
  let stat
  try { stat = statSync(abs) } catch { return }
  if (stat.isDirectory()) {
    for (const name of readdirSync(abs)) {
      if (name === 'node_modules' || name === 'build' || name === 'dist' || name.startsWith('.')) continue
      collect(`${rel}/${name}`, out)
    }
  } else if (SCAN_EXT.test(rel)) out.push(rel)
}

function tokenAround(line: string, index: number): string {
  let s = index
  let e = index + 6
  while (s > 0 && /[\w-]/.test(line[s - 1])) s--
  while (e < line.length && /[\w-]/.test(line[e])) e++
  // `drmvyz.cinema2.x`, `drmvyz:appearance:...` style keys continue past . and :
  if (line.slice(s, e) === 'drmvyz' && /[.:]/.test(line[e] ?? '')) {
    while (e < line.length && /[\w.:-]/.test(line[e])) e++
  }
  return line.slice(s, e).replace(/[.:-]+$/, '')
}

export function findOldBrandHits(file: string, text: string): string[] {
  const hits: string[] = []
  let inBlock = false
  text.split('\n').forEach((raw, i) => {
    const wasInBlock = inBlock
    // Only a block comment that STARTS a line counts (globs like "src/**/*.ts" in strings must not).
    if (/^\s*\/\*/.test(raw) && !raw.includes('*/')) inBlock = true
    else if (wasInBlock && raw.includes('*/')) inBlock = false
    if (wasInBlock || COMMENT_LINE.test(raw)) return
    let line = raw
    for (const { pattern } of IGNORED_LINE_TEXT) line = line.replace(pattern, '')
    const re = /drmvyz/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      const token = tokenAround(line, m.index)
      if (!ALLOWED_TOKEN_PATTERNS.some(({ pattern }) => pattern.test(token))) hits.push(`${file}:${i + 1}: ${token}`)
    }
    if (/\bVYZUALZ\b/.test(line)) hits.push(`${file}:${i + 1}: VYZUALZ`)
  })
  return hits
}

describe('old brand guard', () => {
  const files: string[] = []
  for (const r of SCAN_ROOTS) collect(r, files)
  const byFile = new Map<string, string[]>()
  for (const file of files) {
    if (IGNORED_PATH_PATTERNS.some(({ pattern }) => pattern.test(file))) continue
    const hits = findOldBrandHits(file, readFileSync(path.join(root, file), 'utf8'))
    if (hits.length) byFile.set(file, hits)
  }

  // BRAND_GUARD_DUMP=/path npx vitest run src/brand  -> writes files that still have hits
  if (process.env.BRAND_GUARD_DUMP) writeFileSync(process.env.BRAND_GUARD_DUMP, [...byFile.keys()].sort().join('\n'))

  it('finds no old brand text outside the pending list', () => {
    const offenders = [...byFile].filter(([f]) => !PENDING_FILES.includes(f)).flatMap(([, h]) => h)
    expect(offenders).toEqual([])
  })

  it('keeps the pending list free of already-clean files', () => {
    expect(PENDING_FILES.filter((f) => !byFile.has(f))).toEqual([])
  })

  it('recognises technical identifiers and flags visible text', () => {
    expect(findOldBrandHits('x.ts', "const id = 'drmvyz.cinema2.foo'")).toEqual([])
    expect(findOldBrandHits('x.ts', 'window.drmvyzNative; DrmvyzReceiverProvider; DRMVYZ_RECEIVER_PROTOCOL_VERSION')).toEqual([])
    expect(findOldBrandHits('x.ts', "<h2>Make DRMVYZ feel like your booth</h2>")).toHaveLength(1)
    expect(findOldBrandHits('x.ts', 'a.download = `drmvyz-frame-1.png`')).toHaveLength(1)
    expect(findOldBrandHits('x.ts', "const t = 'Welcome to VYZUALZ'")).toHaveLength(1)
    expect(findOldBrandHits('x.ts', '// DRMVYZ comment')).toEqual([])
    expect(findOldBrandHits('x.ts', "DVYDRM wordmark")).toEqual([])
  })
})
