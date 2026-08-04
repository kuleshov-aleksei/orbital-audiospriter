import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { wav16ToPcm } from "@/utils/wav"
import { measureLoudness, parseLoudnormJson } from "@/utils/loudness"

const fixture = (name: string): Float32Array =>
  wav16ToPcm(readFileSync(resolve(__dirname, "fixtures", name))).pcm

/**
 * Reference values from ffmpeg `-af ebur128` (n8.1.2) on fixtures generated
 * from the same PCM the tests decode.
 */
const REFERENCES: Array<[string, number]> = [
  ["sine440_amp05.wav", -9.7],
  ["sine1k_amp025.wav", -15.0],
  ["noise_amp01.wav", -21.7],
  ["sine1k_amp025_edges.wav", -15.5],
]

describe("measureLoudness (EBU R128)", () => {
  it.each(REFERENCES)("%s matches ffmpeg ebur128 within +/-0.5 LU", (file, expected) => {
    const measured = measureLoudness(fixture(file), 44100).integratedLufs
    expect(measured).toBeGreaterThan(expected - 0.5)
    expect(measured).toBeLessThan(expected + 0.5)
  })

  it("reports silence as -Infinity", () => {
    const measured = measureLoudness(fixture("sine1k_silent.wav"), 44100)
    expect(measured.integratedLufs).toBe(-Infinity)
    expect(measured.truePeakDb).toBe(-Infinity)
  })

  it("computes true peak of a full-scale sample as 0 dBFS", () => {
    const pcm = new Float32Array(44100 * 5).fill(0.5)
    pcm[0] = 1
    pcm[100] = -1
    expect(measureLoudness(pcm, 44100).truePeakDb).toBeCloseTo(0, 5)
  })

  it("measures short non-silent audio as a single block (usable LUFS)", () => {
    const pcm = new Float32Array(8000).fill(0.1)
    const measured = measureLoudness(pcm, 44100)
    expect(Number.isFinite(measured.integratedLufs)).toBe(true)
  })

  it("returns -Infinity for empty (no) audio", () => {
    const pcm = new Float32Array(0)
    expect(measureLoudness(pcm, 44100).integratedLufs).toBe(-Infinity)
  })

  it("returns -Infinity when short audio is silent", () => {
    const pcm = new Float32Array(8000).fill(0)
    expect(measureLoudness(pcm, 44100).integratedLufs).toBe(-Infinity)
  })
})

describe("parseLoudnormJson", () => {
  it("parses a loudnorm print_format=json line with string values", () => {
    const output =
      '[Parsed_loudnorm_0 @ 0x1] {"input_i" : "-15.05", "input_tp" : "-12.04", "input_lra" : "0.00", "target_offset" : "0.03"}'
    const parsed = parseLoudnormJson(output)
    expect(parsed).not.toBeNull()
    expect(parsed!.input_i).toBeCloseTo(-15.05, 2)
    expect(parsed!.input_tp).toBeCloseTo(-12.04, 2)
    expect(parsed!.target_offset).toBeCloseTo(0.03, 2)
  })

  it("parses a multi-line pretty-printed JSON block", () => {
    const output = `[Parsed_loudnorm_0 @ 0x7f71dc003d00]
{
\t"input_i" : "-23.03",
\t"target_offset" : "-0.02"
}`
    const parsed = parseLoudnormJson(output)
    expect(parsed!.input_i).toBeCloseTo(-23.03, 2)
    expect(parsed!.target_offset).toBeCloseTo(-0.02, 2)
  })

  it("drops non-finite values like the -inf loudnorm emits for silence", () => {
    const output = '[Parsed_loudnorm_0 @ 0x1] {"input_i" : "-inf", "input_tp" : "-inf"}'
    const parsed = parseLoudnormJson(output)
    expect(parsed).toEqual({})
  })

  it("returns null for output without a JSON object", () => {
    expect(parseLoudnormJson("ffmpeg version n8.1.2")).toBeNull()
  })

  it("returns null for malformed JSON", () => {
    expect(parseLoudnormJson("{input_i:oops")).toBeNull()
  })
})
