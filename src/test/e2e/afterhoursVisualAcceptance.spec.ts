import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS } from '../../components/vyzualz/react/renderers/cinematic/worlds/AfterhoursVisualAcceptanceHarness'
import type { AfterhoursVisualAcceptanceMetadata } from '../../components/vyzualz/react/renderers/cinematic/worlds/AfterhoursVisualAcceptanceDiagnostics'

interface BrowserReport {
  checkpointId: string
  metadata: AfterhoursVisualAcceptanceMetadata
  graph: { activeNodeCount: number; initializedNodeCount: number; failedNodeCount: number; outputRendered: boolean }
}

type AcceptanceWindow = Window & {
  __DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__?: {
    checkpointIds: readonly string[]
    renderCheckpoint(id: string): Promise<BrowserReport>
    resize(width: number, height: number): void
    getLatest(): BrowserReport | null
  }
}


const enabled = process.env.DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE === '1'
const outputRoot = path.resolve(process.cwd(), 'artifacts/afterhours-visual-acceptance')

test.describe('Afterhours deterministic visual acceptance harness', () => {
  test.skip(!enabled, 'Run with npm run visual:afterhours')

  test('cycles named checkpoints through the real Cinema Afterhours renderer deterministically', async ({ page }) => {
    test.setTimeout(180_000)
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(process.env.DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE_PAGE ?? '/afterhours-visual-acceptance.html')
    const status = page.locator('[data-afterhours-acceptance-status]')
    await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })

    const ids = await page.evaluate(() => (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__?.checkpointIds ?? [])
    expect(ids).toEqual(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS)

    await mkdir(outputRoot, { recursive: true })
    const snapshots = new Map<string, string>()
    const visitOrder = [
      'full-rig', 'static-wide-fan', 'full-blackout', 'beam-8-side-top',
      'diamond-star', 'music-drop-impact', 'music-quiet-sparse', 'mid-motion-wide-sweep',
      'cross-canopy', 'static-split-wings', 'fan-open-close-fixed-phase', 'sparse-architecture',
    ]
    for (const id of visitOrder) {
      const report = await page.evaluate(async checkpointId => {
        const harness = (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__
        if (!harness) throw new Error('Afterhours acceptance harness is unavailable.')
        return harness.renderCheckpoint(checkpointId)
      }, id) as BrowserReport
      expect(report.graph.outputRendered, id).toBe(true)
      expect(report.graph.activeNodeCount, id).toBe(2)
      expect(report.graph.initializedNodeCount, id).toBe(2)
      expect(report.graph.failedNodeCount, id).toBe(0)
      expect(report.metadata.sceneId, id).toBeTruthy()
      expect(report.metadata.activeFixtureIds.length, id).toBeGreaterThanOrEqual(2)
      snapshots.set(id, JSON.stringify(report.metadata))
      const png = await page.locator('[data-afterhours-acceptance-canvas]').screenshot()
      await writeFile(path.join(outputRoot, `${id}.png`), png)
    }

    // Reorder and replay adversarial states to prove no hidden seed/history leaks.
    for (const id of ['full-blackout', 'full-rig', 'static-wide-fan', 'beam-8-side-top', 'full-blackout', 'static-wide-fan']) {
      const report = await page.evaluate(async checkpointId => (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__!.renderCheckpoint(checkpointId), id) as BrowserReport
      expect(JSON.stringify(report.metadata), `${id} changed after reordered replay`).toBe(snapshots.get(id))
    }

    // Resize the real Cinema runtime and prove the logical checkpoint survives resource recreation.
    await page.evaluate(() => (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__!.resize(800, 450))
    const resized = await page.evaluate(async () => (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__!.renderCheckpoint('full-rig')) as BrowserReport
    expect(JSON.stringify(resized.metadata), 'full-rig changed after resize').toBe(snapshots.get('full-rig'))
    await page.evaluate(() => (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__!.resize(960, 540))

    const blackout = JSON.parse(snapshots.get('full-blackout')!) as AfterhoursVisualAcceptanceMetadata
    expect(blackout.blackout.amount).toBe(1)
    expect(blackout.blackout.multiplier).toBe(0)

    const bankEight = JSON.parse(snapshots.get('beam-8-side-top')!) as AfterhoursVisualAcceptanceMetadata
    expect(bankEight.requestedBeamCount).toBe(8)
    expect(bankEight.resolvedBeamCount).toBe(8)
    expect(bankEight.activeFixtureIds).toHaveLength(8)
    expect(bankEight.activeBanks).toEqual(['bottom', 'left', 'right', 'top'])

    const staticFan = JSON.parse(snapshots.get('static-wide-fan')!) as AfterhoursVisualAcceptanceMetadata
    expect(staticFan.sceneId).toBe('wideFan')
    expect(staticFan.motion.authority).toBe(0)

    const movingFan = JSON.parse(snapshots.get('mid-motion-wide-sweep')!) as AfterhoursVisualAcceptanceMetadata
    expect(movingFan.sceneId).toBe('wideFan')
    expect(movingFan.motion.authority).toBeGreaterThan(0)
    expect(movingFan.motion.angularSpanDeg).toBeGreaterThan(0)

    const drop = JSON.parse(snapshots.get('music-drop-impact')!) as AfterhoursVisualAcceptanceMetadata
    expect(drop.cue.sectionType).toBe('drop')
    expect(drop.cue.dropStart).toBe(true)
    expect(drop.cue.kick).toBe(true)
    expect(drop.cue.snare).toBe(true)

    const quiet = JSON.parse(snapshots.get('music-quiet-sparse')!) as AfterhoursVisualAcceptanceMetadata
    expect(quiet.cue.sectionType).toBe('intro')
    expect(quiet.cue.sceneScale).toBe('quiet')
    expect(quiet.cue.densityTier).toBe('sparse')
    expect(quiet.resolvedBeamCount).toBeLessThanOrEqual(quiet.requestedBeamCount)

    // Reload recreates the runtime/director from scratch; the same checkpoint must reconstruct identically.
    await page.reload()
    await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })
    const afterReload = await page.evaluate(async () => (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__!.renderCheckpoint('static-wide-fan')) as BrowserReport
    expect(JSON.stringify(afterReload.metadata), 'static-wide-fan changed after reload').toBe(snapshots.get('static-wide-fan'))

    expect(pageErrors).toEqual([])
  })
})
