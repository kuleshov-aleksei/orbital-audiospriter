import { ORBITAL_EVENTS } from "@/types/audio"
import type { OrbitalEvent, Sample } from "@/types/audio"
import { readFileBytes, writeFileToDir } from "@/services/fsAccess"

/** Project file that persists event -> sample assignments for restore on load. */
export const EVENT_MAPPING_FILE = "__audiosprter.events.json"

export interface EventMapping {
  version: 1
  /** Sprite pack name used at export time (snake_case). */
  packId: string
  /** Seconds of silence between samples in the exported sprite. */
  gap: number
  /** fileName -> assigned events (fileName is stable across imports). */
  samples: Record<string, OrbitalEvent[]>
}

export function buildEventMapping(samples: Sample[], packId: string, gap: number): EventMapping {
  const samplesMap: Record<string, OrbitalEvent[]> = {}
  for (const sample of samples) {
    if (sample.assignedEvents.length > 0) {
      samplesMap[sample.fileName] = [...sample.assignedEvents]
    }
  }
  return { version: 1, packId, gap, samples: samplesMap }
}

/** Drop events that are not in the canonical list; keep known ones only. */
function sanitizeEvents(value: unknown): OrbitalEvent[] {
  if (!Array.isArray(value)) return []
  const known = new Set<string>(ORBITAL_EVENTS)
  return value.filter((v): v is OrbitalEvent => typeof v === "string" && known.has(v))
}

export function parseEventMapping(text: string): EventMapping | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== "object" || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (obj.version !== 1) return null
  if (typeof obj.samples !== "object" || obj.samples === null) return null
  const samples: Record<string, OrbitalEvent[]> = {}
  for (const [name, events] of Object.entries(obj.samples as Record<string, unknown>)) {
    const clean = sanitizeEvents(events)
    if (clean.length > 0) samples[name] = clean
  }
  return {
    version: 1,
    packId: typeof obj.packId === "string" ? obj.packId : "",
    gap: typeof obj.gap === "number" && Number.isFinite(obj.gap) ? obj.gap : 0,
    samples,
  }
}

export async function saveEventMapping(
  dirHandle: FileSystemDirectoryHandle,
  mapping: EventMapping,
): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(mapping, null, 2))
  await writeFileToDir(dirHandle, EVENT_MAPPING_FILE, bytes)
}

export async function loadEventMapping(
  dirHandle: FileSystemDirectoryHandle,
): Promise<EventMapping | null> {
  let handle: FileSystemFileHandle
  try {
    handle = await dirHandle.getFileHandle(EVENT_MAPPING_FILE)
  } catch {
    return null
  }
  const bytes = await readFileBytes(handle)
  return parseEventMapping(new TextDecoder().decode(bytes))
}

/** Restore fileName-keyed assignments onto the imported samples. */
export function applyEventMapping(samples: Sample[], mapping: EventMapping): void {
  const claimed = new Set<string>()
  for (const sample of samples) {
    const events = mapping.samples[sample.fileName]
    if (!events) continue
    sample.assignedEvents = events.filter((event) => {
      if (claimed.has(event)) return false
      claimed.add(event)
      return true
    })
  }
}
