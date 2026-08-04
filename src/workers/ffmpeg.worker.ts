/// <reference lib="webworker" />
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"
import { createSineWave, pcmToWav16, wav16ToPcm } from "@/utils/wav"
import { detectCapabilities, parseEncoderNames, parseFilterNames } from "@/services/capabilities"
import { measureLoudness, parseLoudnormJson } from "@/utils/loudness"
import type {
  Capabilities,
  LoudnessNormalizeResult,
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
  while (logTail.length > 2000) {
    logTail.shift()
  }
}

let ffmpeg: FFmpeg | null = null
let coreInfo: Capabilities["core"] | null = null
let requestMarker = 0

async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  const started = performance.now()
  const loaded = new FFmpeg()
  loaded.on("log", ({ message }) => pushLog([message]))

  // The core JS is served from /public, so Vite forbids static imports of it. Blob-import it
  // instead: the copy script wraps the UMD with an ESM `export default`, so `import(blobURL)`
  // yields `.default`. The single-thread core resolves its wasm via the injected `locateFile`
  // (see scripts/copy-ffmpeg-core.mjs), pinned to the same-origin /ffmpeg/ path.
  const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript")
  const wasmURL = `${CORE_BASE}/ffmpeg-core.wasm`

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

  // Mark the log ring before this request's commands. Index-based slicing breaks once
  // the ring cap shifts out earlier entries (the two listing commands emit ~600 lines).
  const marker = `__cap_start__${requestMarker++}`
  pushLog([marker])

  const encoderCode = await instance.exec(["-hide_banner", "-encoders"])
  const filterCode = await instance.exec(["-hide_banner", "-filters"])
  if (encoderCode !== 0 || filterCode !== 0) {
    throw new Error(`ffmpeg -encoders/-filters failed (codes ${encoderCode}/${filterCode})`)
  }

  const markerIdx = logTail.lastIndexOf(marker)
  const output = (markerIdx >= 0 ? logTail.slice(markerIdx + 1) : []).join("\n")

  return {
    core: coreInfo!,
    encoders: parseEncoderNames(output),
    filters: parseFilterNames(output),
  }
}

async function captureOutput(marker: string, run: () => Promise<number>): Promise<string> {
  const code = await run()
  if (code !== 0) {
    throw new Error(`ffmpeg command failed with code ${code}`)
  }
  const markerIdx = logTail.lastIndexOf(marker)
  return markerIdx >= 0 ? logTail.slice(markerIdx + 1).join("\n") : ""
}

let loudnormAvailable: boolean | null = null

async function hasLoudnorm(): Promise<boolean> {
  if (loudnormAvailable === null) {
    const capabilities = await runCapabilities()
    loudnormAvailable = capabilities.filters.includes("loudnorm")
  }
  return loudnormAvailable
}

const LOUDNORM_LIMITS = "LRA=7:TP=-1.5"

/**
 * Measure the integrated loudness of the input and return the linear gain
 * (dB) required to reach the target. The loudnorm filter is preferred for the
 * measurement (otherwise a JS EBU R128 pass is used); the actual gain is
 * applied on the client PCM so it always reflects the true measured offset.
 */
async function runNormalize(wav: Uint8Array, targetLufs: number): Promise<LoudnessNormalizeResult> {
  const instance = await loadFfmpeg()
  await instance.writeFile("in.wav", wav)

  if (await hasLoudnorm()) {
    const measureMarker = `__norm_measure_${requestMarker++}`
    pushLog([measureMarker])
    const measured = await captureOutput(measureMarker, () =>
      instance.exec([
        "-hide_banner",
        "-i",
        "in.wav",
        "-af",
        `loudnorm=I=${targetLufs}:${LOUDNORM_LIMITS}:print_format=json`,
        "-f",
        "null",
        "-",
      ]),
    )
    const json = parseLoudnormJson(measured)
    const inputI = json?.input_i
    const inputTp = json?.input_tp
    if (
      typeof inputI !== "number" ||
      typeof inputTp !== "number" ||
      !Number.isFinite(inputI) ||
      !Number.isFinite(inputTp)
    ) {
      throw new Error("cannot normalize silent audio")
    }
    const gainDb = targetLufs - inputI
    const result: LoudnessNormalizeResult = {
      integratedLufs: inputI,
      gainDb,
      truePeakDb: inputTp + gainDb,
      method: "loudnorm",
    }
    pushLog([
      `[normalize] loudnorm: ${inputI.toFixed(1)} LUFS -> ${targetLufs} LUFS, gain ${gainDb.toFixed(2)} dB`,
    ])
    return result
  }

  const decoded = wav16ToPcm(wav)
  const measured = measureLoudness(decoded.pcm, decoded.sampleRate)
  if (!Number.isFinite(measured.integratedLufs)) {
    throw new Error("cannot normalize silent audio")
  }
  const gainDb = targetLufs - measured.integratedLufs
  const result: LoudnessNormalizeResult = {
    integratedLufs: measured.integratedLufs,
    gainDb,
    truePeakDb: Number.isFinite(measured.truePeakDb) ? measured.truePeakDb + gainDb : -Infinity,
    method: "r128",
  }
  pushLog([
    `[normalize] EBU R128 fallback: ${measured.integratedLufs.toFixed(1)} LUFS -> ${targetLufs} LUFS, gain ${gainDb.toFixed(2)} dB`,
  ])
  return result
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

  const respond = (
    ok: boolean,
    data?: Capabilities | SelfTestResult | LoudnessNormalizeResult,
    error?: string,
  ): void => {
    const response: WorkerResponse = { id, ok, data, error, logs: logTail.slice() }
    self.postMessage(response)
  }

  try {
    pushLog([`--- ${kind} ---`, `[core] ${CORE_BASE}`])
    if (kind === "capabilities") {
      respond(true, await runCapabilities())
    } else if (kind === "selftest") {
      respond(true, await runSelfTest())
    } else if (kind === "normalize") {
      respond(true, await runNormalize(event.data.wav, event.data.targetLufs))
    } else {
      respond(false, undefined, `unknown request kind: ${kind}`)
    }
  } catch (error) {
    pushLog([`[error] ${error instanceof Error ? error.message : String(error)}`])
    respond(false, undefined, error instanceof Error ? error.message : String(error))
  }
}
