import { idbDel, idbGet, idbSet } from "@/utils/idb"

const SOURCE_HANDLE_KEY = "fs.sourceHandle"
const OUTPUT_HANDLE_KEY = "fs.outputHandle"

export const AUDIO_EXTENSIONS = [
  "wav",
  "mp3",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "flac",
  "opus",
  "webm",
  "mp4",
] as const

export type AudioExtension = (typeof AUDIO_EXTENSIONS)[number]

export function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return (AUDIO_EXTENSIONS as readonly string[]).includes(name.slice(dot + 1).toLowerCase())
}

export type DirScope = "source" | "output"

function handleKey(scope: DirScope): string {
  return scope === "source" ? SOURCE_HANDLE_KEY : OUTPUT_HANDLE_KEY
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function"
}

export async function openDirectoryPicker(
  mode: "read" | "readwrite" = "readwrite",
): Promise<FileSystemDirectoryHandle> {
  if (!supportsFileSystemAccess()) {
    throw new Error("The File System Access API is unavailable; Chrome on Linux is required.")
  }
  return window.showDirectoryPicker({ mode })
}

export async function persistDirectoryHandle(
  scope: DirScope,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await idbSet(handleKey(scope), handle)
}

export async function restoreDirectoryHandle(
  scope: DirScope,
): Promise<FileSystemDirectoryHandle | null> {
  return (await idbGet<FileSystemDirectoryHandle>(handleKey(scope))) ?? null
}

export async function clearDirectoryHandle(scope: DirScope): Promise<void> {
  await idbDel(handleKey(scope))
}

export async function queryPermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "readwrite",
): Promise<PermissionState> {
  return handle.queryPermission({ mode })
}

export async function requestPermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "readwrite",
): Promise<PermissionState> {
  return handle.requestPermission({ mode })
}

export interface AudioFileEntry {
  name: string
  size: number
  handle: FileSystemFileHandle
}

export async function listAudioFiles(
  dirHandle: FileSystemDirectoryHandle,
): Promise<AudioFileEntry[]> {
  const entries: AudioFileEntry[] = []
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind !== "file" || !isAudioFile(name)) continue
    let size = 0
    try {
      size = (await handle.getFile()).size
    } catch {
      // size stays 0 if the file cannot be read (e.g. a dead handle)
    }
    entries.push({ name, size, handle: handle as FileSystemFileHandle })
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

export async function readFileBytes(
  fileHandle: FileSystemFileHandle,
): Promise<Uint8Array<ArrayBuffer>> {
  const file = await fileHandle.getFile()
  return new Uint8Array<ArrayBuffer>(await file.arrayBuffer())
}

export async function writeFileToDir(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  data: Uint8Array<ArrayBuffer> | Blob,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    await writable.write(data)
  } finally {
    await writable.close()
  }
}
