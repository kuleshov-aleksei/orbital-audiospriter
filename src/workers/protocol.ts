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

export type WorkerRequest =
  | { id: number; kind: "capabilities" }
  | { id: number; kind: "selftest" }

export interface WorkerResponse {
  id: number
  ok: boolean
  data?: Capabilities | SelfTestResult
  error?: string
  logs: string[]
}