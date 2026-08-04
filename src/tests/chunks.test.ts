import { describe, expect, it } from "vitest"
import { chunksTotalDuration, spliceChunks, splitChunkAt, removeChunkById } from "@/utils/chunks"

describe("chunks utils", () => {
  it("sums chunk lengths as playback duration", () => {
    expect(
      chunksTotalDuration([
        { id: "a", start: 0, end: 0.5 },
        { id: "b", start: 0.7, end: 0.9 },
      ]),
    ).toBeCloseTo(0.7, 10)
  })

  it("concatenates chunk slices of the pcm in order", () => {
    const pcm = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const out = spliceChunks(
      pcm,
      [
        { id: "a", start: 0, end: 0.3 },
        { id: "b", start: 0.5, end: 0.7 },
      ],
      10,
    )
    expect(out).toEqual(new Float32Array([1, 2, 3, 6, 7]))
  })

  it("returns empty pcm with no chunks, and total samples from duration", () => {
    const pcm = new Float32Array(10)
    expect(spliceChunks(pcm, [], 10)).toEqual(new Float32Array(0))

    const out = spliceChunks(pcm, [{ id: "a", start: 0, end: 0.4 }], 10)
    expect(out).toHaveLength(4)
  })

  it("splits the chunk under the spliced time", () => {
    const chunks = [{ id: "c0", start: 0, end: 1 }]
    const next = splitChunkAt(chunks, 0.4, 10)
    expect(next).not.toBeNull()
    expect(next).toHaveLength(2)
    expect(next![0]).toEqual({ id: "c0", start: 0, end: 0.4 })
    expect(next![1].start).toBe(0.4)
    expect(next![1].end).toBe(1)
  })

  it("splits inside the right chunk of a folded list using spliced time", () => {
    const chunks = [
      { id: "a", start: 0, end: 0.2 },
      { id: "b", start: 0.8, end: 1 },
    ]
    // spliced 0.25s maps into chunk b (spliced span 0.2–0.4s).
    const next = splitChunkAt(chunks, 0.25, 100)
    expect(next).not.toBeNull()
    expect(next).toHaveLength(3)
    expect(next![0]).toEqual({ id: "a", start: 0, end: 0.2 })
    expect(next![1].end).toBeCloseTo(0.85, 3)
    expect(next![2].start).toBeCloseTo(0.85, 3)
  })

  it("returns null at content edges and outside content", () => {
    const chunks = [
      { id: "a", start: 0, end: 0.2 },
      { id: "b", start: 0.8, end: 1 },
    ]
    expect(splitChunkAt(chunks, 0, 100)).toBeNull()
    expect(splitChunkAt(chunks, 0.4, 100)).toBeNull()
    expect(splitChunkAt([], 0.1, 100)).toBeNull()
  })

  it("removes a chunk by id", () => {
    const chunks = [
      { id: "a", start: 0, end: 0.2 },
      { id: "b", start: 0.8, end: 1 },
    ]
    expect(removeChunkById(chunks, "a").map((c) => c.id)).toEqual(["b"])
    expect(removeChunkById(chunks, "nope")).toHaveLength(2)
  })
})
