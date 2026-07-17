import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface WebGLVisualFrame {
  key: string
  scenario: string
  canvasId: string
  presetId: string
  frameId: string
  section: string
  presentationMode: string
  requestedRenderer: string
  diagnostics: {
    hdrMode: string
    diagnosticCode: string
    renderWidth: number
    renderHeight: number
    atmosphereWidth: number
    atmosphereHeight: number
    atmosphereSampleCount: number
    activeBeamCount: number
    requestedBeamCount: number
    activeFixtureCount: number
    bloomLevels: number
    contextLossCount: number
    laserHistoryInputCount: number
    laserHistorySliceCount: number
    laserInputMode: 'scanner-samples' | 'legacy-only' | 'mixed'
    scannerExposureSampleCount: number
    scannerSegmentCount: number
    suppressedLegacyBeamCount: number
    duplicateLaserInputCount: number
    depthMode: string
    depthSliceCount: number
    depthBufferStatus: string
  }
  pixelMetrics: {
    deterministicReplayChecked: boolean
    meanLuminance: number
    meanSaturation: number
    blackFrameRatio: number
    litPixelRatio: number
    connectedLitPixelRatio: number
    isolatedLitPixelRatio: number
    highlightPixelRatio: number
    washedBrightPixelRatio: number
    leftRightDifference: number
    deterministicMeanAbsoluteDifference: number
    fingerprint: string
  }
  activeFixtureKinds: string[]
  overlayElementCount: number
  qualityMetrics: {
    requestedBeamCount: number
    selectedBeamCount: number
    requestedMaxSourceRayCount: number
    selectedMaxSourceRayCount: number
    requestedHeroRayCount: number
    selectedHeroRayCount: number
    requestedSupportRayCount: number
    selectedSupportRayCount: number
    requestedTextureRayCount: number
    selectedTextureRayCount: number
    selectedLeftRayCount: number
    selectedRightRayCount: number
  }
}

interface WebGLVisualReport {
  ready: boolean
  status: 'pass' | 'unsupported' | 'failure'
  reason: string | null
  capability: {
    available: boolean
    vendor: string | null
    renderer: string | null
    version: string | null
    shadingLanguageVersion: string | null
    maxTextureSize: number | null
  }
  rendererHost: string
  frames: WebGLVisualFrame[]
  recovery: {
    automaticCooldownValidated: boolean
    manualRetryClearedFailure: boolean
    permanentFallbackValidated: boolean
    contextLossExtensionSupported: boolean
    contextLossObserved: boolean
    contextRestoreObserved: boolean
    postRestoreRenderSucceeded: boolean
    supportedSkipReason: string | null
  } | null
}

declare global {
  interface Window {
    __SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__?: WebGLVisualReport
  }
}

const enabled = process.env.DRMVYZ_SHOW_DIRECTOR_WEBGL_VISUAL === '1'
const allowUnsupportedSkip = process.env.DRMVYZ_ALLOW_WEBGL_VISUAL_SKIP === '1'
const outputRoot = path.resolve(process.cwd(), 'artifacts/show-director-webgl-visual-review')

