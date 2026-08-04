import { describe, expect, it } from "vitest"
import { createSineWave, pcmToWav16, wav16ToPcm } from "@/utils/wav"

describe("createSineWave", () => {
  it("produces the expected number of samples for the given duration", () => {
    const samples = createSineWave(0.4, 44100, 440)
    expect(samples.length).toBe(17640)
  })

  it("is a zero-mean tone bounded by the amplitude", () => {
    const samples = createSineWave(0.4, 44100, 440, 0.5)
    const max = Math.max(...samples)
    const min = Math.min(...samples)
    expect(max).toBeLessThanOrEqual(0.5)
    expect(min).toBeGreaterThanOrEqual(-0.5)
  })
})

describe("pcmToWav16", () => {
  it("writes a valid mono 16-bit PCM WAV header", () => {
    const samples = new Float32Array([0, 0.5, -1, 1])
    const wav = pcmToWav16(samples, 44100)
    const view = new DataView(wav.buffer)

    const ascii = (offset: number, len: number) =>
      String.fromCharCode(...wav.slice(offset, offset + len))

    expect(ascii(0, 4)).toBe("RIFF")
    expect(ascii(8, 4)).toBe("WAVE")
    expect(ascii(12, 4)).toBe("fmt ")
    expect(ascii(36, 4)).toBe("data")
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(44100)
    expect(wav.byteLength).toBe(44 + samples.length * 2)
  })

  it("quantizes samples into 16-bit values", () => {
    const samples = new Float32Array([0, 0.5, -1, 1, 0])
    const wav = pcmToWav16(samples, 44100)
    const view = new DataView(wav.buffer)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(Math.round(0.5 * 32767))
    expect(view.getInt16(48, true)).toBe(-32767)
    expect(view.getInt16(50, true)).toBe(32767)
  })
})

describe("wav16ToPcm", () => {
  it("round-trips a pcmToWav16 sample up to quantization", () => {
    const samples = new Float32Array([0, 0.25, -0.5, 0.999, -1])
    const { pcm, sampleRate } = wav16ToPcm(pcmToWav16(samples, 22050))
    expect(sampleRate).toBe(22050)
    expect(pcm.length).toBe(samples.length)
    for (let i = 0; i < samples.length; i++) {
      const stored = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767)
      expect(pcm[i]).toBeCloseTo(stored / 32768, 5)
    }
  })

  it("averages a stereo file into mono", () => {
    const wav = new Uint8Array(44 + 8)
    const view = new DataView(wav.buffer)
    const put = (i: number, s: string) => {
      for (let j = 0; j < s.length; j++) wav[i + j] = s.charCodeAt(j)
    }
    put(0, "RIFF")
    put(8, "WAVE")
    put(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 2, true)
    view.setUint32(24, 44100, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    put(36, "data")
    view.setUint32(40, 8, true)
    view.setInt16(44, 32767, true)
    view.setInt16(46, 32767, true)
    view.setInt16(48, -32767, true)
    view.setInt16(50, -32767, true)

    const { pcm } = wav16ToPcm(wav)
    expect(pcm[0]).toBeCloseTo(1, 3)
    expect(pcm[1]).toBeCloseTo(-1, 3)
  })

  it("rejects non-PCM and truncated input", () => {
    const wav = pcmToWav16(new Float32Array([0]), 44100)
    wav[20] = 3 // make it a float wav
    expect(() => wav16ToPcm(wav)).toThrow()
    expect(() => wav16ToPcm(new Uint8Array(10))).toThrow()
  })
})
