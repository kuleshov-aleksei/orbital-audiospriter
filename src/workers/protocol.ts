export interface WorkerCoreInfo {
  sizeBytes: number
  loadTimeMs: number
}

export interface Capabilities {
  core: WorkerCoreInfo
  encoders: string[]
  filters: string[]
}

export interface SelfTestFormat {
  format: string
  encoder: string
  ok: boolean
  bytes: number
}

export interface SelfTestResult {
  ok: boolean
  formats: SelfTestFormat[]
  loudnorm: SelfTestFormat | null
  error?: string
}

export interface LoudnessNormalizeResult {
  /** Integrated loudness measured before gain, LUFS. */
  integratedLufs: number
  /** Linear gain applied in dB to reach the target. */
  gainDb: number
  /** True peak after gain, dBFS. */
  truePeakDb: number
  /** loudnorm (preferred) or JS EBU R128 measurement. */
  method: "loudnorm" | "r128"
}

export type WorkerRequest =
  | { id: number; kind: "capabilities" }
  | { id: number; kind: "selftest" }
  | { id: number; kind: "normalize"; wav: Uint8Array; targetLufs: number }

export interface WorkerResponse {
  id: number
  ok: boolean
  data?: Capabilities | SelfTestResult | LoudnessNormalizeResult
  error?: string
  logs: string[]
}
