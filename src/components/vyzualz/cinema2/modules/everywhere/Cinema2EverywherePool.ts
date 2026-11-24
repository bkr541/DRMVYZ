import { cinema2StableId, type Cinema2MediaSlotId } from '../../contracts/Cinema2NativePresetManifest'
import { Cinema2MediaSlotRuntime, type Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2MediaPoolSource } from '../../media/Cinema2MediaPoolSource'
import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import type { EverywherePattern } from './Cinema2EverywhereWall'

const CHANNELS = [0, 1, 2].map(i => cinema2StableId<Cinema2MediaSlotId>(`everywhere-pool-channel-${i}`))
export const EVERYWHERE_POOL_SLOTS = CHANNELS.map((id, i) => ({ id, label: `Pool Channel ${i+1}`, accepts: ['image', 'video', 'svg'] as const }))
export function everywherePoolTrigger(pattern: EverywherePattern): Cinema2AfterhoursTriggerId {
  switch (pattern) {
    case 'static-switch': return 'beat2'
    case 'retro-broadcast': return 'bar'
    case 'tape-tracking': return 'beat4'
    case 'channel-mosaic': return 'bar'
    case 'signal-relay': return 'beat2'
    case 'midnight-replay': return 'bar4'
    default: return 'bar4'
  }
}

/** Three shared decoders/textures maximum, independent of the number of CRTs.
 * The canonical slot runtime keeps the last good frame during replacement.
 * Pool feeds are not authored media slots and are never serialized. */
export class Cinema2EverywherePool {
  private scope = ''
  private ids: readonly string[] = []
  private generation = 0
  private cursor = 0
  private channel = 0
  private lastEvent: string | null = null
  private pending = new Set<number>()
  private disposed = false
  step = 0
  constructor(private readonly source: Cinema2MediaPoolSource, private readonly slots: Cinema2MediaSlotRuntime) {}

  update(identity: string, event: string | null, reset: boolean, paused: boolean, patternChanged: boolean) {
    if (this.disposed) return
    const selection = this.source.getSelection()
    const ids = [...new Set(selection?.mediaIds ?? [])]
    const scope = JSON.stringify([identity, selection?.id ?? null, ids])
    if (scope !== this.scope || reset) {
      this.scope = scope
      this.ids = ids
      this.generation++
      this.pending.clear()
      this.step = 0; this.channel = 0; this.cursor = Math.min(ids.length, CHANNELS.length)
      this.lastEvent = event
      CHANNELS.forEach((id, index) => {
        this.slots.remove(id)
        if (index < ids.length) this.load(index, ids[index]!)
      })
    } else if (patternChanged) {
      this.lastEvent = event
    } else if (event && event !== this.lastEvent) {
      this.lastEvent = event
      // Do not cancel a slow decode on every musical event. The next event
      // after completion advances it, and the previous picture stays visible.
      if (ids.length && this.pending.size === 0) {
        this.step = (this.step + 1) % Math.min(ids.length, CHANNELS.length)
        if (ids.length > CHANNELS.length) {
          this.load(this.channel, ids[this.cursor % ids.length]!)
          this.cursor = (this.cursor + 1) % ids.length
          this.channel = (this.channel + 1) % CHANNELS.length
        } else {
          // Retry failed channels on subsequent musical events, never per frame.
          ids.forEach((id, index) => { if (!this.slots.getManagedResource(CHANNELS[index]!)) this.load(index, id) })
        }
      }
    }
    this.slots.updateVideoTextures(paused)
  }

  private load(channel: number, id: string) {
    const generation = this.generation
    const slot = CHANNELS[channel]!
    this.pending.add(channel)
    void Promise.resolve().then(() => this.source.resolve(id)).then(source => {
      if (this.disposed || generation !== this.generation || !source || source.id !== id) return
      return this.slots.replace(slot, source, { fit: 'cover' })
    }).catch(() => { /* Keep the last ready feed; a future event can try again. */ }).finally(() => {
      if (generation === this.generation) this.pending.delete(channel)
    })
  }

  getResources(): readonly (Readonly<Cinema2ManagedMediaResource> | null)[] {
    return CHANNELS.map(id => this.slots.getManagedResource(id))
  }
  get count() { return this.ids.length }
  dispose() { this.disposed = true; this.generation++; this.pending.clear(); this.slots.dispose() }
}
