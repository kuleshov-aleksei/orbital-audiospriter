import { describe, expect, it } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { useProjectStore } from "@/stores/project"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import type { Sample, SampleChunk } from "@/types/audio"

function makeSample(overrides: Partial<Sample> = {}): Sample {
  return {
    id: "a",
    fileName: "hit.mp3",
    fileHandle: null,
    pcm: new Float32Array(44100),
    sampleRate: 44100,
    duration: 1,
    chunks: [{ id: "c0", start: 0, end: 1 }],
    targetLufs: DEFAULT_TARGET_LUFS,
    assignedEvents: [],
    ...overrides,
  }
}

function chunkIds(chunks: SampleChunk[]): string[] {
  return chunks.map((c) => c.id)
}

describe("project store cut/delete chunks", () => {
  it("cuts a chunk into two at the spliced time and returns the right chunk", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample())

    const rightId = store.cutSample("a", 0.4)

    expect(rightId).not.toBeNull()
    const chunks = store.samples[0].chunks
    expect(chunks).toHaveLength(2)
    expect(chunks[0].start).toBe(0)
    expect(chunks[0].end).toBeCloseTo(0.4, 5)
    expect(chunks[1].start).toBeCloseTo(0.4, 5)
    expect(chunks[1].end).toBe(1)
    expect(chunks[1].id).toBe(rightId)
  })

  it("cuts a chunk anywhere in a folded (rippled) list using spliced time", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(
      makeSample({
        chunks: [
          { id: "c0", start: 0, end: 0.4 },
          { id: "c1", start: 0.6, end: 1 },
        ],
      }),
    )

    const rightId = store.cutSample("a", 0.1)

    // Spliced time 0.1s lives inside the first chunk (spliced span 0–0.4s).
    expect(rightId).not.toBeNull()
    expect(store.samples[0].chunks).toHaveLength(3)
    expect(store.samples[0].chunks[0].id).toBe("c0")
    expect(store.samples[0].chunks[0].end).toBeCloseTo(0.1, 5)
    expect(store.samples[0].chunks[1].start).toBeCloseTo(0.1, 5)
    expect(store.samples[0].chunks[1].end).toBeCloseTo(0.4, 5)
    expect(store.samples[0].chunks[2]).toEqual(expect.objectContaining({ start: 0.6, end: 1 }))
  })

  it("refuses cut outside content and at the very edges", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample())

    expect(store.cutSample("a", 0)).toBeNull()
    expect(store.cutSample("a", 1)).toBeNull()
    expect(store.cutSample("a", 1.5)).toBeNull()
    expect(store.samples[0].chunks).toHaveLength(1)
  })

  it("deletes a chunk (ripple) and removes the sample when none remain", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(
      makeSample({
        chunks: [
          { id: "c0", start: 0, end: 0.4 },
          { id: "c1", start: 0.6, end: 1 },
        ],
      }),
    )

    expect(store.deleteChunk("a", "c0")).toBe(false)
    expect(chunkIds(store.samples[0].chunks)).toEqual(["c1"])

    expect(store.deleteChunk("a", "c1")).toBe(true)
    expect(store.samples).toHaveLength(0)
  })

  it("adjusts chunk boundaries clamped to neighbours", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(
      makeSample({
        chunks: [
          { id: "c0", start: 0, end: 0.4 },
          { id: "c1", start: 0.4, end: 0.8 },
        ],
      }),
    )

    // Shrink the first chunk's end.
    expect(store.setChunkRange("a", "c0", 0, 0.3)).toBe(true)
    expect(store.samples[0].chunks[0].end).toBeCloseTo(0.3, 5)

    // Can't push past the neighbour boundary.
    expect(store.setChunkRange("a", "c0", 0.2, 0.9)).toBe(true)
    expect(store.samples[0].chunks[0].end).toBeLessThanOrEqual(0.4)

    // Unknown chunk id is a no-op.
    expect(store.setChunkRange("a", "nope", 0, 1)).toBe(false)
  })
})

describe("project store loudness actions", () => {
  it("scales the sample pcm by a linear factor", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    const pcm = new Float32Array([0.5, -0.25, 0.125])
    store.addSample(makeSample({ pcm }))

    store.scaleSamplePcm("a", 2)

    expect(store.samples[0].pcm![0]).toBeCloseTo(1, 5)
    expect(store.samples[0].pcm![1]).toBeCloseTo(-0.5, 5)
    expect(store.samples[0].pcm![2]).toBeCloseTo(0.25, 5)
  })

  it("ignores scaling when the sample has no pcm", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ pcm: null }))

    expect(() => store.scaleSamplePcm("a", 2)).not.toThrow()
  })

  it("records and stores the loudness result plus target", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample())

    store.setLoudness("a", {
      integratedLufs: -11.2,
      gainDb: -11.8,
      truePeakDb: -0.5,
      method: "loudnorm",
    })
    store.setSampleTargetLufs("a", -23)

    expect(store.samples[0].loudness).toEqual({
      integratedLufs: -11.2,
      gainDb: -11.8,
      truePeakDb: -0.5,
      method: "loudnorm",
    })
    expect(store.samples[0].targetLufs).toBe(-23)
  })

  it("undoes a normalization by applying the inverse gain and clears the result", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    const pcm = new Float32Array([0.5, -0.5])
    store.addSample(
      makeSample({
        pcm,
        loudness: {
          integratedLufs: -11.2,
          gainDb: -11.8,
          truePeakDb: -3,
          method: "r128",
        },
        targetLufs: -23,
      }),
    )
    const restored = pcm.map((v) => v * Math.pow(10, +11.8 / 20))

    store.undoNormalize("a")

    expect(store.samples[0].loudness).toBeUndefined()
    expect(store.samples[0].targetLufs).toBe(DEFAULT_TARGET_LUFS)
    expect(store.samples[0].pcm![0]).toBeCloseTo(restored[0], 5)
    expect(store.samples[0].pcm![1]).toBeCloseTo(restored[1], 5)
  })

  it("returns false when there is nothing to undo", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample())

    expect(store.undoNormalize("a")).toBe(false)
  })
})
