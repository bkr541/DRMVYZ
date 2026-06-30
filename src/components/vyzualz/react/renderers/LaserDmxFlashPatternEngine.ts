import {
  normalizeProductionChase,
  normalizeProductionFlashPattern,
  normalizeProductionVisualComfort,
  type ProductionChaseOrder,
  type ProductionChaseSettings,
  type ProductionFlashPatternSettings,
  type ProductionFlashQuantize,
  type ProductionFlashRetriggerPolicy,
  type ProductionLedBarPattern,
  type ProductionVisualComfortSettings,
} from '../LaserDmxProductionRig'

const EPSILON = 1e-6

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function fract(value: number): number {
  return ((value % 1) + 1) % 1
}

function hash01(seed: number, index: number): number {
  let value = (Math.imul(seed | 0, 374761393) + Math.imul(index | 0, 668265263)) | 0
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function ease(value: number, curve: ProductionFlashPatternSettings['envelope']['curve']): number {
  const t = clamp01(value)
  if (curve === 'easeIn') return t * t
  if (curve === 'easeOut') return 1 - (1 - t) * (1 - t)
  if (curve === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  return t
}

function beatDurationSec(bpm: number): number {
  return 60 / Math.max(1, Number.isFinite(bpm) ? bpm : 120)
}

function quantizeStepBeats(quantize: ProductionFlashQuantize): number {
  if (quantize === 'sixteenth') return 0.25
  if (quantize === 'eighth') return 0.5
  if (quantize === 'beat') return 1
  if (quantize === 'bar') return 4
  return 0
}

export function quantizeProductionFlashTime(
  timeSec: number,
  bpm: number,
  quantize: ProductionFlashQuantize,
): number {
  const stepBeats = quantizeStepBeats(quantize)
  if (stepBeats <= 0) return Math.max(0, timeSec)
  const stepSec = beatDurationSec(bpm) * stepBeats
  return Math.ceil(Math.max(0, timeSec) / stepSec - EPSILON) * stepSec
}

export function resolveProductionFlashRetrigger(
  settingsInput: unknown,
  previousTriggerTimeSec: number | null,
  requestTimeSec: number,
  activeUntilSec: number,
  bpm: number,
): number | null {
  const settings = normalizeProductionFlashPattern(settingsInput)
  const policy: ProductionFlashRetriggerPolicy = settings.retriggerPolicy
  if (policy === 'ignoreWhileActive' && previousTriggerTimeSec !== null && requestTimeSec < activeUntilSec) {
    return null
  }
  if (policy === 'queueNextQuantized') {
    return quantizeProductionFlashTime(Math.max(requestTimeSec, activeUntilSec), bpm, settings.quantize)
  }
  return quantizeProductionFlashTime(requestTimeSec, bpm, settings.quantize)
}

export interface ProductionFlashEvaluationInput {
  settings: unknown
  timeSec: number
  bpm: number
  fixtureIndex?: number
  fixtureCount?: number
  comfort?: unknown
}

export interface ProductionFlashEvaluation {
  active: boolean
  visible: boolean
  intensity: number
  whiteAccent: boolean
  blackout: boolean
  comfortLimited: boolean
  requestedHz: number
  effectiveHz: number
  warning: boolean
  repeatIndex: number
}

function envelopeLevel(phase: number, settings: ProductionFlashPatternSettings): number {
  const attack = settings.envelope.attack
  const hold = settings.envelope.hold
  const release = settings.envelope.release
  const sum = Math.max(EPSILON, attack + hold + release)
  const a = attack / sum
  const h = hold / sum
  if (a > 0 && phase < a) return ease(phase / a, settings.envelope.curve)
  if (phase < a + h) return 1
  const releasePhase = (phase - a - h) / Math.max(EPSILON, 1 - a - h)
  return 1 - ease(releasePhase, settings.envelope.curve)
}

function pulseAt(localSec: number, pulseStartSec: number, pulseDurationSec: number, settings: ProductionFlashPatternSettings): number {
  if (localSec < pulseStartSec || localSec >= pulseStartSec + pulseDurationSec) return 0
  const phase = (localSec - pulseStartSec) / Math.max(EPSILON, pulseDurationSec)
  return envelopeLevel(phase, settings)
}

function orderedDistance(index: number, count: number, centerOut: boolean): number {
  const center = (Math.max(1, count) - 1) / 2
  const distance = Math.abs(index - center)
  return centerOut ? distance : Math.max(0, center - distance)
}

function patternRequestedHz(settings: ProductionFlashPatternSettings, beatSec: number): number {
  if (settings.pattern === 'singleHit' || settings.pattern === 'fullStageWhiteout' || settings.pattern === 'flashThenBlackout') return 1 / Math.max(beatSec * settings.durationBeats, EPSILON)
  if (settings.pattern === 'doubleHit') return 2 / Math.max(beatSec * settings.durationBeats, EPSILON)
  if (settings.pattern === 'tripleHit') return 3 / Math.max(beatSec * settings.durationBeats, EPSILON)
  if (settings.pattern === 'quarterBeatBurst') return 4 / beatSec
  if (settings.pattern === 'eighthNoteBurst') return 2 / beatSec
  return settings.rateHz
}

export function evaluateProductionFlashPattern(input: ProductionFlashEvaluationInput): ProductionFlashEvaluation {
  const settings = normalizeProductionFlashPattern(input.settings)
  const comfort: ProductionVisualComfortSettings = normalizeProductionVisualComfort(input.comfort)
  const inactive: ProductionFlashEvaluation = {
    active: false,
    visible: false,
    intensity: 0,
    whiteAccent: false,
    blackout: false,
    comfortLimited: false,
    requestedHz: 0,
    effectiveHz: 0,
    warning: false,
    repeatIndex: 0,
  }
  if (!settings.enabled || comfort.disableStrobe) return inactive

  const beatSec = beatDurationSec(input.bpm)
  const startSec = quantizeProductionFlashTime(settings.triggerTimeSec, input.bpm, settings.quantize)
  const eventDurationSec = Math.max(beatSec / 16, settings.durationBeats * beatSec)
  const repeatIntervalSec = Math.max(eventDurationSec, settings.repeat.intervalBeats * beatSec)
  const elapsed = input.timeSec - startSec
  if (elapsed < 0) return inactive

  const repeatIndex = Math.floor(elapsed / repeatIntervalSec)
  if (settings.repeat.mode === 'once' && repeatIndex > 0) return inactive
  if (settings.repeat.mode === 'count' && repeatIndex >= settings.repeat.count) return inactive
  const localSec = elapsed - repeatIndex * repeatIntervalSec
  if (localSec >= eventDurationSec) return { ...inactive, repeatIndex }

  const requestedHz = patternRequestedHz(settings, beatSec)
  const effectiveHz = Math.min(requestedHz, comfort.maxFlashHz)
  const comfortLimited = effectiveHz + EPSILON < requestedHz
  const warning = requestedHz >= comfort.warningThresholdHz
  const continuousPattern = settings.pattern === 'sustainedStrobe' || settings.pattern === 'rampUpBuildStrobe' || settings.pattern === 'randomizedFlicker'
  if (continuousPattern && comfort.maxContinuousFlashSec > 0) {
    const comfortWindow = comfort.maxContinuousFlashSec + 1
    if ((elapsed % comfortWindow) >= comfort.maxContinuousFlashSec) {
      return { ...inactive, requestedHz, effectiveHz, comfortLimited: true, warning, repeatIndex }
    }
  }

  const fixtureIndex = Math.max(0, Math.round(input.fixtureIndex ?? 0))
  const fixtureCount = Math.max(1, Math.round(input.fixtureCount ?? 1))
  let level = 0
  let blackout = false

  const pulseDurationForHz = 1 / Math.max(0.1, effectiveHz)
  const onDuration = Math.max(1 / 240, pulseDurationForHz * settings.dutyCycle)
  const eventPhase = clamp01(localSec / eventDurationSec)

  switch (settings.pattern) {
    case 'singleHit':
      level = pulseAt(localSec, 0, Math.min(eventDurationSec, Math.max(beatSec * 0.12, onDuration)), settings)
      break
    case 'doubleHit':
      level = Math.max(
        pulseAt(localSec, 0, Math.min(beatSec * 0.12, onDuration), settings),
        pulseAt(localSec, beatSec * 0.22, Math.min(beatSec * 0.12, onDuration), settings),
      )
      break
    case 'tripleHit':
      level = Math.max(
        pulseAt(localSec, 0, Math.min(beatSec * 0.1, onDuration), settings),
        pulseAt(localSec, beatSec * 0.17, Math.min(beatSec * 0.1, onDuration), settings),
        pulseAt(localSec, beatSec * 0.34, Math.min(beatSec * 0.1, onDuration), settings),
      )
      break
    case 'quarterBeatBurst':
    case 'eighthNoteBurst': {
      const subdivisionBeats = settings.pattern === 'quarterBeatBurst' ? 0.25 : 0.5
      const stepSec = subdivisionBeats * beatSec
      const pulsePhase = fract(localSec / stepSec)
      level = pulsePhase < settings.dutyCycle ? envelopeLevel(pulsePhase / settings.dutyCycle, settings) : 0
      break
    }
    case 'rampUpBuildStrobe': {
      const rampHz = Math.min(comfort.maxFlashHz, Math.max(1, 2 + eventPhase * Math.max(0, settings.rateHz - 2)))
      const cycle = fract(localSec * rampHz)
      level = cycle < settings.dutyCycle ? envelopeLevel(cycle / settings.dutyCycle, settings) : 0
      break
    }
    case 'alternatingLeftRight': {
      const step = Math.floor(localSec / Math.max(beatSec * 0.5, pulseDurationForHz))
      const side = fixtureIndex < fixtureCount / 2 ? 0 : 1
      if (side === step % 2) {
        const cycle = fract(localSec * effectiveHz)
        level = cycle < settings.dutyCycle ? envelopeLevel(cycle / settings.dutyCycle, settings) : 0
      }
      break
    }
    case 'centerOutFlash': {
      const distance = orderedDistance(fixtureIndex, fixtureCount, true)
      const maxDistance = Math.max(1, Math.ceil(fixtureCount / 2) - 1)
      const delay = distance / maxDistance * eventDurationSec * 0.7
      level = pulseAt(localSec, delay, Math.max(beatSec * 0.1, onDuration), settings)
      break
    }
    case 'randomizedFlicker': {
      const cell = Math.floor(localSec * effectiveHz)
      const random = hash01(settings.seed + fixtureIndex * 101, cell)
      level = random < settings.dutyCycle ? 0.35 + random * 0.65 : 0
      break
    }
    case 'fullStageWhiteout':
      level = envelopeLevel(eventPhase, settings)
      break
    case 'flashThenBlackout':
      level = pulseAt(localSec, 0, Math.min(eventDurationSec * 0.2, Math.max(beatSec * 0.1, onDuration)), settings)
      blackout = localSec >= eventDurationSec * 0.2
      break
    case 'sustainedStrobe':
    default: {
      const cycle = fract(localSec * effectiveHz)
      level = cycle < settings.dutyCycle ? envelopeLevel(cycle / settings.dutyCycle, settings) : 0
      break
    }
  }

  level = clamp01(level * settings.intensity)
  return {
    active: true,
    visible: level > 0.001 && !blackout,
    intensity: level,
    whiteAccent: settings.whiteAccent && level > 0.001,
    blackout,
    comfortLimited,
    requestedHz,
    effectiveHz,
    warning,
    repeatIndex,
  }
}

function deterministicShuffle(count: number, seed: number): number[] {
  const result = Array.from({ length: count }, (_, index) => index)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(hash01(seed, index) * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export function buildProductionChaseOrder(count: number, order: ProductionChaseOrder, seed = 1): number[] {
  const safeCount = Math.max(0, Math.round(count))
  const forward = Array.from({ length: safeCount }, (_, index) => index)
  if (order === 'reverse') return forward.reverse()
  if (order === 'alternate') return [...forward.filter(index => index % 2 === 0), ...forward.filter(index => index % 2 === 1)]
  if (order === 'randomized') return deterministicShuffle(safeCount, seed)
  if (order === 'centerOut') return forward.sort((a, b) => orderedDistance(a, safeCount, true) - orderedDistance(b, safeCount, true) || a - b)
  if (order === 'outsideIn') return forward.sort((a, b) => orderedDistance(a, safeCount, false) - orderedDistance(b, safeCount, false) || a - b)
  return forward
}

export function evaluateProductionChase(
  settingsInput: unknown,
  itemIndex: number,
  itemCount: number,
  timeSec: number,
  bpm: number,
): number {
  const settings: ProductionChaseSettings = normalizeProductionChase(settingsInput)
  if (!settings.enabled || itemCount <= 1) return 1
  const order = buildProductionChaseOrder(itemCount, settings.order, settings.seed)
  const orderPosition = order.indexOf(Math.max(0, Math.min(itemCount - 1, itemIndex)))
  if (orderPosition < 0) return 0
  const stepSec = beatDurationSec(bpm) * settings.stepBeats
  const head = Math.floor(Math.max(0, timeSec) / Math.max(EPSILON, stepSec)) % itemCount
  for (let offset = 0; offset < Math.min(itemCount, settings.width); offset += 1) {
    if ((head - offset + itemCount) % itemCount === orderPosition) return 1 - offset / Math.max(1, settings.width)
  }
  return 0
}

export interface LedSegmentFrameInput {
  count: number
  pattern: ProductionLedBarPattern
  primary: [number, number, number]
  secondary: [number, number, number]
  chase: unknown
  timeSec: number
  bpm: number
  seed: number
}

export function evaluateLedSegmentFrame(input: LedSegmentFrameInput): { colors: Array<[number, number, number]>; intensities: number[] } {
  const count = Math.max(1, Math.min(32, Math.round(input.count)))
  const colors: Array<[number, number, number]> = []
  const intensities: number[] = []
  for (let index = 0; index < count; index += 1) {
    const mix = count <= 1 ? 0 : index / (count - 1)
    const gradient: [number, number, number] = [
      Math.round(input.primary[0] + (input.secondary[0] - input.primary[0]) * mix),
      Math.round(input.primary[1] + (input.secondary[1] - input.primary[1]) * mix),
      Math.round(input.primary[2] + (input.secondary[2] - input.primary[2]) * mix),
    ]
    if (input.pattern === 'alternating') colors.push(index % 2 === 0 ? input.primary : input.secondary)
    else if (input.pattern === 'gradient') colors.push(gradient)
    else colors.push(input.primary)

    if (input.pattern === 'chase') intensities.push(evaluateProductionChase(input.chase, index, count, input.timeSec, input.bpm))
    else if (input.pattern === 'sparkle') {
      const cell = Math.floor(input.timeSec * 12)
      intensities.push(hash01(input.seed + index * 17, cell) > 0.72 ? 1 : 0.2)
    } else intensities.push(1)
  }
  return { colors, intensities }
}
