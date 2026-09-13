import { describe, expect, it } from 'vitest'
import { Cinema2RandomService } from '../runtime/Cinema2RandomService'

function deterministic(seed: string | number) {
  return new Cinema2RandomService({
    presetId: 'drmvyz.cinema2.random-test',
    revision: 7,
    stateKey: '{"values":{"gain":0.75}}',
    mode: 'deterministic',
    seed,
  })
}

describe('Cinema2RandomService', () => {
  it('reproduces deterministic samples and stream sequences for the same preset state and seed', () => {
    const first = deterministic('replay-seed')
    const second = deterministic('replay-seed')
    const namespace = { moduleId: 'storm', eventId: 'beat:42', purpose: 'variant-selection' }

    expect(first.sample(namespace)).toBe(second.sample(namespace))
    expect(first.sample(namespace, 4)).toBe(second.sample(namespace, 4))

    const firstStream = first.stream(namespace)
    const secondStream = second.stream(namespace)
    expect([firstStream.next(), firstStream.next(), firstStream.next()])
      .toEqual([secondStream.next(), secondStream.next(), secondStream.next()])
  })

  it('keeps sibling namespaces independent when one consumer advances its local stream', () => {
    const service = deterministic(1337)
    const untouched = service.stream({ moduleId: 'laser-left', eventId: 'drop:8', purpose: 'geometry' })
    const noisy = service.stream({ moduleId: 'laser-right', eventId: 'drop:8', purpose: 'geometry' })
    const reference = deterministic(1337).stream({ moduleId: 'laser-left', eventId: 'drop:8', purpose: 'geometry' })

    noisy.next()
    noisy.next()
    noisy.next()

    expect([untouched.next(), untouched.next()]).toEqual([reference.next(), reference.next()])
  })

  it('derives stable event choices from event identity and purpose', () => {
    const service = deterministic('event-seed')
    const eventA = { moduleId: 'choreography', eventId: 'kick:120:4', purpose: 'rule-a:probability' }
    const eventB = { ...eventA, eventId: 'kick:120:5' }

    expect(service.sample(eventA)).toBe(service.sample(eventA))
    expect(service.sample(eventA)).not.toBe(service.sample(eventB))
    expect(service.probability(eventA, 0.5)).toBe(deterministic('event-seed').probability(eventA, 0.5))
    expect(service.probability(eventA, 0)).toBe(false)
    expect(service.probability(eventA, 1)).toBe(true)
  })

  it('varies session-organic activations while remaining coherent inside each activation', () => {
    let activation = 0
    const create = () => new Cinema2RandomService({
      presetId: 'drmvyz.cinema2.random-test',
      revision: 7,
      stateKey: '{}',
      mode: 'session-organic',
      seed: 'show-seed',
      activationEntropy: () => `activation-${++activation}`,
    })
    const first = create()
    const second = create()
    const namespace = { moduleId: 'reactor', eventId: 'phrase:3', purpose: 'accent' }

    expect(first.sample(namespace)).toBe(first.sample(namespace))
    expect(second.sample(namespace)).toBe(second.sample(namespace))
    expect(first.getSnapshot().activationKey).not.toBe(second.getSnapshot().activationKey)
    expect(first.sample(namespace)).not.toBe(second.sample(namespace))
  })
})
