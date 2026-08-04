/**
 * Parse `ffmpeg -encoders` / `ffmpeg -filters` output into names.
 *
 * Encoder line format (after flags column):
 *   A..... libmp3lame             libmp3lame MPEG-3 audio codec
 *   V..... = aac                  AAC (Advanced Audio Coding)
 * Filter line format:
 *   T.. = loudnorm               EBU R128 loudness normalization
 */

export function parseEncoderNames(output: string): string[] {
  const names = new Set<string>()
  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("Encoders:")) {
      const match = trimmed.match(/^[A-Z.]+(?:\s*=)?\s*([A-Za-z0-9_]+)/)
      if (match) names.add(match[1])
    }
  }
  return [...names].sort()
}

export function parseFilterNames(output: string): string[] {
  const names = new Set<string>()
  for (const line of output.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("Filters:")) {
      const match = trimmed.match(/^[A-Z.]+\s*=?\s*([A-Za-z0-9_]+)/)
      if (match) names.add(match[1])
    }
  }
  return [...names].sort()
}

export const REQUIRED_ENCODERS = ["libmp3lame", "libvorbis", "aac", "libfdk_aac"] as const
export const OPTIONAL_ENCODERS = ["libopus"] as const
export const REQUIRED_FILTERS = ["loudnorm", "volume", "aresample"] as const

export interface FeatureVerdict {
  mp3: { ok: boolean; encoder: string }
  ogg: { ok: boolean; encoder: string }
  m4a: { ok: boolean; encoder: string }
  loudnorm: boolean
}

export function detectCapabilities(encoders: string[], filters: string[]): FeatureVerdict {
  const has = (name: string) => encoders.includes(name)
  return {
    mp3: {
      ok: has("libmp3lame"),
      encoder: has("libmp3lame") ? "libmp3lame" : "missing",
    },
    ogg: {
      ok: has("libvorbis") || has("libopus"),
      encoder: has("libvorbis") ? "libvorbis" : has("libopus") ? "libopus" : "missing",
    },
    m4a: {
      ok: has("libfdk_aac") || has("aac"),
      encoder: has("libfdk_aac") ? "libfdk_aac" : has("aac") ? "aac" : "missing",
    },
    loudnorm: filters.includes("loudnorm"),
  }
}