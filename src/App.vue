<template>
  <div v-if="unsupported" class="flex min-h-screen items-center justify-center p-6">
    <div class="max-w-md rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
      <span
        class="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-2xl"
        >⚠️</span
      >
      <h1 class="text-lg font-semibold text-zinc-100">Unsupported browser</h1>
      <p class="mt-2 text-sm text-zinc-400">
        AudioSpriter needs the <strong class="text-zinc-200">File System Access API</strong>, which
        is only available in Chrome, Edge, and Opera. Please open this app in one of those browsers.
      </p>
      <ul class="mt-4 space-y-1.5 text-left text-xs text-zinc-500">
        <li class="flex items-start gap-2">
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"></span>
          <span><strong class="text-zinc-300">Chrome</strong> on desktop — fully supported</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"></span>
          <span><strong class="text-zinc-300">Edge</strong> (Chromium) — fully supported</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"></span>
          <span><strong class="text-zinc-300">Firefox / Safari</strong> — not supported yet</span>
        </li>
      </ul>
    </div>
  </div>

  <div v-else class="min-h-screen">
    <header class="sticky top-0 z-10 border-b border-zinc-800 bg-[#0f0f14]/90 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <div class="flex items-center gap-2">
          <span class="inline-block h-6 w-6">
            <img src="/favicon.svg" alt="" class="h-6 w-6" />
          </span>
          <span class="text-sm font-semibold text-zinc-100">AudioSpriter</span>
        </div>
        <nav class="flex gap-1">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition"
            :class="
              view === 'home'
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-zinc-400 hover:text-zinc-200'
            "
            @click="view = 'home'">
            Home
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition"
            :class="
              view === 'editor'
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-zinc-400 hover:text-zinc-200'
            "
            @click="view = 'editor'">
            Editor
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition"
            :class="
              view === 'spike'
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-zinc-400 hover:text-zinc-200'
            "
            @click="view = 'spike'">
            FFmpeg test
          </button>
        </nav>
      </div>
    </header>

    <main>
      <HomeView v-if="view === 'home'" />
      <EditorView v-else-if="view === 'editor'" />
      <SpikeView v-else />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import HomeView from "@/views/HomeView.vue"
import EditorView from "@/views/EditorView.vue"
import SpikeView from "@/views/SpikeView.vue"
import { supportsFileSystemAccess } from "@/services/fsAccess"

defineOptions({ name: "App" })

const view = ref<"home" | "editor" | "spike">("home")
const unsupported = !supportsFileSystemAccess()
</script>
