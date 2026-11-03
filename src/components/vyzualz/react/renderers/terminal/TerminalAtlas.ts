// Each row contains one family in measured ink-coverage order.
const families = [' .,:;+=*oO#%@MW&', ' .,:-+0123456789', ' .,:;_-+*/\\|=~#%']
const tileWidth = 24
const tileHeight = 32

export function createTerminalAtlas() {
  const tile = document.createElement('canvas')
  tile.width = tileWidth
  tile.height = tileHeight
  const ctx = tile.getContext('2d', { willReadFrequently: true })
  const atlas = document.createElement('canvas')
  atlas.width = tileWidth * 16
  atlas.height = tileHeight * families.length
  const out = atlas.getContext('2d')
  if (!ctx || !out) throw new Error('Terminal glyph atlas unavailable')
  ctx.font = 'bold 28px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  families.forEach((family, row) => {
    const glyphs = Array.from(family, glyph => {
      ctx.clearRect(0, 0, tileWidth, tileHeight)
      ctx.fillText(glyph, tileWidth / 2, tileHeight / 2)
      const pixels = ctx.getImageData(0, 0, tileWidth, tileHeight)
      let mass = 0, xx = 0, yy = 0, xy = 0
      for (let y = 1; y < tileHeight - 1; y++) {
        for (let x = 1; x < tileWidth - 1; x++) {
          const alpha = pixels.data[4 * (y * tileWidth + x) + 3]
          const dx = (x + 0.5) / tileWidth - 0.5
          const dy = 0.5 - (y + 0.5) / tileHeight
          mass += alpha
          xx += alpha * dx * dx
          yy += alpha * dy * dy
          xy += alpha * dx * dy
        }
      }
      const total = Math.max(xx + yy, 1)
      // Store stroke orientation as a double-angle vector in the reserved corner.
      pixels.data.set([Math.round(127.5 * (1 + (xx - yy) / total)), Math.round(127.5 * (1 + 2 * xy / total)), 0, 255], 0)
      return { pixels, mass }
    }).sort((a, b) => a.mass - b.mass)
    glyphs.forEach(({ pixels }, index) => out.putImageData(pixels, index * tileWidth, row * tileHeight))
  })
  return atlas
}
