/**
 * Shared domain types mirroring orbital's sound pack format
 * (orbital: frontend/src/types/audio.ts + frontend/scripts/convert-soundsprite.js).
 */

export type OrbitalEvent =
  | "join_room"
  | "leave_room"
  | "mute"
  | "unmute"
  | "deafen"
  | "undeafen"
  | "camera_start"
  | "camera_stop"
  | "screenshare_start"
  | "screenshare_stop"
  | "message"
  | "viewer_joined"
  | "viewer_left"

export const ORBITAL_EVENTS: readonly OrbitalEvent[] = [
  "join_room",
  "leave_room",
  "mute",
  "unmute",
  "deafen",
  "undeafen",
  "camera_start",
  "camera_stop",
  "screenshare_start",
  "screenshare_stop",
  "message",
  "viewer_joined",
  "viewer_left",
]

export interface Sample {
  id: string
  fileName: string
  fileHandle: FileSystemFileHandle | null
  pcm: Float32Array | null
  sampleRate: number
  duration: number
  trimStart: number
  trimEnd: number
  loudness?: LoudnessResult
  targetLufs: number
  assignedEvents: OrbitalEvent[]
}

export interface LoudnessResult {
  integratedLufs: number
  gainDb: number
  truePeakDb: number
}

export interface SpriteEntry {
  name: string
  start: number
  end: number
}

export interface SpritePack {
  id: string
  gap: number
  entries: SpriteEntry[]
}

export interface ProjectState {
  sourceDirHandle: FileSystemDirectoryHandle | null
  outputDirHandle: FileSystemDirectoryHandle | null
  samples: Sample[]
  targetLufs: number
  packId: string
  gap: number
}

export const DEFAULT_TARGET_LUFS = -23
