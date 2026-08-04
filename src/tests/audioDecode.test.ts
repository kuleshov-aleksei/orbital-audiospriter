import { describe, expect, it } from "vitest"
import { mixToMono } from "@/services/audioDecode"

describe("mixToMono", () => {
  it("returns the channel unchanged for mono input", () => {
    const mono = new Float32Array([0.1, -0.2, 0.3])
    expect(mixToMono([mono])).toBe(mono)
  })

  it("averages two channels", () => {
    const left = new Float32Array([1, 0, -1])
    const right = new Float32Array([0, 1, 1])
    expect(mixToMono([left, right])).toEqual(new Float32Array([0.5, 0.5, 0]))
  })

  it("averages more than two channels", () => {
    const a = new Float32Array([0.6])
    const b = new Float32Array([0.3])
    const c = new Float32Array([-0.3])
    expect(mixToMono([a, b, c])[0]).toBeCloseTo(0.2, 7)
  })
})
