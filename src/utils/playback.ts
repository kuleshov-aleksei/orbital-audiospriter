/**
 * Minimal PCM preview playback for the event assignment test mode. Uses a
 * single lazily-created AudioContext so repeated clicks reuse the sink.
 */

let audioContext: AudioContext | null = null
let activeSource: AudioBufferSourceNode | null = null

function ensureContext(): AudioContext {
  if (audioContext) return audioContext
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error("Web Audio is unavailable")
  audioContext = new Ctor()
  return audioContext
}

export function stopPcmPreview(): void {
  if (activeSource) {
    try {
      activeSource.stop()
    } catch {
      // already stopped
    }
    activeSource.disconnect()
    activeSource = null
  }
}

/** Play a mono PCM buffer once; any previous preview is stopped first. */
export function playPcmPreview(pcm: Float32Array, sampleRate: number): void {
  stopPcmPreview()
  if (pcm.length === 0) return
  const ctx = ensureContext()
  const buffer = ctx.createBuffer(1, pcm.length, sampleRate)
  buffer.getChannelData(0).set(pcm)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.onended = () => {
    if (activeSource === source) activeSource = null
  }
  source.start()
  activeSource = source
}

/** Stop playback and release the context (call on unmount). */
export function disposePcmPreview(): void {
  stopPcmPreview()
  if (audioContext) {
    void audioContext.close().catch(() => {})
    audioContext = null
  }
}
