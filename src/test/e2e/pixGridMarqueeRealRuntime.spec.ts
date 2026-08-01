import { expect, test, type Browser, type Page } from '@playwright/test'

const enabled = process.env.DRMVYZ_PIX_GRID_MARQUEE_REAL_BROWSER === '1'
const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const INTRO_SCENE_ID = `${PRESET_ID}-intro`
const VERSE_SCENE_ID = `${PRESET_ID}-verse`
const DROP_SCENE_ID = `${PRESET_ID}-drop`
const OUTRO_SCENE_ID = `${PRESET_ID}-outro`
// The deterministic 120 BPM fixture reaches the first Drop sign boundary here.
const DROP_INTERMEDIATE_TRANSITION_TIME_SEC = 55.02
// At 120 BPM, 8.5s maps to preview bar 4.25, the middle of Drop's first sign transition.
const SELECTED_DROP_PREVIEW_TRANSITION_TIME_SEC = 8.5

interface RuntimeReadback {
  ready: boolean
  audioTimeSec: number
  audioLevel: number
  activeReactEngineId: string
  activeReactPresetId: string | null
  selectedPresetId: string | null
  selectedSceneId: string | null
  previewMode: string
  selectedLayerId: string | null
  quality: string
  qualityMode: string
  performanceEnabled: boolean
  runtimeFrame: {
    rendererPath: 'webgl2' | 'canvas2d-fallback'
    logicalWidth: number
    logicalHeight: number
    sceneId: string | null
    audioTimeSec: number
    sectionType: string | null
    autoPerformanceEnabled: boolean
    signFrameIndex: number | null
    previousSignFrameIndex: number | null
    signTransitionType: string | null
    signTransitionProgress: number
    authoredAnimationPhase: number
    authoredBulbStates: Array<{ layerId: string; opacity: number; frameIndex: number }>
    visibleComponentIds: string[]
    activeCellCount: number
    pixelHash: string
  } | null
  performance: {
    active: boolean
    programId: string | null
    sceneId: string | null
    activeSectionPlanId: string | null
    activeContinuousRoutes: string[]
    activeEventRoutes: string[]
  }
  reactivity: {
    rendererPath: string | null
    logicalWidth: number | null
    logicalHeight: number | null
    activeAssignmentCount: number
    activeContinuousAssignments: string[]
    activeDiscreteAssignments: string[]
    activeProgramContinuousRoutes: string[]
    activeProgramEventRoutes: string[]
  }
  sharedPerformance: {
    active: boolean
    performanceShow: string | null
    scene: string | null
    section: string
    continuousRoutes: string[]
    runtimeIdentity: string
  } | null
}

interface BrowserSnapshotProbe {
  ready: boolean
  audioTimeSec: number
  audioLevel: number
  activeReactEngineId: string
  activeReactPresetId: string | null
  selectedPresetId: string | null
  selectedSceneId: string | null
  previewMode: string
  selectedLayerId: string | null
  quality: string
  qualityMode: string
  performanceEnabled: boolean
  runtimeFrame: RuntimeReadback['runtimeFrame']
  performance: RuntimeReadback['performance']
  reactivity: {
    runtime: {
      activeAssignmentCount: number
      activeContinuousAssignments: string[]
      activeDiscreteAssignments: string[]
      activeProgramContinuousRoutes: string[]
      activeProgramEventRoutes: string[]
    } | null
    renderer: { path: string; logicalWidth: number; logicalHeight: number } | null
  }
  sharedPerformance: RuntimeReadback['sharedPerformance']
}

