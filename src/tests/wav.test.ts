import { describe, expect, it } from "vitest"
import { createSineWave, pcmToWav16 } from "@/utils/wav"

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
