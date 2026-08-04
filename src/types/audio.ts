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

export interface SampleChunk {
  id: string
  /** absolute seconds within the source pcm (unedited) */
  start: number
  end: number
}

export interface Sample {
  id: string
  fileName: string
  fileHandle: FileSystemFileHandle | null
  pcm: Float32Array | null
  sampleRate: number
  /** duration of the source pcm in seconds (unedited) */
  duration: number
  /**
   * The kept parts of the sample, in playback order. Absolute offsets into
   * `pcm`. A cut splits a chunk; deleting a chunk removes it (ripple delete:
   * remaining chunks play back-to-back).
   */
  chunks: SampleChunk[]
  loudness?: LoudnessResult
  targetLufs: number
  assignedEvents: OrbitalEvent[]
}

export interface LoudnessResult {
  integratedLufs: number
  gainDb: number
  truePeakDb: number
  /** loudnorm two-pass (preferred) or JS EBU R128 + volume filter. */
  method: "loudnorm" | "r128"
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