type MarqueeBrowserWindow = Window & {
  __PIXGRID_MARQUEE_REAL_BROWSER__?: BrowserSnapshotProbe
  __setPixGridMarqueeTime?: (timeSec: number) => void
  __setPixGridMarqueeAudioLevel?: (level: number) => void
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function setToggle(page: Page, label: string, value: boolean) {
  const toggle = page.getByRole('button', { name: label, exact: true })
  await expect(toggle).toBeVisible()
  const current = await toggle.getAttribute('aria-pressed')
  if (current !== String(value)) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', String(value))
}

async function selectPixGridEngine(page: Page) {
  await page.getByRole('button', { name: /Selected React engine:/ }).click()
  await page.getByRole('option').filter({ hasText: /^PixGrid/ }).click()
  await page.waitForFunction(() => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.activeReactEngineId === 'pixGrid')
}

async function readRuntime(page: Page): Promise<RuntimeReadback> {
  return page.evaluate(() => {
    const snapshot = (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__
    if (!snapshot) throw new Error('PixGrid Marquee real browser snapshot is unavailable.')
    const diagnostics = snapshot.reactivity.runtime
    const renderer = snapshot.reactivity.renderer
    return {
      ready: snapshot.ready,
      audioTimeSec: snapshot.audioTimeSec,
      audioLevel: snapshot.audioLevel,
      activeReactEngineId: snapshot.activeReactEngineId,
      activeReactPresetId: snapshot.activeReactPresetId,
      selectedPresetId: snapshot.selectedPresetId,
      selectedSceneId: snapshot.selectedSceneId,
      previewMode: snapshot.previewMode,
      selectedLayerId: snapshot.selectedLayerId,
      quality: snapshot.quality,
      qualityMode: snapshot.qualityMode,
      performanceEnabled: snapshot.performanceEnabled,
      runtimeFrame: snapshot.runtimeFrame ? {
        ...snapshot.runtimeFrame,
        authoredBulbStates: snapshot.runtimeFrame.authoredBulbStates.map(state => ({ ...state })),
        visibleComponentIds: [...snapshot.runtimeFrame.visibleComponentIds],
      } : null,
      performance: {
        active: snapshot.performance.active,
        programId: snapshot.performance.programId,
        sceneId: snapshot.performance.sceneId,
        activeSectionPlanId: snapshot.performance.activeSectionPlanId,
        activeContinuousRoutes: [...snapshot.performance.activeContinuousRoutes],
        activeEventRoutes: [...snapshot.performance.activeEventRoutes],
      },
      reactivity: {
        rendererPath: renderer?.path ?? null,
        logicalWidth: renderer?.logicalWidth ?? null,
        logicalHeight: renderer?.logicalHeight ?? null,
        activeAssignmentCount: diagnostics?.activeAssignmentCount ?? 0,
        activeContinuousAssignments: [...(diagnostics?.activeContinuousAssignments ?? [])],
        activeDiscreteAssignments: [...(diagnostics?.activeDiscreteAssignments ?? [])],
        activeProgramContinuousRoutes: [...(diagnostics?.activeProgramContinuousRoutes ?? [])],
        activeProgramEventRoutes: [...(diagnostics?.activeProgramEventRoutes ?? [])],
      },
      sharedPerformance: snapshot.sharedPerformance ? {
        active: snapshot.sharedPerformance.active,
        performanceShow: snapshot.sharedPerformance.performanceShow,
        scene: snapshot.sharedPerformance.scene,
        section: snapshot.sharedPerformance.section,
        continuousRoutes: [...snapshot.sharedPerformance.continuousRoutes],
        runtimeIdentity: snapshot.sharedPerformance.runtimeIdentity,
      } : null,
    }
  })
}

async function waitForRuntimeTime(page: Page, timeSec: number) {
  await page.waitForFunction(expected => {
    const frame = (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame
    return frame != null && Math.abs(frame.audioTimeSec - expected) < 0.0001
  }, timeSec)
}

async function setMusicalTime(page: Page, timeSec: number) {
  await page.evaluate(time => (window as MarqueeBrowserWindow).__setPixGridMarqueeTime?.(time), timeSec)
  await waitForRuntimeTime(page, timeSec)
}

async function setAudioLevel(page: Page, level: number) {
  await page.evaluate(value => (window as MarqueeBrowserWindow).__setPixGridMarqueeAudioLevel?.(value), level)
  await page.waitForFunction(expected => Math.abs(((window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.audioLevel ?? -1) - expected) < 0.0001, level)
}

async function prepareProductionRuntime(page: Page, openEditingContext = true) {
  await page.goto('/')
  await page.waitForSelector('[aria-label^="Selected React engine:"]')
  await selectPixGridEngine(page)
  await choose(page, 'PixGrid Preset', 'Marquee Sign Cycle')
  await setToggle(page, 'Adaptive Quality', false)
  await choose(page, 'Fixed Quality', 'High · 160 × 90')
  await setToggle(page, 'Auto Performance', true)
  if (openEditingContext) {
    const editingToggle = page.getByRole('button', { name: 'Editing Context', exact: true })
    await editingToggle.click()
    await expect(editingToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('region', { name: 'Editing Context panel' })).toBeVisible()
  }
  await page.waitForFunction(() => document.documentElement.dataset.pixGridMarqueeRealReady === 'true')
  await expect(page.locator('.rv-pix-grid-surface-host')).toHaveAttribute('data-pix-grid-runtime-matrix', '160x90')
}

async function createCanvasFallbackPage(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
        return Reflect.apply(nativeGetContext, this, [type, ...args])
      },
    })
  })
  return { page: await context.newPage(), close: () => context.close() }
}

