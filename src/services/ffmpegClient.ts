import type {
  Capabilities,
  LoudnessNormalizeResult,
  Mp3EncodeResult,
  SelfTestResult,
  WorkerRequest,
  WorkerResponse,
} from "@/workers/protocol"

let worker: Worker | null = null
let nextId = 1

interface Pending {
  resolve: (response: WorkerResponse) => void
  reject: (error: Error) => void
}

const pending = new Map<number, Pending>()
const logs: string[] = []

function appendLogs(lines: string[]): void {
  // Keep only the tail that the worker considered fresh enough to return.
  if (lines.length > logs.length) {
    const fresh = lines.slice(logs.length)
    logs.push(...fresh)
    while (logs.length > 600) {
      logs.shift()
    }
  } else if (lines.length === 0) {
    // no-op
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/ffmpeg.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      appendLogs(event.data.logs)
      const entry = pending.get(event.data.id)
      if (!entry) return
      pending.delete(event.data.id)
      entry.resolve(event.data)
    }
    worker.onerror = (event) => {
      for (const [id, entry] of pending) {
        pending.delete(id)
        entry.reject(new Error(event.message || "ffmpeg worker error"))
      }
    }
  }
  return worker
}

type RequestPayload =
  | { kind: "capabilities" }
  | { kind: "selftest" }
  | { kind: "normalize"; wav: Uint8Array; targetLufs: number }
  | { kind: "encodeMp3"; wav: Uint8Array; bitrate: number }

function request(payload: RequestPayload): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    const message: WorkerRequest = { id, ...payload }
    getWorker().postMessage(message)
  })
}

export async function checkCapabilities(): Promise<Capabilities> {
  const response = await request({ kind: "capabilities" })
  if (!response.ok || !response.data) {
    throw new Error(response.error || "capability check failed")
  }
  return response.data as Capabilities
}

export async function runSelfTest(): Promise<SelfTestResult> {
  const response = await request({ kind: "selftest" })
  if (!response.ok || !response.data) {
    throw new Error(response.error || "self-test failed")
  }
  return response.data as SelfTestResult
}

export async function normalizeAudio(
  wav: Uint8Array,
  targetLufs: number,
): Promise<LoudnessNormalizeResult> {
  const response = await request({ kind: "normalize", wav, targetLufs })
  if (!response.ok || !response.data) {
    throw new Error(response.error || "normalization failed")
  }
  return response.data as LoudnessNormalizeResult
}

export async function encodeMp3(wav: Uint8Array, bitrate = 192): Promise<Mp3EncodeResult> {
  const response = await request({ kind: "encodeMp3", wav, bitrate })
  if (!response.ok || !response.data) {
    throw new Error(response.error || "MP3 encode failed")
  }
  return response.data as Mp3EncodeResult
}

export function getLogs(): string[] {
  return logs.slice()
}
