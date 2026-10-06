import { ORBITAL_EVENTS } from "@/types/audio"
import type { OrbitalEvent } from "@/types/audio"

export interface ParsedSpriteEntry {
  event: OrbitalEvent
  sfxName: string
  startMs: number
  durationMs: number
}

export interface GroupedSlice {
  sfxName: string
  startMs: number
  durationMs: number
  events: OrbitalEvent[]
}

export interface SliceResult {
  slice: Float32Array
  /** true when the requested range was clamped to the decoded audio */
  clamped: boolean
  /** true when nothing overlapped the decoded audio (empty slice) */
  outOfRange: boolean
}

const ENTRY_RE =
  /(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*:\s*\{\s*["']?name["']?\s*:\s*["']([^"']*)["']\s*,\s*["']?start["']?\s*:\s*([\d.]+)\s*,\s*["']?duration["']?\s*:\s*([\d.]+)\s*,?\s*\}/g

/**
 * Parse an orbital sprite `.ts` definition (`Record<event, { name, start, duration }>`,
 * timings in milliseconds) into per-event entries. Unknown events are skipped and
 * reported as warnings; malformed input throws.
 */
export function parseSpriteTs(text: string): { entries: ParsedSpriteEntry[]; warnings: string[] } {
  const warnings: string[] = []
  const entries: ParsedSpriteEntry[] = []
  const known = new Set<string>(ORBITAL_EVENTS)

  ENTRY_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ENTRY_RE.exec(text)) !== null) {
    const [, quotedKey, bareKey, rawName, rawStart, rawDuration] = match
    const rawEvent = quotedKey ?? bareKey
    const startMs = Number(rawStart)
    const durationMs = Number(rawDuration)
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0 ||
      startMs < 0
    ) {
      warnings.push(
        `Skipped "${rawEvent}": invalid timing (start=${rawStart}, duration=${rawDuration})`,
      )
      continue
    }
    if (!known.has(rawEvent)) {
      warnings.push(`Skipped unknown event "${rawEvent}"`)
      continue
    }
    entries.push({
      event: rawEvent as OrbitalEvent,
      sfxName: rawName.trim(),
      startMs,
      durationMs,
    })
  }

  if (entries.length === 0) {
    throw new Error("No sprite entries found in the definition file")
  }
  return { entries, warnings }
}

/**
 * Collapse per-event entries into unique slices. Aliases (several events sharing
 * the exact start/duration) become one slice owning all those events. When the
 * same timing carries different sfx names, the first one wins.
 */
export function groupSpriteSlices(entries: ParsedSpriteEntry[]): {
  groups: GroupedSlice[]
  warnings: string[]
} {
  const warnings: string[] = []
  const byKey = new Map<string, GroupedSlice>()
  for (const entry of entries) {
    const key = `${entry.startMs}:${entry.durationMs}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        sfxName: entry.sfxName,
        startMs: entry.startMs,
        durationMs: entry.durationMs,
        events: [entry.event],
      })
      continue
    }
    if (!existing.events.includes(entry.event)) existing.events.push(entry.event)
    if (existing.sfxName !== entry.sfxName) {
      warnings.push(
        `Events at ${entry.startMs}ms share timing but differ in name ("${existing.sfxName}" vs "${entry.sfxName}"); using "${existing.sfxName}"`,
      )
    }
  }
  return { groups: [...byKey.values()], warnings }
}

/** Derive the pack id from a definition file name (`default.ts` -> `default`). */
export function packIdFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName).toLowerCase()
  const cleaned = base.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "")
  return cleaned || "imported_pack"
}

/**
 * Derive a unique `.mp3` file name for a slice, sanitized to snake_case and
 * never colliding with `taken` (case-insensitive). Falls back to the first
 * event name when the sfx name is empty.
 */
export function sliceToFileName(
  sfxName: string,
  fallbackEvent: string,
  taken: Set<string>,
): string {
  const raw = (sfxName.trim() || fallbackEvent).toLowerCase()
  const base = raw.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "sfx"
  const lowered = new Set([...taken].map((n) => n.toLowerCase()))
  let candidate = `${base}.mp3`
  let n = 2
  while (lowered.has(candidate.toLowerCase())) {
    candidate = `${base}__${n}.mp3`
    n++
  }
  taken.add(candidate)
  return candidate
}

/**
 * Auto-pick the compiled sprite audio from a list of file names: prefer an
 * exact `<base>.<audio-ext>` match (pack id, then definition base name), then
 * any `.mp3`, then the first audio file. Returns null when the list is empty.
 */
export function pickSpriteAudioFile(
  names: string[],
  packIdHint: string,
  defBase: string,
): string | null {
  if (names.length === 0) return null
  const byLower = new Map(names.map((n) => [n.toLowerCase(), n]))
  for (const base of [packIdHint, defBase].filter(Boolean)) {
    for (const [lower, original] of byLower) {
      const dot = lower.lastIndexOf(".")
      if (dot > 0 && lower.slice(0, dot) === base.toLowerCase()) return original
    }
  }
  const mp3 = names.find((n) => n.toLowerCase().endsWith(".mp3"))
  return mp3 ?? names[0]
}

/** Slice `[startMs, startMs+durationMs]` out of decoded mono PCM (exact, clamped). */
export function slicePcm(
  pcm: Float32Array,
  sampleRate: number,
  startMs: number,
  durationMs: number,
): SliceResult {
  const startSample = Math.max(0, Math.round((startMs / 1000) * sampleRate))
  const endSample = Math.min(pcm.length, Math.round(((startMs + durationMs) / 1000) * sampleRate))
  const clamped =
    startSample !== Math.round((startMs / 1000) * sampleRate) ||
    endSample !== Math.round(((startMs + durationMs) / 1000) * sampleRate)
  if (endSample <= startSample) {
    return { slice: new Float32Array(0), clamped: true, outOfRange: true }
  }
  return { slice: pcm.slice(startSample, endSample), clamped, outOfRange: false }
}
