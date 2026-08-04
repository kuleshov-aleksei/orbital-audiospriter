<script setup lang="ts">
defineOptions({ name: "HomeView" })

const phases = [
  {
    title: "Phase 1 — Scaffold + spike",
    description: "Vue/Vite/PWA shell and ffmpeg.wasm codec/filter verification.",
    done: true,
  },
  {
    title: "Phase 2 — File System Access",
    description: "Open dirs, read/write files, persist handles in IndexedDB.",
    done: false,
  },
  {
    title: "Phase 3 — Import + editor",
    description: "decodeAudioData → PCM, wavesurfer.js waveform, trim regions, undo.",
    done: false,
  },
  {
    title: "Phase 4 — Loudness",
    description: "JS EBU R128 to -23 LUFS with before/after preview.",
    done: false,
  },
  {
    title: "Phase 5 — Per-sample save",
    description: "Encode mono MP3 and write back to the source dir.",
    done: false,
  },
  {
    title: "Phase 6 — Event assignment",
    description: "Multi-assign orbital events, alias suggestions.",
    done: false,
  },
  {
    title: "Phase 7 — Sprite export",
    description: "Sample-accurate concat, 3 formats, .json + .ts generation.",
    done: false,
  },
  {
    title: "Phase 8 — Polish",
    description: "Error states, permission flows, offline verification.",
    done: false,
  },
]
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">Orbital AudioSpriter</h2>
      <p class="mt-1 max-w-3xl text-sm text-zinc-400">
        Chrome-only PWA for preparing orbital sound packs: open a folder, trim + normalize samples to
        -23 LUFS, assign events, and export an audiosprite (.mp3/.ogg/.m4a + .json + .ts).
      </p>
    </div>

    <section class="grid gap-3 sm:grid-cols-2">
      <div v-for="phase in phases" :key="phase.title" class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 class="text-sm font-semibold text-zinc-200">{{ phase.title }}</h3>
        <p class="mt-1 text-xs text-zinc-500">{{ phase.description }}</p>
        <p class="mt-3">
          <span
            class="inline-block rounded px-2 py-0.5 text-xs font-medium"
            :class="phase.done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'"
          >{{ phase.done ? "done" : "pending" }}</span>
        </p>
      </div>
    </section>
  </div>
</template>