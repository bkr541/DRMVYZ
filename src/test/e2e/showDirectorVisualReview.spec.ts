import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'


interface VisualReviewPixelMetrics {
  meanLuminance: number
  visibleLuminance: number
  meanSaturation: number
  blackFrameRatio: number
  litPixelRatio: number
  sourceBloomPeakRatio: number
}

interface VisualReviewFrame {
  key: string
  canvasId: string
  presetId: string
  frameId: string
  compiledBeamCount: number
  pixelMetrics: VisualReviewPixelMetrics
}

interface VisualReviewReport {
  ready: boolean
  frames: VisualReviewFrame[]
}

declare global {
  interface Window {
    __SHOW_DIRECTOR_VISUAL_REVIEW__?: VisualReviewReport
  }
}

const enabled = process.env.DRMVYZ_SHOW_DIRECTOR_VISUAL_REVIEW === '1'
const outputRoot = path.resolve(process.cwd(), 'artifacts/show-director-visual-review')

test.describe('Show Director rendered visual review', () => {
  test.skip(!enabled, 'Run with npm run visual:show-director')

  test('captures all representative frames and writes deterministic pixel metrics', async ({ page }) => {
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>
      :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#05070b;color:#e9faff}*{box-sizing:border-box}body{margin:0;padding:20px;background:#05070b}h1{margin:0 0 6px;font-size:22px}p{margin:0 0 18px;color:#99a9b8;font-size:13px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(470px,1fr));gap:16px}article{border:1px solid #1b2b37;border-radius:10px;padding:10px;background:#080d13}header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px}h2{margin:0;font-size:13px;font-weight:650}code{color:#7eeeff;font-size:10px}canvas{display:block;width:100%;height:auto;background:#000;border-radius:6px}
    </style></head><body><h1>Show Director Final Visual Validation</h1><p>Deterministic 120 BPM test track, seed 0x5a17cafe, Canvas2D Beam Matrix renderer.</p><main id="review-grid"></main></body></html>`)
    await page.addScriptTag({ path: path.join(outputRoot, '.runtime/showDirectorVisualReview.bundle.js') })
    await page.waitForFunction(() => document.documentElement.dataset.visualReviewReady === 'true')
    const report = await page.evaluate<VisualReviewReport | undefined>(() => window.__SHOW_DIRECTOR_VISUAL_REVIEW__)
    expect(report?.ready).toBe(true)
    expect(report?.frames).toHaveLength(30)
    await mkdir(outputRoot, { recursive: true })

    for (const frame of report!.frames) {
      expect(frame.compiledBeamCount).toBeGreaterThan(0)
      expect(frame.compiledBeamCount).toBeLessThanOrEqual(300)
      const sparseFrame = ['intro', 'breakdown', 'outro'].includes(frame.frameId)
      expect(frame.pixelMetrics.blackFrameRatio, frame.key).toBeLessThan(sparseFrame ? 0.9999 : 0.9997)
      expect(frame.pixelMetrics.litPixelRatio, frame.key).toBeGreaterThan(sparseFrame ? 0.00008 : 0.0002)
      expect(frame.pixelMetrics.sourceBloomPeakRatio, frame.key).toBeLessThan(0.08)
      const directory = path.join(outputRoot, frame.presetId)
      await mkdir(directory, { recursive: true })
      await page.locator(`#${frame.canvasId}`).screenshot({ path: path.join(directory, `${frame.frameId}.png`) })
    }

    await writeFile(
      path.join(outputRoot, 'report.json'),
      `${JSON.stringify({ generatedBy: 'npm run visual:show-director', ...report }, null, 2)}\n`,
      'utf8',
    )

    const byKey = new Map(report!.frames.map(frame => [frame.key, frame]))
    for (const presetId of ['prism-cathedral', 'cardinal-fan-reactor', 'cyan-mirror-cage']) {
      const verse = byKey.get(`${presetId}/verse`)!
      const dropOne = byKey.get(`${presetId}/drop-1-body`)!
      const breakdown = byKey.get(`${presetId}/breakdown`)!
      const dropTwo = byKey.get(`${presetId}/drop-2-body`)!
      expect(dropOne.compiledBeamCount).toBeGreaterThan(verse.compiledBeamCount)
      const brighterFrame = dropOne.pixelMetrics.meanLuminance > verse.pixelMetrics.meanLuminance * 0.9
      const brighterRays = dropOne.pixelMetrics.visibleLuminance > verse.pixelMetrics.visibleLuminance * 0.72
      expect(brighterFrame || brighterRays, presetId).toBe(true)
      expect(breakdown.compiledBeamCount).toBeLessThan(dropOne.compiledBeamCount)
      expect(dropTwo.compiledBeamCount).toBeGreaterThan(dropOne.compiledBeamCount)
      expect(dropOne.pixelMetrics.meanSaturation).toBeGreaterThan(0.12)
    }
  })
})