test.describe('LaserDMX actual WebGL2 visual regression', () => {
  test.skip(!enabled, 'Run with npm run visual:show-director:webgl')

  test('renders deterministic production WebGL pixels with diagnostics and clean Capture output', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>
      :root{color-scheme:dark;background:#05070b;color:#e9faff;font-family:Inter,system-ui,sans-serif}body{margin:0;padding:16px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}article{padding:8px;background:#080d13;border:1px solid #1b2b37;border-radius:8px}h2{font-size:12px;margin:0 0 6px}canvas{display:block;width:100%;height:auto;background:#000}
    </style></head><body><h1>LaserDMX WebGL2 Visual Regression</h1><main id="review-grid"></main></body></html>`)
    await page.addScriptTag({ path: path.join(outputRoot, '.runtime/showDirectorWebGLVisualReview.bundle.js') })
    await page.waitForFunction(() => document.documentElement.dataset.webglVisualReviewReady === 'true', null, { timeout: 150_000 })
    const report = await page.evaluate(() => window.__SHOW_DIRECTOR_WEBGL_VISUAL_REVIEW__)
    expect(report?.ready).toBe(true)
    await mkdir(outputRoot, { recursive: true })
    await writeFile(path.join(outputRoot, 'capability.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    if (report?.status === 'unsupported') {
      test.skip(allowUnsupportedSkip, `WebGL2 unsupported: ${report.reason ?? 'unknown reason'}`)
      throw new Error(`WebGL2 visual regression could not run: ${report.reason ?? 'unknown reason'}`)
    }
    expect(report?.status, report?.reason ?? undefined).toBe('pass')
    expect(report?.rendererHost).toBe('production-laser-dmx-webgl-runtime')
    expect(report?.capability.available).toBe(true)
    expect(report?.capability.version).toContain('WebGL 2')
    expect(report?.frames).toHaveLength(26)

    const fingerprints = new Set<string>()
    for (const frame of report!.frames) {
      expect(frame.requestedRenderer, frame.key).toBe('webgl')
      expect(frame.presentationMode, frame.key).toBe('capture')
      expect(frame.overlayElementCount, frame.key).toBe(0)
      expect(frame.diagnostics.renderWidth, frame.key).toBeGreaterThan(0)
      expect(frame.diagnostics.renderHeight, frame.key).toBeGreaterThan(0)
      expect(frame.diagnostics.atmosphereWidth, frame.key).toBeGreaterThan(0)
      expect(frame.diagnostics.atmosphereHeight, frame.key).toBeGreaterThan(0)
      expect(frame.diagnostics.activeFixtureCount, frame.key).toBeGreaterThan(0)
      expect(frame.diagnostics.contextLossCount, frame.key).toBe(0)
      expect(frame.diagnostics.bloomLevels, frame.key).toBeGreaterThan(0)
      expect(frame.diagnostics.depthSliceCount, frame.key).toBeGreaterThanOrEqual(2)
      expect(frame.diagnostics.laserHistorySliceCount, frame.key).toBeLessThanOrEqual(frame.diagnostics.depthSliceCount)
      expect(frame.diagnostics.duplicateLaserInputCount, frame.key).toBe(0)
      expect(['scanner-samples', 'legacy-only', 'mixed'], frame.key).toContain(frame.diagnostics.laserInputMode)
      if (frame.activeFixtureKinds.includes('laser') && frame.diagnostics.scannerExposureSampleCount > 0) {
        expect(frame.diagnostics.laserInputMode, frame.key).not.toBe('legacy-only')
        expect(frame.diagnostics.scannerSegmentCount, frame.key).toBeGreaterThan(0)
        expect(frame.diagnostics.suppressedLegacyBeamCount, frame.key).toBeGreaterThan(0)
      }
      expect(['continuous-slices', 'binary-fallback'], frame.key).toContain(frame.diagnostics.depthMode)
      expect(frame.pixelMetrics.blackFrameRatio, frame.key).toBeGreaterThan(0.35)
      const requiresVisibleLight = frame.diagnostics.activeBeamCount > 0
        || frame.activeFixtureKinds.some(kind => ['movingHead', 'parWash', 'strobe', 'blinder', 'ledBar', 'ledTube'].includes(kind))
      if (requiresVisibleLight) {
        expect(frame.pixelMetrics.blackFrameRatio, frame.key).toBeLessThan(0.99995)
        expect(frame.pixelMetrics.litPixelRatio, frame.key).toBeGreaterThan(0.00075)
        expect(frame.pixelMetrics.connectedLitPixelRatio, frame.key).toBeGreaterThan(0.65)
        expect(frame.pixelMetrics.isolatedLitPixelRatio, frame.key).toBeLessThan(0.25)
      }
      expect(frame.pixelMetrics.meanLuminance, frame.key).toBeLessThan(0.42)
      expect(frame.pixelMetrics.highlightPixelRatio, frame.key).toBeLessThan(0.22)
      expect(frame.pixelMetrics.washedBrightPixelRatio, frame.key).toBeLessThan(0.16)
      if (frame.pixelMetrics.deterministicReplayChecked) {
        expect(frame.pixelMetrics.deterministicMeanAbsoluteDifference, frame.key).toBeLessThan(0.02)
      }
      fingerprints.add(frame.pixelMetrics.fingerprint)
      const directory = path.join(outputRoot, frame.presetId)
      await mkdir(directory, { recursive: true })
      await page.locator(`#${frame.canvasId}`).screenshot({ path: path.join(directory, `${frame.frameId}-${frame.scenario}.png`) })
    }
    expect(fingerprints.size).toBeGreaterThanOrEqual(9)
    expect(report!.frames.filter(frame => frame.pixelMetrics.deterministicReplayChecked)).toHaveLength(3)

    const requiredScenarios = [
      'depth-crossing',
      'foreground-haze-veil',
      'co2-partial-attenuation',
      'laser-only-history',
      'moving-head-gobo',
      'moving-head-prism',
      'led-pixel-chase',
      'video-wall-emissive',
      'strobe-blinder-distinction',
      'high-hero-fan',
      'ultra-hero-fan',
      'budget-hero-preservation',
      'auto-support-degradation',
      'high-mirror-corridor',
    ]
    for (const scenario of requiredScenarios) {
      expect(report!.frames.some(frame => frame.scenario === scenario), `Missing ${scenario} regression state`).toBe(true)
    }
    const laserHistory = report!.frames.find(frame => frame.scenario === 'laser-only-history')!
    expect(laserHistory.diagnostics.laserHistoryInputCount).toBeGreaterThan(0)
    expect(laserHistory.diagnostics.laserHistorySliceCount).toBeGreaterThan(0)
    const videoWall = report!.frames.find(frame => frame.scenario === 'video-wall-emissive')!
    expect(videoWall.activeFixtureKinds).toContain('videoWall')

    const highHero = report!.frames.find(frame => frame.scenario === 'high-hero-fan')!
    expect(highHero.qualityMetrics.requestedMaxSourceRayCount).toBeGreaterThanOrEqual(16)
    expect(highHero.qualityMetrics.selectedMaxSourceRayCount).toBeGreaterThanOrEqual(16)
    const ultraHero = report!.frames.find(frame => frame.scenario === 'ultra-hero-fan')!
    expect(ultraHero.qualityMetrics.requestedMaxSourceRayCount).toBeGreaterThanOrEqual(20)
    expect(ultraHero.qualityMetrics.selectedMaxSourceRayCount).toBeGreaterThanOrEqual(20)

    const budget = report!.frames.find(frame => frame.scenario === 'budget-hero-preservation')!
    expect(budget.qualityMetrics.requestedBeamCount).toBeGreaterThan(300)
    expect(budget.qualityMetrics.selectedBeamCount).toBeLessThanOrEqual(300)
    expect(budget.qualityMetrics.selectedBeamCount).toBeLessThan(budget.qualityMetrics.requestedBeamCount)
    expect(budget.qualityMetrics.selectedHeroRayCount).toBe(budget.qualityMetrics.requestedHeroRayCount)
    expect(budget.qualityMetrics.selectedTextureRayCount).toBeLessThan(budget.qualityMetrics.requestedTextureRayCount)

    const auto = report!.frames.find(frame => frame.scenario === 'auto-support-degradation')!
    expect(auto.qualityMetrics.requestedBeamCount).toBeGreaterThan(auto.qualityMetrics.selectedBeamCount)
    expect(auto.qualityMetrics.selectedHeroRayCount).toBe(auto.qualityMetrics.requestedHeroRayCount)
    expect(auto.qualityMetrics.selectedTextureRayCount).toBeLessThan(auto.qualityMetrics.requestedTextureRayCount)
    expect(auto.qualityMetrics.selectedSupportRayCount).toBeLessThanOrEqual(auto.qualityMetrics.requestedSupportRayCount)

    expect(report!.recovery?.automaticCooldownValidated).toBe(true)
    expect(report!.recovery?.manualRetryClearedFailure).toBe(true)
    expect(report!.recovery?.permanentFallbackValidated).toBe(true)
    if (report!.recovery?.contextLossExtensionSupported) {
      expect(report!.recovery.contextLossObserved).toBe(true)
      expect(report!.recovery.contextRestoreObserved).toBe(true)
      expect(report!.recovery.postRestoreRenderSucceeded).toBe(true)
    } else {
      expect(report!.recovery?.supportedSkipReason).toBeTruthy()
    }

    const mirror = report!.frames.find(frame => frame.key === 'cyan-mirror-cage/drop-1-body')!
    expect(mirror.pixelMetrics.leftRightDifference).toBeLessThan(0.3)
    const highMirror = report!.frames.find(frame => frame.scenario === 'high-mirror-corridor')!
    expect(highMirror.qualityMetrics.selectedMaxSourceRayCount).toBeGreaterThanOrEqual(12)
    expect(Math.abs(highMirror.qualityMetrics.selectedLeftRayCount - highMirror.qualityMetrics.selectedRightRayCount)).toBeLessThanOrEqual(2)
    expect(highMirror.pixelMetrics.leftRightDifference).toBeLessThan(0.6)

    const hazeCo2 = report!.frames.find(frame => frame.key === 'haze-co2-drops-performance/drop-2-impact')!
    expect(hazeCo2.activeFixtureKinds).toEqual(expect.arrayContaining(['haze', 'co2Jet']))
    expect(hazeCo2.diagnostics.atmosphereSampleCount).toBeGreaterThan(0)
    expect(hazeCo2.pixelMetrics.blackFrameRatio).toBeGreaterThan(0.95)
    expect(hazeCo2.pixelMetrics.blackFrameRatio).toBeLessThan(1)
    expect(hazeCo2.pixelMetrics.litPixelRatio).toBeGreaterThan(0)

    const fixtureKinds = new Set(report!.frames.flatMap(frame => frame.activeFixtureKinds))
    for (const kind of ['laser', 'movingHead', 'strobe', 'blinder', 'haze', 'co2Jet', 'ledBar']) {
      expect(fixtureKinds.has(kind), `Missing representative ${kind} fixture`).toBe(true)
    }

    await writeFile(
      path.join(outputRoot, 'report.json'),
      `${JSON.stringify({ generatedBy: 'npm run visual:show-director:webgl', ...report }, null, 2)}\n`,
      'utf8',
    )
  })
})
