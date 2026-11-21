/**
 * Allow-list for the old-brand guard (noOldBrand.test.ts).
 * See docs/stageless-rename.md sections 3 and 6.
 */

/** Files never scanned. */
export const IGNORED_PATH_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /(^|\/)__tests__\//, reason: 'test files may assert historical identifiers' },
  { pattern: /\.(test|spec)\.[cm]?[tj]sx?$/, reason: 'test files' },
  { pattern: /(^|\/)__fixtures__\//, reason: 'test fixtures mirror the UI strings they cover' },
  { pattern: /^native\/system\/userDataMigration\.cjs$/, reason: 'must name the legacy folders it migrates' },
  { pattern: /^scripts\/electron-dev-processes\.mjs$/, reason: 'must still recognise legacy DRMVYZ app bundles' },
  { pattern: /^src\/test\//, reason: 'test harness pages and fixtures' },
  { pattern: /^src\/lib\/lyricsSeed\.ts$/, reason: 'seed lyric documents are user data (owner decision)' },
]

/** Text removed from a line before scanning. */
export const IGNORED_LINE_TEXT: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /DRMVYZ starter texture: /g, reason: 'runtime three.js texture tag used to find starter textures; not shown to users' },
  { pattern: /DRMVYZ Anton/g, reason: 'internal CSS font-family name' },
  { pattern: /urn:x-cast:com\.dvydrm\.drmvyz\.live/g, reason: 'Google Cast namespace' },
  { pattern: /com\.drmvyz\.receiver/g, reason: 'Android applicationId/namespace' },
  { pattern: /"name":\s*"drmvyz"/g, reason: 'npm package name' },
]

/**
 * Each `drmvyz` occurrence is expanded to its identifier-like token. The
 * match is allowed when one of these patterns matches the whole token.
 */
export const ALLOWED_TOKEN_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /^x-drmvyz-[\w-]+$/, reason: 'internal drag/MIME and data-attribute names' },
  { pattern: /^drmvyz[.:][\w.:-]*$/i, reason: 'preset ids / storage keys / drmvyz:* IPC channels' },
  { pattern: /^preset-drmvyz-[\w-]+$/, reason: 'preset ids stored in pads/favorites' },
  { pattern: /^drmvyz-(?!performance|capture|frame)[\w-]+$/, reason: 'internal storage/db/format/cache keys; user-facing download names are not allowed' },
  { pattern: /^drmvyz$/, reason: 'stored analysis-source value (data, not text) - exact lowercase token only' },
  { pattern: /^_drmvyz[A-Z]\w*$/, reason: 'persisted record field names' },
  { pattern: /^preset-nl-drmvyz-[\w-]+$/, reason: 'preset ids' },
  { pattern: /^[\w$]*DRMVYZ_[\w$]*$/, reason: 'SCREAMING_CASE code identifiers' },
  { pattern: /^drmvyz-(app|receiver|mobile-preview|mobile-app-preview)(-[\w-]*)?$/, reason: 'protocol / internal window keys' },
  { pattern: /^drmvyz-(diag|preview|rb-user-data|electron)(-[\w-]*)?$/, reason: 'internal temp/cache prefixes' },
  { pattern: /^_drmvyz-cast$/, reason: 'mDNS service type (receiver contract)' },
  { pattern: /^(__)?DRMVYZ_[A-Z0-9_]+$/, reason: 'constants, env vars, discovery magic, test hooks' },
  { pattern: /^X-DRMVYZ-[\w-]+$/i, reason: 'receiver contract headers' },
  { pattern: /^drmvyz_receiver_v2_contract\.json$/, reason: 'receiver contract file' },
  { pattern: /^drmvyz_logo(2|_icon)$/, reason: 'logo file names are kept; artwork is replaced' },
  { pattern: /^[\w$]*Drmvyz[\w$]*$/, reason: 'CamelCase code identifiers' },
  { pattern: /^drmvyz[A-Z][\w$]*$/, reason: 'camelCase code identifiers / module file names' },
]