test.describe('Marquee Sign Cycle real production browser acceptance', () => {
  test.skip(!enabled, 'Run with npm run test:e2e:pix-grid-marquee-real')

  test('drives real store ownership, authored motion, transitions, WebGL when available, and Canvas parity', async ({ page, browser }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await prepareProductionRuntime(page)

    const webglAvailable = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))
    const expectedPrimaryRenderer = webglAvailable ? 'webgl2' : 'canvas2d-fallback'

    const initial = await readRuntime(page)
    expect(initial).toMatchObject({
      ready: true,
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: PRESET_ID,
      selectedPresetId: PRESET_ID,
      quality: 'high',
      qualityMode: 'fixed',
      performanceEnabled: true,
    })
    expect(initial.runtimeFrame).toMatchObject({
      rendererPath: expectedPrimaryRenderer,
      logicalWidth: 160,
      logicalHeight: 90,
      autoPerformanceEnabled: true,
    })
    expect(initial.reactivity).toMatchObject({ rendererPath: expectedPrimaryRenderer, logicalWidth: 160, logicalHeight: 90 })
    if (!webglAvailable) {
      test.info().annotations.push({
        type: 'renderer',
        description: 'WebGL2 is unavailable in this browser; the production Canvas fallback path is validated.',
      })
    }

    await choose(page, 'Active Scene', 'Intro')
    await page.waitForFunction(sceneId => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame?.sceneId === sceneId, INTRO_SCENE_ID)
    const intro = await readRuntime(page)
    expect(intro.previewMode).toBe('selectedScene')
    expect(intro.runtimeFrame?.sceneId).toBe(INTRO_SCENE_ID)
    expect(intro.performance).toMatchObject({ active: true, programId: 'pix-grid-neon-marquee-performance', activeSectionPlanId: 'marquee-intro' })
    expect(intro.sharedPerformance).toMatchObject({ active: true, scene: INTRO_SCENE_ID, section: 'intro' })

    await choose(page, 'Active Scene', 'Drop')
    await page.waitForFunction(sceneId => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame?.sceneId === sceneId, DROP_SCENE_ID)
    const drop = await readRuntime(page)
    expect(drop.previewMode).toBe('selectedScene')
    expect(drop.runtimeFrame?.sceneId).toBe(DROP_SCENE_ID)
    expect(drop.performance).toMatchObject({ active: true, programId: 'pix-grid-neon-marquee-performance', activeSectionPlanId: 'marquee-drop' })
    expect(drop.sharedPerformance).toMatchObject({ active: true, scene: DROP_SCENE_ID, section: 'drop' })
    expect(drop.runtimeFrame!.activeCellCount).toBeGreaterThan(intro.runtimeFrame!.activeCellCount)
    expect(drop.runtimeFrame!.pixelHash).not.toBe(intro.runtimeFrame!.pixelHash)

    await setMusicalTime(page, SELECTED_DROP_PREVIEW_TRANSITION_TIME_SEC)
    const selectedDropTransition = await readRuntime(page)
    expect(selectedDropTransition.previewMode).toBe('selectedScene')
    expect(selectedDropTransition.runtimeFrame?.sceneId).toBe(DROP_SCENE_ID)
    expect(selectedDropTransition.runtimeFrame?.signTransitionType).not.toBe('cut')
    expect(selectedDropTransition.runtimeFrame?.previousSignFrameIndex).toBe(0)
    expect(selectedDropTransition.runtimeFrame?.signFrameIndex).toBe(1)
    expect(selectedDropTransition.runtimeFrame!.signTransitionProgress).toBeGreaterThan(0)
    expect(selectedDropTransition.runtimeFrame!.signTransitionProgress).toBeLessThan(1)

    await choose(page, 'Edit Target', 'Perimeter Bulbs A')
    await expect(page.getByRole('tab', { name: 'Layer', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('region', { name: 'Editing Context panel' }).locator('.rv-ctrl-info strong')).toHaveText('Perimeter Bulbs A')
    await expect(page.getByRole('slider', { name: 'Opacity', exact: true })).toBeVisible()
    await expect(page.getByTestId('selected-layer-highlight')).toHaveText('Perimeter Bulbs A')
    expect((await readRuntime(page)).selectedLayerId).toBe('marquee-bulbs-a')
    await expect(page.getByTestId('pix-grid-semantic-target-overlay')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit PixGrid', exact: true }).first().click()
    await expect(page.getByTestId('pix-grid-editor-overlay')).toBeVisible()
    expect((await readRuntime(page)).selectedLayerId).toBe('marquee-bulbs-a')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByTestId('pix-grid-editor-overlay')).toHaveCount(0)
    await expect(page.getByTestId('pix-grid-semantic-target-overlay')).toHaveCount(0)
    expect((await readRuntime(page)).selectedLayerId).toBe('marquee-bulbs-a')

    await choose(page, 'Edit Target', 'Scene Pixels')
    await expect(page.getByRole('tab', { name: 'Scene', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('selected-layer-highlight')).toHaveCount(0)
    expect((await readRuntime(page)).selectedLayerId).toBeNull()

    await choose(page, 'Active Scene', 'Verse')
    await page.waitForFunction(sceneId => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame?.sceneId === sceneId, VERSE_SCENE_ID)
    const selectedVerseHashes = new Map<number, string>()
    for (const timeSec of [4, 20, 72, 88, 100, 120, 145]) {
      await setMusicalTime(page, timeSec)
      const selectedVerse = await readRuntime(page)
      expect(selectedVerse.previewMode).toBe('selectedScene')
      expect(selectedVerse.runtimeFrame).toMatchObject({
        sceneId: VERSE_SCENE_ID,
        sectionType: 'verse',
        logicalWidth: 160,
        logicalHeight: 90,
      })
      expect(selectedVerse.runtimeFrame!.activeCellCount).toBeGreaterThan(8_000)
      selectedVerseHashes.set(timeSec, selectedVerse.runtimeFrame!.pixelHash)
    }

    await setMusicalTime(page, 12)
    await setMusicalTime(page, 145)
    const repeatedOutroSeek = await readRuntime(page)
    expect(repeatedOutroSeek.runtimeFrame?.sceneId).toBe(VERSE_SCENE_ID)
    expect(repeatedOutroSeek.runtimeFrame?.sectionType).toBe('verse')
    expect(repeatedOutroSeek.runtimeFrame?.pixelHash).toBe(selectedVerseHashes.get(145))
    expect(repeatedOutroSeek.runtimeFrame!.activeCellCount).toBeGreaterThan(8_000)

    await page.reload()
    await page.waitForSelector('[aria-label^="Selected React engine:"]')
    await page.waitForFunction(() => document.documentElement.dataset.pixGridMarqueeRealReady === 'true')
    const reloadedSelectedVerse = await readRuntime(page)
    expect(reloadedSelectedVerse).toMatchObject({
      activeReactEngineId: 'pixGrid',
      selectedPresetId: PRESET_ID,
      selectedSceneId: VERSE_SCENE_ID,
      previewMode: 'selectedScene',
    })
    expect(reloadedSelectedVerse.runtimeFrame?.sceneId).toBe(VERSE_SCENE_ID)
    expect(reloadedSelectedVerse.runtimeFrame!.activeCellCount).toBeGreaterThan(8_000)

    for (const [label, presetId] of [
      ['Bass Beacon', 'pix-grid-bass-beacon'],
      ['Geometric Reactor', 'pix-grid-geometric-reactor'],
      ['Pixel Parade', 'pix-grid-pixel-parade'],
    ] as const) {
      await choose(page, 'PixGrid Preset', label)
      await page.waitForFunction(id => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.selectedPresetId === id, presetId)
    }
    await choose(page, 'PixGrid Preset', 'Marquee Sign Cycle')
    await page.waitForFunction(id => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.selectedPresetId === id, PRESET_ID)
    await choose(page, 'Active Scene', 'Verse')

    await setMusicalTime(page, 145)
    await choose(page, 'Active Scene', 'Follow Track')
    await page.waitForFunction(sceneId => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame?.sceneId === sceneId, OUTRO_SCENE_ID)
    const followedOutro = await readRuntime(page)
    expect(followedOutro.previewMode).toBe('followTrack')
    expect(followedOutro.runtimeFrame?.sceneId).toBe(OUTRO_SCENE_ID)
    expect(followedOutro.runtimeFrame?.sectionType).toBe('outro')
    expect(followedOutro.performance.activeSectionPlanId).toBe('marquee-outro')

    await setMusicalTime(page, 20)
    await page.waitForFunction(sceneId => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame?.sceneId === sceneId, VERSE_SCENE_ID)
    const followedVerse = await readRuntime(page)
    expect(followedVerse.previewMode).toBe('followTrack')
    expect(followedVerse.runtimeFrame?.sceneId).toBe(VERSE_SCENE_ID)
    expect(followedVerse.runtimeFrame?.sectionType).toBe('verse')
    expect(followedVerse.performance.activeSectionPlanId).toBe('marquee-verse')
    expect(followedVerse.sharedPerformance).toMatchObject({ scene: VERSE_SCENE_ID, section: 'verse' })

    await setMusicalTime(page, 34.8)
    const motionA = await readRuntime(page)
    await setMusicalTime(page, 34.9)
    const motionB = await readRuntime(page)
    expect(motionA.runtimeFrame?.sceneId).toBe(DROP_SCENE_ID)
    expect(motionB.runtimeFrame?.sceneId).toBe(DROP_SCENE_ID)
    expect(motionB.runtimeFrame?.signFrameIndex).toBe(motionA.runtimeFrame?.signFrameIndex)
    expect(motionB.runtimeFrame?.authoredAnimationPhase).not.toBe(motionA.runtimeFrame?.authoredAnimationPhase)
    expect(motionB.runtimeFrame?.authoredBulbStates).not.toEqual(motionA.runtimeFrame?.authoredBulbStates)
    expect(motionB.runtimeFrame?.authoredBulbStates.find(state => state.layerId === 'marquee-bulbs-a')?.opacity)
      .not.toBe(motionA.runtimeFrame?.authoredBulbStates.find(state => state.layerId === 'marquee-bulbs-a')?.opacity)
    expect(motionB.runtimeFrame?.pixelHash).not.toBe(motionA.runtimeFrame?.pixelHash)

    await setMusicalTime(page, DROP_INTERMEDIATE_TRANSITION_TIME_SEC)
    const transition = await readRuntime(page)
    expect(transition.runtimeFrame?.sceneId).toBe(DROP_SCENE_ID)
    expect(transition.runtimeFrame?.signTransitionType).not.toBe('cut')
    expect(transition.runtimeFrame!.signTransitionProgress).toBeGreaterThan(0)
    expect(transition.runtimeFrame!.signTransitionProgress).toBeLessThan(1)
    expect(transition.runtimeFrame?.previousSignFrameIndex).not.toBe(transition.runtimeFrame?.signFrameIndex)

    await setAudioLevel(page, 1)
    await setMusicalTime(page, 41.25)
    const autoOn = await readRuntime(page)
    expect(autoOn.runtimeFrame?.autoPerformanceEnabled).toBe(true)
    expect(autoOn.performance.active).toBe(true)
    expect(autoOn.reactivity.activeAssignmentCount).toBeGreaterThan(0)
    expect(autoOn.reactivity.activeProgramContinuousRoutes.length + autoOn.reactivity.activeProgramEventRoutes.length).toBeGreaterThan(0)

    await setToggle(page, 'Auto Performance', false)
    await page.waitForFunction(() => (window as MarqueeBrowserWindow).__PIXGRID_MARQUEE_REAL_BROWSER__?.runtimeFrame?.autoPerformanceEnabled === false)
    const autoOffA = await readRuntime(page)
    expect(autoOffA.performanceEnabled).toBe(false)
    expect(autoOffA.runtimeFrame?.autoPerformanceEnabled).toBe(false)
    expect(autoOffA.performance.active).toBe(false)
    expect(autoOffA.reactivity.activeProgramContinuousRoutes).toHaveLength(0)
    expect(autoOffA.reactivity.activeProgramEventRoutes).toHaveLength(0)
    expect(autoOffA.reactivity.activeAssignmentCount).toBeLessThan(autoOn.reactivity.activeAssignmentCount)
    expect(autoOffA.runtimeFrame?.pixelHash).not.toBe(autoOn.runtimeFrame?.pixelHash)

    await setMusicalTime(page, 41.375)
    const autoOffB = await readRuntime(page)
    expect(autoOffB.runtimeFrame?.signFrameIndex).toBe(autoOffA.runtimeFrame?.signFrameIndex)
    expect(autoOffB.runtimeFrame?.sceneId).toBe(autoOffA.runtimeFrame?.sceneId)
    expect(autoOffB.runtimeFrame?.authoredAnimationPhase).not.toBe(autoOffA.runtimeFrame?.authoredAnimationPhase)
    expect(autoOffB.runtimeFrame?.authoredBulbStates).not.toEqual(autoOffA.runtimeFrame?.authoredBulbStates)
    expect(autoOffB.runtimeFrame?.authoredBulbStates.find(state => state.layerId === 'marquee-bulbs-a')?.opacity)
      .not.toBe(autoOffA.runtimeFrame?.authoredBulbStates.find(state => state.layerId === 'marquee-bulbs-a')?.opacity)
    expect(autoOffB.runtimeFrame?.pixelHash).not.toBe(autoOffA.runtimeFrame?.pixelHash)

    await setToggle(page, 'Auto Performance', true)
    await setMusicalTime(page, DROP_INTERMEDIATE_TRANSITION_TIME_SEC)
    const primaryParityFrame = await readRuntime(page)
    expect(primaryParityFrame.runtimeFrame?.rendererPath).toBe(expectedPrimaryRenderer)

    const fallback = await createCanvasFallbackPage(browser)
    try {
      await prepareProductionRuntime(fallback.page, false)
      await setMusicalTime(fallback.page, DROP_INTERMEDIATE_TRANSITION_TIME_SEC)
      const canvasParityFrame = await readRuntime(fallback.page)
      expect(canvasParityFrame.runtimeFrame).toMatchObject({
        rendererPath: 'canvas2d-fallback',
        logicalWidth: 160,
        logicalHeight: 90,
        sceneId: primaryParityFrame.runtimeFrame?.sceneId,
        signFrameIndex: primaryParityFrame.runtimeFrame?.signFrameIndex,
        previousSignFrameIndex: primaryParityFrame.runtimeFrame?.previousSignFrameIndex,
        signTransitionType: primaryParityFrame.runtimeFrame?.signTransitionType,
      })
      expect(canvasParityFrame.runtimeFrame?.signTransitionProgress)
        .toBeCloseTo(primaryParityFrame.runtimeFrame!.signTransitionProgress, 6)
      expect(canvasParityFrame.runtimeFrame?.authoredAnimationPhase)
        .toBeCloseTo(primaryParityFrame.runtimeFrame!.authoredAnimationPhase, 6)
      expect(canvasParityFrame.runtimeFrame?.authoredBulbStates)
        .toEqual(primaryParityFrame.runtimeFrame?.authoredBulbStates)
      expect(canvasParityFrame.runtimeFrame?.visibleComponentIds)
        .toEqual(primaryParityFrame.runtimeFrame?.visibleComponentIds)
      expect(canvasParityFrame.runtimeFrame?.activeCellCount)
        .toBe(primaryParityFrame.runtimeFrame?.activeCellCount)
      await expect(fallback.page.locator('.rv-pix-grid-surface-host'))
        .toHaveAttribute('data-pix-grid-renderer', 'canvas2d-fallback')
    } finally {
      await fallback.close()
    }
  })
})
