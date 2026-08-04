/// <reference lib="webworker" />
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"
import { createSineWave, pcmToWav16 } from "@/utils/wav"
import { detectCapabilities, parseEncoderNames, parseFilterNames } from "@/services/capabilities"
import type {
  Capabilities,
  SelfTestFormat,
  SelfTestResult,
  WorkerRequest,
  WorkerResponse,
} from "./protocol"

declare const self: DedicatedWorkerGlobalScope

const CORE_BASE = "/ffmpeg"

const logTail: string[] = []
function pushLog(lines: string[]): void {
  for (const line of lines) {
    logTail.push(line)
  }
  while (logTail.length > 500) {
    logTail.shift()
  }
}

let ffmpeg: FFmpeg | null = null
let coreInfo: Capabilities["core"] | null = null

async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  const started = performance.now()
  const loaded = new FFmpeg()
  loaded.on("log", ({ message }) => pushLog([message]))

  const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript")
  const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm")

  await loaded.load({ coreURL, wasmURL })

  const sizeResp = await fetch(wasmURL)
  const blob = await sizeResp.blob()

  ffmpeg = loaded
  coreInfo = { sizeBytes: blob.size, loadTimeMs: Math.round(performance.now() - started) }
  pushLog([
    `[core] loaded in ${coreInfo.loadTimeMs} ms (${(blob.size / 1024 / 1024).toFixed(1)} MB wasm)`,
  ])
  return loaded
}

async function runCapabilities(): Promise<Capabilities> {
  const instance = await loadFfmpeg()
  const before = logTail.length

  const encoderCode = await instance.exec(["-hide_banner", "-encoders"])
  const filterCode = await instance.exec(["-hide_banner", "-filters"])
  if (encoderCode !== 0 || filterCode !== 0) {
    throw new Error(`ffmpeg -encoders/-filters failed (codes ${encoderCode}/${filterCode})`)
  }

  const output = logTail.slice(before).join("\n")

  return {
    core: coreInfo!,
    encoders: parseEncoderNames(output),
    filters: parseFilterNames(output),
  }
}

async function runSelfTest(): Promise<SelfTestResult> {
  const capabilities = await runCapabilities()
  const verdict = detectCapabilities(capabilities.encoders, capabilities.filters)

  const instance = ffmpeg!
  const sampleRate = 44100
  const sine = createSineWave(0.4, sampleRate, 440, 0.5)
  const wav = pcmToWav16(sine, sampleRate)
  await instance.writeFile("in.wav", wav)

  const attempts: Array<[string, string, string[], string]> = [
    ["mp3", verdict.mp3.encoder, ["-codec:a", verdict.mp3.encoder, "-b:a", "192k"], "out.mp3"],
    ["ogg", verdict.ogg.encoder, ["-codec:a", verdict.ogg.encoder, "-q:a", "5"], "out.ogg"],
    ["m4a", verdict.m4a.encoder, ["-codec:a", verdict.m4a.encoder, "-b:a", "160k"], "out.m4a"],
  ]

  const formats: SelfTestFormat[] = []
  for (const [format, encoder, codecArgs, outFile] of attempts) {
    if (encoder === "missing") {
      formats.push({ format, encoder, ok: false, bytes: 0 })
      continue
    }
    try {
      await instance.deleteFile(outFile)
    } catch {
      // file may not exist yet
    }
    const code = await instance.exec(["-i", "in.wav", ...codecArgs, outFile])
    if (code !== 0) {
      formats.push({ format, encoder, ok: false, bytes: 0 })
      continue
    }
    const out = await instance.readFile(outFile)
    formats.push({ format, encoder, ok: true, bytes: out.length })
  }

  let loudnorm: SelfTestFormat | null = null
  if (verdict.loudnorm) {
    try {
      await instance.deleteFile("loudnorm.wav")
    } catch {
      // file may not exist yet
    }
    const code = await instance.exec([
      "-i",
      "in.wav",
      "-af",
      "loudnorm=I=-23:LRA=7:TP=-1.5",
      "-codec:a",
      "pcm_s16le",
      "loudnorm.wav",
    ])
    if (code === 0) {
      const out = await instance.readFile("loudnorm.wav")
      loudnorm = { format: "wav", encoder: "loudnorm", ok: true, bytes: out.length }
    } else {
      loudnorm = { format: "wav", encoder: "loudnorm", ok: false, bytes: 0 }
    }
  }

  const ok = formats.some((f) => f.ok) || loudnorm?.ok === true
  return { ok, formats, loudnorm }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, kind } = event.data

  const respond = (ok: boolean, data?: Capabilities | SelfTestResult, error?: string): void => {
    const response: WorkerResponse = { id, ok, data, error, logs: logTail.slice() }
    self.postMessage(response)
  }

  try {
    pushLog([`--- ${kind} ---`, `[core] ${CORE_BASE}`])
    if (kind === "capabilities") {
      respond(true, await runCapabilities())
    } else if (kind === "selftest") {
      respond(true, await runSelfTest())
    } else {
      respond(false, undefined, `unknown request kind: ${kind}`)
    }
  } catch (error) {
    pushLog([`[error] ${error instanceof Error ? error.message : String(error)}`])
    respond(false, undefined, error instanceof Error ? error.message : String(error))
  }
}
