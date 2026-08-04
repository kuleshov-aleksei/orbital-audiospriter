import { describe, expect, it } from "vitest"
import { replaceExtension } from "@/utils/format"

describe("replaceExtension", () => {
  it("swaps the extension of a lowercase file name", () => {
    expect(replaceExtension("bell.wav", "mp3")).toBe("bell.mp3")
  })

  it("keeps the original stem with mixed case / dots", () => {
    expect(replaceExtension("Snare.Shot.OGG", "mp3")).toBe("Snare.Shot.mp3")
  })

  it("appends the extension when the name has none", () => {
    expect(replaceExtension("kick", "mp3")).toBe("kick.mp3")
  })
})
