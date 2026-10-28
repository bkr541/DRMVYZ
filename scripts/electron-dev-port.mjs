import net from 'node:net'

/** Probe without taking over an existing listener. Vite binds the selected port afterwards. */
export function isDevPortAvailable(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', error => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(false)
      else reject(error)
    })
    server.listen({ host, port, exclusive: true }, () => server.close(() => resolve(true)))
  })
}

/** Keep the configured origin/path, moving only the port when another app owns it. */
export async function selectDevServerUrl(requestedUrl, { available = isDevPortAvailable, maximumAttempts = 20 } = {}) {
  const url = new URL(requestedUrl)
  const firstPort = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
  for (let offset = 0; offset < maximumAttempts && firstPort + offset <= 65535; offset++) {
    const port = firstPort + offset
    if (await available(url.hostname, port)) {
      url.port = String(port)
      return url
    }
  }
  throw new Error(`No available development port found starting at ${firstPort} on ${url.hostname}. Close an unused dev server or set DRMVYZ_VITE_DEV_SERVER_URL to another local port.`)
}
