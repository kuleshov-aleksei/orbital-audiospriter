import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { detectCapabilities, parseEncoderNames, parseFilterNames } from "@/services/capabilities"

const ENCODER_OUTPUT = `
 Encoders:
  A..... = aac                  AAC (Advanced Audio Coding)
  A..... libmp3lame             libmp3lame MPEG-3 audio codec
  A..... libopus                libopus Opus audio codec
  A..... libvorbis              libvorbis Vorbis audio codec
  A..... pcm_s16le              PCM signed 16-bit little-endian
`

const FILTER_OUTPUT = `
 Filters:
   T.. = acompressor            Audio compressor
   T.. = loudnorm               EBU R128 loudness normalization
   T.. = volume                 Change input volume
   T.. = aresample              Resample audio data
`

describe("parseEncoderNames", () => {
  it("extracts encoder names, skipping headers", () => {
    expect(parseEncoderNames(ENCODER_OUTPUT)).toEqual([
      "aac",
      "libmp3lame",
      "libopus",
      "libvorbis",
      "pcm_s16le",
    ])
  })
})

describe("parseFilterNames", () => {
  it("extracts filter names", () => {
    expect(parseFilterNames(FILTER_OUTPUT)).toEqual([
      "acompressor",
      "aresample",
      "loudnorm",
      "volume",
    ])
  })
})

describe("detectCapabilities", () => {
  it("flags expected features when encoders/filters are present", () => {
    const encoders = parseEncoderNames(ENCODER_OUTPUT)
    const filters = parseFilterNames(FILTER_OUTPUT)
    const verdict = detectCapabilities(encoders, filters)

    expect(verdict.mp3).toEqual({ ok: true, encoder: "libmp3lame" })
    expect(verdict.ogg).toEqual({ ok: true, encoder: "libvorbis" })
    expect(verdict.m4a).toEqual({ ok: true, encoder: "aac" })
    expect(verdict.loudnorm).toBe(true)
  })

  it("reports missing features", () => {
    const verdict = detectCapabilities(["pcm_s16le"], [])

    expect(verdict.mp3).toEqual({ ok: false, encoder: "missing" })
    expect(verdict.ogg).toEqual({ ok: false, encoder: "missing" })
    expect(verdict.m4a).toEqual({ ok: false, encoder: "missing" })
    expect(verdict.loudnorm).toBe(false)
  })
})

describe("real ffmpeg output fixtures (core-st 0.11.1)", () => {
  const encoders = parseEncoderNames(readFixture("encoders.txt"))
  const filters = parseFilterNames(readFixture("filters.txt"))

  it("parses the actual -encoders output", () => {
    expect(encoders).toContain("libmp3lame")
    expect(encoders).toContain("libvorbis")
    expect(encoders).toContain("libopus")
    expect(encoders).toContain("libfdk_aac")
    expect(encoders).toContain("aac")
    expect(encoders).toContain("pcm_s16le")
  })

  it("parses the actual -filters output", () => {
    expect(filters).toContain("loudnorm")
    expect(filters).toContain("volume")
    expect(filters).toContain("aresample")
    expect(filters).toContain("ebur128")
  })

  it("derives a full green verdict from real output", () => {
    const verdict = detectCapabilities(encoders, filters)
    expect(verdict.mp3).toEqual({ ok: true, encoder: "libmp3lame" })
    expect(verdict.ogg).toEqual({ ok: true, encoder: "libvorbis" })
    expect(verdict.m4a).toEqual({ ok: true, encoder: "libfdk_aac" })
    expect(verdict.loudnorm).toBe(true)
  })
})

function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8")
}
