import { PixGridDeckCompileCoordinator } from '../../components/vyzualz/react/pixGrid/PixGridDeckCompileCoordinator'
import { PixGridDeckTransitionCoordinator } from '../../components/vyzualz/react/pixGrid/PixGridDeckTransitionCoordinator'
import { PIX_GRID_DECK_GENERATED_MASK_NAMES } from '../../components/vyzualz/react/pixGrid/PixGridDeckCompilerContracts'
import {
  DEFAULT_PIX_GRID_DECK_CONFIGURATION,
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
} from '../../components/vyzualz/react/pixGrid/PixGridDeckDomain'
import { reconstructPixGridDeckTransitionEndpoint } from '../../components/vyzualz/react/pixGrid/PixGridDeckTransitionPlanner'

const output = document.querySelector<HTMLElement>('[data-pix-grid-deck-worker-status]')
const transparentFixtureUrl = new URL('../fixtures/pixGridDeck/transparent.png', import.meta.url).href
const svgFixtureUrl = new URL('../fixtures/pixGridDeck/safe.svg', import.meta.url).href
if (!output) throw new Error('PixGrid Deck worker browser harness is missing its status element.')

function item(index: number): PixGridDeckItemDefinition {
  const svg = index === 1
  return {
    id: `browser-item-${index}`,
    mediaId: `browser-media-${index}`,
    enabled: true,
    order: index,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:browser-fixture-${index}`,
      fileName: svg ? 'safe.svg' : 'transparent.png',
      mimeType: svg ? 'image/svg+xml' : 'image/png',
      width: 2,
      height: 2,
      hasAlpha: true,
      transparentBackground: '#123456',
    },
  }
}

const deck: PixGridDeckDefinition = {
  schemaVersion: 1,
  id: 'browser-worker-deck',
  name: 'Browser Worker Deck',
  revision: 1,
  generatedPresetId: 'pix-grid-deck:browser-worker-deck',
  items: [item(0), item(1)],
  configuration: {
    ...DEFAULT_PIX_GRID_DECK_CONFIGURATION,
    transitionPolicy: { ...DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy },
  },
}

const coordinator = new PixGridDeckCompileCoordinator({
  sourceResolver: async (sourceItem, signal) => {
    const response = await fetch(sourceItem.source.mimeType === 'image/svg+xml' ? svgFixtureUrl : transparentFixtureUrl, { signal })
    if (!response.ok) throw new Error(`Fixture load failed (${response.status}).`)
    return response.blob()
  },
})
const transitionCoordinator = new PixGridDeckTransitionCoordinator()
let transitionStarted = false

transitionCoordinator.subscribe(statuses => {
  const status = statuses.get(deck.id)
  if (!status || !status.ready) return
  const frameSet = coordinator.getPreparedFrameSet(deck.id)
  const plan = transitionCoordinator.getPlan(deck.id, deck.items[0]!.id, deck.items[1]!.id)
  const endpointsValid = Boolean(
    frameSet
    && plan
    && reconstructPixGridDeckTransitionEndpoint(plan, frameSet.frames[0]!.pixels, frameSet.frames[1]!.pixels, 0)
      .every((value, index) => value === frameSet.frames[0]!.pixels[index])
    && reconstructPixGridDeckTransitionEndpoint(plan, frameSet.frames[0]!.pixels, frameSet.frames[1]!.pixels, 1)
      .every((value, index) => value === frameSet.frames[1]!.pixels[index]),
  )
  output.dataset.result = endpointsValid ? 'ready' : 'invalid'
  output.textContent = JSON.stringify({
    status: coordinator.getStatus(deck.id),
    transitionStatus: status,
    frameCount: frameSet?.frames.length ?? 0,
    masks: frameSet ? Object.keys(frameSet.frames[0]!.masks).sort() : [],
    diagnostics: coordinator.getDiagnostics(),
    transitionDiagnostics: transitionCoordinator.getDiagnostics(),
    endpointsValid,
    plan: plan ? {
      mode: plan.mode,
      matchedCount: plan.diagnostics.matchedCount,
      birthCount: plan.diagnostics.birthCount,
      deathCount: plan.diagnostics.deathCount,
      sourceForegroundCount: plan.diagnostics.sourceForegroundCount,
      targetForegroundCount: plan.diagnostics.targetForegroundCount,
    } : null,
  })
})

coordinator.subscribe(statuses => {
  const status = statuses.get(deck.id)
  if (!status) return
  output.dataset.phase = status.phase
  output.dataset.progress = status.progress.toFixed(3)
  if (status.phase === 'failed') {
    output.dataset.result = 'failed'
    output.textContent = JSON.stringify(status)
    return
  }
  if (!status.ready) return
  const frameSet = coordinator.getPreparedFrameSet(deck.id)
  const valid = Boolean(
    frameSet
    && frameSet.width === 16
    && frameSet.height === 9
    && frameSet.frames.length === 2
    && frameSet.frames.every(frame => (
      frame.pixels.byteLength === 16 * 9 * 4
      && PIX_GRID_DECK_GENERATED_MASK_NAMES.every(name => frame.masks[name].byteLength === 16 * 9)
    )),
  )
  if (!valid) {
    output.dataset.result = 'invalid'
    return
  }
  if (!transitionStarted && frameSet) {
    transitionStarted = true
    transitionCoordinator.synchronize([deck], new Map([[deck.id, frameSet]]))
  }
})

coordinator.synchronize([deck], 16, 9)
window.addEventListener('pagehide', () => {
  coordinator.dispose()
  transitionCoordinator.dispose()
}, { once: true })
