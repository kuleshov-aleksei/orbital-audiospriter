import { describe, expect, it } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { useProjectStore } from "@/stores/project"
import { DEFAULT_GAP, DEFAULT_TARGET_LUFS } from "@/types/audio"
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
  it("defaults the sprite gap to 0.2s", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    expect(store.gap).toBe(DEFAULT_GAP)
    expect(store.gap).toBe(0.2)
  })

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

describe("project store extract chunk as sample", () => {
  it("promotes a chunk into its own independent sample and keeps the rest", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(
      makeSample({
        chunks: [
          { id: "c0", start: 0, end: 0.4 },
          { id: "c1", start: 0.4, end: 1 },
        ],
      }),
    )

    const newId = store.extractChunkAsSample("a", "c1")

    expect(newId).not.toBeNull()
    // Original keeps only the remaining chunk.
    expect(store.samples.find((s) => s.id === "a")!.chunks).toEqual([
      expect.objectContaining({ id: "c0", start: 0, end: 0.4 }),
    ])
    // New sample owns the extracted slice as a 0-start chunk.
    const extracted = store.samples.find((s) => s.id === newId)
    expect(extracted).toBeDefined()
    expect(extracted!.duration).toBeCloseTo(0.6, 5)
    expect(extracted!.chunks[0].start).toBe(0)
    expect(extracted!.chunks[0].end).toBeCloseTo(0.6, 5)
    expect(extracted!.assignedEvents).toEqual([])
  })

  it("removes the original sample when the extracted chunk was the last one", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a" }))

    const newId = store.extractChunkAsSample("a", "c0")

    expect(newId).not.toBeNull()
    expect(store.samples.find((s) => s.id === "a")).toBeUndefined()
    expect(store.samples).toHaveLength(1)
    expect(store.samples[0].id).toBe(newId)
  })

  it("is a no-op for unknown sample or chunk ids", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a" }))

    expect(store.extractChunkAsSample("nope", "c0")).toBeNull()
    expect(store.extractChunkAsSample("a", "nope")).toBeNull()
    expect(store.samples).toHaveLength(1)
  })

  it("gives extracted samples a unique file name", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a" }))

    const first = store.extractChunkAsSample("a", "c0")!
    const other = store.samples.find((s) => s.id === first)!
    other.fileName = "hit__part1.mp3"
    store.addSample(makeSample({ id: "b", fileName: "hit.mp3" }))
    const second = store.extractChunkAsSample("b", "c0")!

    expect(store.samples.find((s) => s.id === first)!.fileName).toBe("hit__part1.mp3")
    expect(store.samples.find((s) => s.id === second)!.fileName).toBe("hit__part2.mp3")
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

describe("project store event assignment", () => {
  it("assigns an event to a sample", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a" }))

    expect(store.toggleAssignedEvent("a", "mute")).toBe(true)
    expect(store.samples[0].assignedEvents).toEqual(["mute"])
  })

  it("unassigns an event when toggled off", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a", assignedEvents: ["mute", "unmute"] }))

    expect(store.toggleAssignedEvent("a", "mute")).toBe(false)
    expect(store.samples[0].assignedEvents).toEqual(["unmute"])
  })

  it("keeps one sfx per event: assigning steals it from the previous owner", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a", assignedEvents: ["mute"] }))
    store.addSample(makeSample({ id: "b", assignedEvents: [] }))

    expect(store.toggleAssignedEvent("b", "mute")).toBe(true)
    expect(store.samples.find((s) => s.id === "a")!.assignedEvents).toEqual([])
    expect(store.samples.find((s) => s.id === "b")!.assignedEvents).toEqual(["mute"])
  })

  it("does not steal when the target already owns the event", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a", assignedEvents: ["mute"] }))
    store.addSample(makeSample({ id: "b", assignedEvents: ["mute"] }))

    expect(store.toggleAssignedEvent("a", "mute")).toBe(false)
    expect(store.samples.find((s) => s.id === "a")!.assignedEvents).toEqual([])
    expect(store.samples.find((s) => s.id === "b")!.assignedEvents).toEqual([])
  })

  it("is a no-op for an unknown sample id", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ id: "a" }))

    expect(store.toggleAssignedEvent("missing", "mute")).toBe(false)
  })
})
