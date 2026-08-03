import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const playwrightCli = path.join(root, 'node_modules/@playwright/test/cli.js')
const storageStateInput = process.env.DRMVYZ_E2E_AUTH_STORAGE_STATE

function fail(message) {
  console.error(`[PixGrid Deck authenticated browser] ${message}`)
  process.exit(1)
}

function requireFile(file, hint) {
  if (!existsSync(file)) fail(`${path.relative(root, file)} is missing. ${hint}`)
}

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  fail('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required; production authentication is not bypassed.')
}
if (!storageStateInput) {
  fail('DRMVYZ_E2E_AUTH_STORAGE_STATE must point to a Playwright storage-state file created by an approved test login.')
}
const storageState = path.resolve(root, storageStateInput)
requireFile(storageState, 'Generate it outside source control using the normal Supabase login flow.')
requireFile(playwrightCli, 'Run npm ci before this suite.')

let parsed
try {
  parsed = JSON.parse(readFileSync(storageState, 'utf8'))
} catch (error) {
  fail(`The storage-state file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
}
const hasSupabaseSession = Array.isArray(parsed.origins) && parsed.origins.some(origin => (
  Array.isArray(origin.localStorage)
  && origin.localStorage.some(entry => /^sb-.+-auth-token$/.test(entry.name) && typeof entry.value === 'string' && entry.value.length > 0)
))
if (!hasSupabaseSession) {
  fail('The storage-state file does not contain a Supabase auth session. A login-page state is not accepted.')
}

const env = {
  ...process.env,
  DRMVYZ_PIX_GRID_DECK_AUTHENTICATED_BROWSER: '1',
  DRMVYZ_E2E_AUTH_STORAGE_STATE: storageState,
}

const build = spawnSync('npm', ['run', 'build'], { cwd: root, env, stdio: 'inherit' })
if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1)

const result = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  'src/test/e2e/pixGridDeckAuthenticatedProduction.spec.ts',
  '--project=authenticated-chromium',
], { cwd: root, env, stdio: 'inherit' })

if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
console.log('Authenticated PixGrid Deck production-path acceptance passed.')
