interface ChunkPlan {
  frameStart: number
  frameEnd: number
}

interface InitMessage {
  type: 'init'
  operationId: string
  pcmBuffer: ArrayBuffer
  pcmByteOffset: number
  pcmLength: number
  sampleRate: number
  channels: number
  bitsPerSample: number
  plans: ChunkPlan[]
}

interface EncodeMessage {
  type: 'encode'
  operationId: string
  index: number
}

interface CancelMessage {
  type: 'cancel'
  operationId: string
}

type WorkerRequest = InitMessage | EncodeMessage | CancelMessage

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
  close(): void
}

const workerScope = self as unknown as WorkerScope
let activeOperationId: string | null = null
let pcm: Float32Array | null = null
let plans: ChunkPlan[] = []
let sampleRate = 16_000
let channels = 1
let bitsPerSample = 16

function encodePlan(plan: ChunkPlan): ArrayBuffer {
  if (!pcm) throw new Error('PCM was not initialized.')
  const bytesPerSample = bitsPerSample / 8
  const frameCount = Math.max(0, plan.frameEnd - plan.frameStart)
  const dataBytes = frameCount * channels * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const byteRate = sampleRate * channels * bytesPerSample

  view.setUint32(0, 0x52494646, false)
  view.setUint32(4, buffer.byteLength - 8, true)
  view.setUint32(8, 0x57415645, false)
  view.setUint32(12, 0x666d7420, false)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, channels * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)
  view.setUint32(36, 0x64617461, false)
  view.setUint32(40, dataBytes, true)

  let byteOffset = 44
  for (let frame = plan.frameStart; frame < plan.frameEnd; frame += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[frame] ?? 0))
    view.setInt16(byteOffset, Math.round(sample * 32767), true)
    byteOffset += 2
  }
  return buffer
}

workerScope.onmessage = event => {
  const message = event.data
  if (message.type === 'init') {
    activeOperationId = message.operationId
    pcm = new Float32Array(message.pcmBuffer, message.pcmByteOffset, message.pcmLength)
    plans = message.plans
    sampleRate = message.sampleRate
    channels = message.channels
    bitsPerSample = message.bitsPerSample
    workerScope.postMessage({ type: 'ready', operationId: activeOperationId })
    return
  }
  if (message.operationId !== activeOperationId) return
  if (message.type === 'cancel') {
    pcm = null
    plans = []
    activeOperationId = null
    workerScope.close()
    return
  }
  if (message.type === 'encode') {
    try {
      const plan = plans[message.index]
      if (!plan) throw new Error('Chunk plan is unavailable.')
      const wavBuffer = encodePlan(plan)
      workerScope.postMessage({
        type: 'encoded',
        operationId: message.operationId,
        index: message.index,
        wavBuffer,
      }, [wavBuffer])
    } catch (error) {
      workerScope.postMessage({
        type: 'error',
        operationId: message.operationId,
        index: message.index,
        message: error instanceof Error ? error.message : 'Chunk encoding failed.',
      })
    }
  }
}
