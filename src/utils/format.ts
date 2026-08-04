/** Replace the extension of a file name (returns `name` unchanged if none). */
export function replaceExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}.${ext}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes
  let unit = "B"
  for (const next of units) {
    value /= 1024
    unit = next
    if (value < 1024) break
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`
}
