import type * as ThreeNamespace from 'three'
import { loadCinema2SkeletonUtils } from './Cinema2ThreeDecoders'

/**
 * Animation support for imported models: a description of the clips a model carries, a skinned-mesh-safe way to clone it, and a controller around
 * `AnimationMixer` that stays under the Cinema 2.0 timeline instead of running a clock of its own.
 *
 * Nothing starts by itself. A loaded asset only carries its clips (`Cinema2ThreeLoadedAsset.animations`); a scene that wants motion creates a
 * controller, plays a clip and drives it. Two ways to drive it, pick one per controller:
 *  - `sync(timelineSeconds)`: the pose is a pure function of the timeline time, so seeking, pausing, looping the song or replacing the track
 *    always lands on the right frame, and deterministic captures are repeatable. This is the Cinema 2.0 way.
 *  - `update(deltaSeconds)`: free-running playback (advances only while not paused) for motion that is not tied to the song.
 */
export type Cinema2ThreeNamespace = typeof ThreeNamespace

export interface Cinema2AnimationClipInfo {
  name: string
  duration: number
  trackCount: number
  /** Distinct node names the clip animates. */
  targets: readonly string[]
  /** Distinct animated properties (`position`, `quaternion`, `scale`, `morphTargetInfluences`, material properties). */
  properties: readonly string[]
  kinds: readonly ('transform' | 'morph' | 'other')[]
}

/** `nodeName.property[.subProperty]` as a track name: the node is everything before the first `.`. */
function splitTrackName(name: string): { node: string; property: string } {
  const dot = name.indexOf('.')
  return dot < 0 ? { node: name, property: '' } : { node: name.slice(0, dot), property: name.slice(dot + 1) }
}

