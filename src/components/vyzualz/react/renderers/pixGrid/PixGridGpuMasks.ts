import { activePixGridGroups, compilePixGridGroupMask, pixGridMaskHasCell } from '../../pixGrid/PixGridGroups'
import { MAX_PIX_GRID_ACTIVE_GROUPS } from '../../pixGrid/PixGridLimits'
import type { PixGridGroup } from '../../pixGrid/PixGridTypes'

export interface PixGridMaskAtlasData {
  width: number
  height: number
  groupCount: number
  pixels: Uint8Array
  signature: string
}

/** Packs four compact bitset masks into each RGBA atlas row-block. */
export function buildPixGridMaskAtlas(
  groups: readonly PixGridGroup[],
  width: number,
  height: number,
): PixGridMaskAtlasData {
  const safeWidth = Math.max(1, Math.floor(width))
  const safeHeight = Math.max(1, Math.floor(height))
  const active = activePixGridGroups(groups).slice(0, MAX_PIX_GRID_ACTIVE_GROUPS)
  const blocks = Math.max(1, Math.ceil(active.length / 4))
  const pixels = new Uint8Array(safeWidth * safeHeight * blocks * 4)
  const keys: string[] = []
  active.forEach((group, groupIndex) => {
    const compiled = compilePixGridGroupMask(group, safeWidth, safeHeight)
    keys.push(`${group.id}:${compiled.key}`)
    const block = Math.floor(groupIndex / 4)
    const channel = groupIndex % 4
    const blockOffset = block * safeWidth * safeHeight * 4
    for (let index = 0; index < safeWidth * safeHeight; index += 1) {
      if (pixGridMaskHasCell(compiled.bits, index)) pixels[blockOffset + index * 4 + channel] = 255
    }
  })
  return {
    width: safeWidth,
    height: safeHeight * blocks,
    groupCount: active.length,
    pixels,
    signature: `${safeWidth}x${safeHeight}:${keys.join('|')}`,
  }
}

export class PixGridGpuMaskAtlas {
  private texture: WebGLTexture | null = null
  private signature = ''
  private uploadCount = 0
  private approximateBytes = 0
  private groupCount = 0

  constructor(private readonly gl: WebGL2RenderingContext) {}

  update(groups: readonly PixGridGroup[], width: number, height: number): void {
    const atlas = buildPixGridMaskAtlas(groups, width, height)
    this.groupCount = atlas.groupCount
    this.approximateBytes = atlas.groupCount > 0 ? atlas.pixels.byteLength : 0
    if (atlas.groupCount === 0) {
      if (this.texture) this.gl.deleteTexture(this.texture)
      this.texture = null
      this.signature = ''
      return
    }
    if (atlas.signature === this.signature && this.texture) return
    if (!this.texture) {
      this.texture = this.gl.createTexture()
      if (!this.texture) throw new Error('Unable to allocate PixGrid group-mask texture')
    }
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA8,
      atlas.width,
      atlas.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      atlas.pixels,
    )
    this.signature = atlas.signature
    this.uploadCount += 1
  }

  get diagnostics(): Readonly<{ groupCount: number; uploadCount: number; approximateBytes: number; allocated: boolean }> {
    return {
      groupCount: this.groupCount,
      uploadCount: this.uploadCount,
      approximateBytes: this.approximateBytes,
      allocated: this.texture != null,
    }
  }

  dispose(deleteResource = true): void {
    if (deleteResource && this.texture) this.gl.deleteTexture(this.texture)
    this.texture = null
    this.signature = ''
    this.groupCount = 0
    this.approximateBytes = 0
  }
}
