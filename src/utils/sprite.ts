import type { Sample, SpriteEntry, SpritePack } from "@/types/audio"
import { spliceChunks } from "@/utils/chunks"

export interface BuiltSprite {
  /** Sprite entries (one per assigned event; aliases share the same timing). */
  pack: SpritePack
  /** Concatenated mono PCM at the samples' sample rate. */
  pcm: Float32Array
  sampleRate: number
}

function camelize(packId: string): string {
  return packId
    .split("_")
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
}

export function camelCasePackId(packId: string): string {
  const camel = camelize(packId)
  return camel.charAt(0).toLowerCase() + camel.slice(1)
}

/**
 * Sample-accurate concat of every sample that has at least one assigned event,
 * in store order, with `gap` seconds of silence between clips. Entries point
 * into the concatenated timeline so aliases (multiple events on one sample)
 * share identical start/end.
 */
export function buildSprite(samples: Sample[], packId: string, gap: number): BuiltSprite {
  const active = samples.filter((s) => s.pcm && s.assignedEvents.length > 0)
  const sampleRate = active[0]?.sampleRate ?? 44100
  const gapSamples = Math.round(Math.max(0, gap) * sampleRate)

  const chunks: Float32Array[] = []
  const entries: SpriteEntry[] = []
  let cursor = 0

  for (const sample of active) {
    const spliced = spliceChunks(sample.pcm!, sample.chunks, sample.sampleRate)
    const start = cursor / sampleRate
    const end = (cursor + spliced.length) / sampleRate
    if (spliced.length > 0) {
      chunks.push(spliced)
      for (const event of sample.assignedEvents) {
        entries.push({ name: event, start, end })
      }
      cursor += spliced.length + gapSamples
    }
  }

  const total = Math.max(0, cursor - gapSamples)
  const pcm = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    pcm.set(chunk, offset)
    offset += chunk.length + gapSamples
  }

  return { pack: { id: packId, gap, entries }, pcm, sampleRate }
}

/**
 * Audiosprite JSON, compatible with `pnpm run convert:soundsprite`.
 * Howler loads sprite urls in order [ogg, m4a, mp3].
 */
export function buildAudiospriteJson(packId: string, entries: SpriteEntry[]): string {
  const urls = [`${packId}.ogg`, `${packId}.m4a`, `${packId}.mp3`]
  const spritemap: Record<string, { start: number; end: number }> = {}
  for (const entry of entries) {
    spritemap[entry.name] = {
      start: round(entry.start, 3),
      end: round(entry.end, 3),
    }
  }
  return `${JSON.stringify({ urls, spritemap }, null, 2)}\n`
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * Orbital .ts definition, byte-compatible with convert-soundsprite.js output:
 * start/duration in milliseconds, events in insertion order (aliases repeat).
 */
export function buildSoundSpriteTs(packId: string, entries: SpriteEntry[]): string {
  const camel = camelCasePackId(packId)
  const body = entries
    .map(
      (entry) =>
        `  "${entry.name}": { "name": "${entry.name}", "start": ${Math.round(
          entry.start * 1000,
        )}, "duration": ${Math.round((entry.end - entry.start) * 1000)} },`,
    )
    .join("\n")
  return [
    `import type { SoundPackSprite } from "@/types/audio"`,
    ``,
    `const ${camel}Sprites: Record<string, SoundPackSprite> = {`,
    body,
    `}`,
    ``,
    `export { ${camel}Sprites }`,
    ``,
  ].join("\n")
}
