import type { SampleChunk } from "@/types/audio"

export const CHUNK_MIN_SECONDS = 0.05

/** Total kept duration = sum of chunk lengths, in playback (spliced) time. */
export function chunksTotalDuration(chunks: SampleChunk[]): number {
  return chunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start), 0)
}

/**
 * Build the playback PCM for a list of chunks by concatenating each chunk's
 * slice of the source samples. Empty chunk list yields an empty buffer.
 */
export function spliceChunks(
  pcm: Float32Array,
  chunks: SampleChunk[],
  sampleRate: number,
): Float32Array {
  const totalSamples = Math.round(chunksTotalDuration(chunks) * sampleRate)
  const out = new Float32Array(totalSamples)
  if (totalSamples === 0) return out

  const startSamples = chunks.map((c) => Math.round(c.start * sampleRate))
  let offset = 0
  chunks.forEach((chunk, index) => {
    const from = startSamples[index]
    const to = Math.round(chunk.end * sampleRate)
    if (to <= from) return
    const slice = pcm.subarray(from, to)
    out.set(slice, offset)
    offset += slice.length
  })
  return out
}

/**
 * Split the chunk that contains `splicedSeconds` (playback time) at that point.
 * Returns a replacement chunk array with the chunk split in two, or the
 * original array when the cut point is outside any chunk / too close to an edge.
 */
export function splitChunkAt(
  chunks: SampleChunk[],
  splicedSeconds: number,
  sampleRate: number,
): SampleChunk[] | null {
  if (chunks.length === 0) return null
  const cutIndex = Math.floor(splicedSeconds * sampleRate)
  if (cutIndex <= 0) return null

  let cursor = 0
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const length = chunk.end - chunk.start
    const chunkSamples = Math.round(length * sampleRate)
    if (cutIndex > cursor && cutIndex < cursor + chunkSamples) {
      const absolute = chunk.start + (cutIndex - cursor) / sampleRate
      if (absolute - chunk.start < CHUNK_MIN_SECONDS) return null
      if (chunk.end - absolute < CHUNK_MIN_SECONDS) return null
      const next = chunks.slice()
      next.splice(
        i,
        1,
        { ...chunk, end: absolute },
        { id: crypto.randomUUID(), start: absolute, end: chunk.end },
      )
      return next
    }
    cursor += chunkSamples
  }
  return null
}

/**
 * Remove a chunk by id. Returns the updated array; a null `chunks` result is
 * never returned — if every chunk is removed the array will be empty.
 */
export function removeChunkById(chunks: SampleChunk[], chunkId: string): SampleChunk[] {
  return chunks.filter((c) => c.id !== chunkId)
}

/**
 * Clamp the boundaries of one chunk against its neighbours and the source
 * duration. Uses absolute source seconds.
 */
export function clampChunkRange(
  chunks: SampleChunk[],
  chunkId: string,
  start: number,
  end: number,
  sourceDuration: number,
): { start: number; end: number } | null {
  const index = chunks.findIndex((c) => c.id === chunkId)
  if (index === -1) return null
  const chunk = chunks[index]
  const minStart = index === 0 ? 0 : chunks[index - 1].end
  const maxEnd = index === chunks.length - 1 ? sourceDuration : chunks[index + 1].start
  const clampedStart = Math.max(minStart, Math.min(start, chunk.end - CHUNK_MIN_SECONDS))
  const clampedEnd = Math.min(maxEnd, Math.max(end, clampedStart + CHUNK_MIN_SECONDS))
  if (clampedStart === chunk.start && clampedEnd === chunk.end) return null
  return { start: clampedStart, end: clampedEnd }
}