export function describeCinema2AnimationClips(clips: readonly ThreeNamespace.AnimationClip[]): readonly Readonly<Cinema2AnimationClipInfo>[] {
  return Object.freeze(clips.map(clip => {
    const targets = new Set<string>()
    const properties = new Set<string>()
    const kinds = new Set<'transform' | 'morph' | 'other'>()
    for (const track of clip.tracks) {
      const { node, property } = splitTrackName(track.name)
      targets.add(node)
      const base = property.split(/[.[]/)[0] ?? ''
      properties.add(base)
      kinds.add(base === 'position' || base === 'quaternion' || base === 'rotation' || base === 'scale' ? 'transform' : base === 'morphTargetInfluences' ? 'morph' : 'other')
    }
    return Object.freeze({
      name: clip.name,
      duration: clip.duration,
      trackCount: clip.tracks.length,
      targets: Object.freeze([...targets]),
      properties: Object.freeze([...properties]),
      kinds: Object.freeze([...kinds]),
    })
  }))
}

/**
 * Clones a model template for one use. Skinned meshes need `SkeletonUtils.clone` (a plain `Object3D.clone` would make every copy share one
 * skeleton), which is loaded only when a skinned mesh is actually present. Geometry, materials and textures stay shared with the template.
 */
export async function cloneCinema2AssetScene(template: ThreeNamespace.Object3D): Promise<ThreeNamespace.Object3D> {
  let skinned = false
  template.traverse(object => { if ((object as ThreeNamespace.SkinnedMesh).isSkinnedMesh) skinned = true })
  if (!skinned) return template.clone(true)
  const utils = await loadCinema2SkeletonUtils()
  return utils.clone(template)
}

export type Cinema2AnimationLoop = 'once' | 'repeat' | 'pingpong'

export interface Cinema2AnimationPlayOptions {
  loop?: Cinema2AnimationLoop
  weight?: number
  timeScale?: number
  /** Seconds into the clip to start from. */
  startTime?: number
  /** Cross-fade in over this many seconds (free-running mode only). */
  fadeIn?: number
}

export interface Cinema2AnimationControllerSnapshot {
  paused: boolean
  speed: number
  /** Clips with a playing action. */
  active: readonly string[]
  clipNames: readonly string[]
  disposed: boolean
}

export class Cinema2ThreeAnimationController {
  private readonly mixer: ThreeNamespace.AnimationMixer
  private readonly clips = new Map<string, ThreeNamespace.AnimationClip>()
  private readonly actions = new Map<string, ThreeNamespace.AnimationAction>()
  private paused = false
  private speed = 1
  private disposed = false

  constructor(
    private readonly THREE: Cinema2ThreeNamespace,
    private readonly root: ThreeNamespace.Object3D,
    clips: readonly ThreeNamespace.AnimationClip[],
  ) {
    this.mixer = new THREE.AnimationMixer(root)
    for (const clip of clips) {
      if (this.clips.has(clip.name)) throw new Error(`Cinema 2.0 animation controller: two clips are named "${clip.name}".`)
      this.clips.set(clip.name, clip)
    }
  }

  get clipNames(): readonly string[] {
    return [...this.clips.keys()]
  }

  has(name: string): boolean {
    return this.clips.has(name)
  }

  /** Starts a clip (the controller does nothing until this is called). Replaying a clip restarts it with the new options. */
  play(name: string, options: Readonly<Cinema2AnimationPlayOptions> = {}): void {
    if (this.disposed) return
    const clip = this.clips.get(name)
    if (!clip) throw new Error(`Cinema 2.0 animation controller has no clip "${name}".`)
    const { THREE } = this
    let action = this.actions.get(name)
    if (!action) {
      action = this.mixer.clipAction(clip)
      this.actions.set(name, action)
    }
    const loop = options.loop ?? 'repeat'
    action.setLoop(loop === 'once' ? THREE.LoopOnce : loop === 'pingpong' ? THREE.LoopPingPong : THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = loop === 'once'
    action.setEffectiveWeight(options.weight ?? 1)
    action.setEffectiveTimeScale(options.timeScale ?? 1)
    action.reset()
    action.time = options.startTime ?? 0
    if (options.fadeIn && options.fadeIn > 0) action.fadeIn(options.fadeIn)
    action.play()
  }

  stop(name: string): void {
    this.actions.get(name)?.stop()
  }

  stopAll(): void {
    this.mixer.stopAllAction()
  }

  setWeight(name: string, weight: number): void {
    this.actions.get(name)?.setEffectiveWeight(weight)
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  get isPaused(): boolean {
    return this.paused
  }

  setSpeed(speed: number): void {
    this.speed = Number.isFinite(speed) ? speed : 1
  }

  /** Free-running step. Does nothing while paused. */
  update(deltaSeconds: number): void {
    if (this.disposed || this.paused || !Number.isFinite(deltaSeconds)) return
    this.mixer.update(deltaSeconds * this.speed)
  }

  /**
   * Timeline-driven pose: every playing action is evaluated at `timelineSeconds * speed` (plus its own start time), regardless of what happened
   * before. Calling it with the same time always produces the same pose, so seeks and replays are exact. Ignores `pause()`: the timeline
   * itself holds when the transport is paused.
   */
  sync(timelineSeconds: number): void {
    if (this.disposed || !Number.isFinite(timelineSeconds)) return
    this.mixer.setTime(Math.max(0, timelineSeconds) * this.speed)
  }

  /** Jumps every playing action to `seconds` into its clip and applies the pose. Free-running playback continues from there. */
  seek(seconds: number): void {
    if (this.disposed || !Number.isFinite(seconds)) return
    this.mixer.setTime(Math.max(0, seconds))
  }

  getSnapshot(): Readonly<Cinema2AnimationControllerSnapshot> {
    return Object.freeze({
      paused: this.paused,
      speed: this.speed,
      active: Object.freeze([...this.actions.entries()].filter(([, action]) => action.isRunning()).map(([name]) => name)),
      clipNames: Object.freeze(this.clipNames),
      disposed: this.disposed,
    })
  }

  /** Stops every action and releases the mixer's caches. Safe to call repeatedly. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mixer.stopAllAction()
    for (const clip of this.clips.values()) this.mixer.uncacheClip(clip)
    this.mixer.uncacheRoot(this.root)
    this.actions.clear()
    this.clips.clear()
  }
}
