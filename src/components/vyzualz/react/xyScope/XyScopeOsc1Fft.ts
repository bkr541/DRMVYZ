/** In-place radix-2 FFT (length must be a power of two). The Text Lab's transform, shared by OSC 1's analyser. */
export function osc1Fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len, wr = Math.cos(angle), wi = Math.sin(angle)
    for (let start = 0; start < n; start += len) {
      let xr = 1, xi = 0
      for (let j = 0; j < len / 2; j++) {
        const a = start + j, b = a + len / 2
        const tr = re[b] * xr - im[b] * xi, ti = re[b] * xi + im[b] * xr
        re[b] = re[a] - tr; im[b] = im[a] - ti
        re[a] += tr; im[a] += ti
        const nx = xr * wr - xi * wi
        xi = xr * wi + xi * wr
        xr = nx
      }
    }
  }
}
