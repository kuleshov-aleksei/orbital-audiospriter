import { describe, expect, it } from "vitest"
import {
  groupSpriteSlices,
  packIdFromFileName,
  parseSpriteTs,
  pickSpriteAudioFile,
  slicePcm,
  sliceToFileName,
} from "@/services/spriteImport"

const LEGACY_TS = `import type { SoundPackSprite } from "@/types/audio"

const defaultSprites: Record<string, SoundPackSprite> = {
  join_room: { name: "transition_up", start: 46000, duration: 100 },
  leave_room: { name: "transition_down", start: 44000, duration: 100 },
  mute: { name: "toggle_off", start: 42000, duration: 100 },
  unmute: { name: "toggle_on", start: 40000, duration: 100 },
  deafen: { name: "toggle_off", start: 42000, duration: 100 },
  undeafen: { name: "toggle_on", start: 40000, duration: 100 },
  camera_start: { name: "toggle_off", start: 42000, duration: 100 },
  camera_stop: { name: "toggle_on", start: 40000, duration: 100 },
  screenshare_start: { name: "toggle_off", start: 42000, duration: 100 },
  screenshare_stop: { name: "toggle_on", start: 40000, duration: 100 },
  message: { name: "notification", start: 8000, duration: 200 },
  viewer_joined: { name: "toggle_off", start: 42000, duration: 100 },
  viewer_left: { name: "toggle_on", start: 40000, duration: 100 },
}

export { defaultSprites }
`

describe("parseSpriteTs", () => {
  it("parses the legacy orbital definition with ms timings", () => {
    const { entries, warnings } = parseSpriteTs(LEGACY_TS)
    expect(warnings).toEqual([])
    expect(entries).toHaveLength(13)
    expect(entries[0]).toEqual({
      event: "join_room",
      sfxName: "transition_up",
      startMs: 46000,
      durationMs: 100,
    })
  })

  it("tolerates single quotes and trailing commas", () => {
    const { entries } = parseSpriteTs(
      `const x = { 'mute': { 'name': 'toggle_off', 'start': 42000, 'duration': 100, }, }`,
    )
    expect(entries).toEqual([
      { event: "mute", sfxName: "toggle_off", startMs: 42000, durationMs: 100 },
    ])
  })

  it("skips unknown events with a warning and keeps known ones", () => {
    const { entries, warnings } = parseSpriteTs(
      `const x = { mute: { name: "toggle_off", start: 42000, duration: 100 }, "nope": { "name": "x", "start": 1, "duration": 2 } }`,
    )
    expect(entries).toHaveLength(1)
    expect(warnings.join(" ")).toContain("nope")
  })

  it("throws when no entries are found", () => {
    expect(() => parseSpriteTs("const x: number = 1")).toThrow(/No sprite entries/)
  })
})

describe("groupSpriteSlices", () => {
  it("collapses aliases sharing a timing into one slice", () => {
    const { entries } = parseSpriteTs(LEGACY_TS)
    const { groups } = groupSpriteSlices(entries)
    expect(groups).toHaveLength(5)
    const toggleOff = groups.find((g) => g.sfxName === "toggle_off")!
    expect(toggleOff.startMs).toBe(42000)
    expect(toggleOff.durationMs).toBe(100)
    expect(toggleOff.events).toEqual([
      "mute",
      "deafen",
      "camera_start",
      "screenshare_start",
      "viewer_joined",
    ])
  })

  it("warns when the same timing carries different names", () => {
    const { warnings } = groupSpriteSlices([
      { event: "mute", sfxName: "a", startMs: 100, durationMs: 50 },
      { event: "unmute", sfxName: "b", startMs: 100, durationMs: 50 },
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('"a"')
  })
})

describe("sliceToFileName", () => {
  it("sanitizes the sfx name and dedupes collisions", () => {
    const taken = new Set(["toggle_off.mp3"])
    expect(sliceToFileName("toggle_off", "mute", taken)).toBe("toggle_off__2.mp3")
    expect(sliceToFileName("  ", "mute", taken)).toBe("mute.mp3")
  })
})

describe("packIdFromFileName", () => {
  it("derives a snake_case pack id", () => {
    expect(packIdFromFileName("default.ts")).toBe("default")
    expect(packIdFromFileName("My Pack v2.ts")).toBe("my_pack_v2")
  })
})

describe("pickSpriteAudioFile", () => {
  it("prefers pack-id matches, then mp3, then the first file", () => {
    expect(pickSpriteAudioFile(["a.ogg", "my_pack.mp3", "my_pack.ogg"], "my_pack", "")).toBe(
      "my_pack.mp3",
    )
    expect(pickSpriteAudioFile(["b.ogg", "a.mp3"], "", "")).toBe("a.mp3")
    expect(pickSpriteAudioFile(["only.ogg"], "", "")).toBe("only.ogg")
    expect(pickSpriteAudioFile([], "", "")).toBeNull()
  })
})

describe("slicePcm", () => {
  it("slices exact sample ranges and flags out-of-range requests", () => {
    const pcm = new Float32Array(44100).fill(0.5)
    const { slice, clamped, outOfRange } = slicePcm(pcm, 44100, 0, 100)
    expect(outOfRange).toBe(false)
    expect(clamped).toBe(false)
    expect(slice.length).toBe(4410)
    const empty = slicePcm(pcm, 44100, 2000, 100)
    expect(empty.outOfRange).toBe(true)
    expect(empty.slice.length).toBe(0)
    const clipped = slicePcm(pcm, 44100, 950, 200)
    expect(clipped.outOfRange).toBe(false)
    expect(clipped.clamped).toBe(true)
  })
})
