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
