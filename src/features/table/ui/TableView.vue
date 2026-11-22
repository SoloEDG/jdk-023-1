<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PinballDocument } from '@/shared/document'
import { VIEW } from '@/features/table/lib/playfield-layout'
import { paintTable } from '@/features/table/lib/draw-table'

const props = defineProps<{ doc: PinballDocument }>()
const emit = defineEmits<{ pickSpawn: [x: number, y: number] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0

function draw(): void {
  const surface = canvas.value
  if (!surface) return
  const context = surface.getContext('2d')
  if (!context) return
  const rect = surface.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.floor(rect.width * ratio))
  const height = Math.max(1, Math.floor(rect.height * ratio))
  if (surface.width !== width || surface.height !== height) {
    surface.width = width
    surface.height = height
  }
  paintTable(context, props.doc, width, height)
  frame = requestAnimationFrame(draw)
}

function onPointerDown(event: PointerEvent): void {
  if (!props.doc.practice) return
  const surface = canvas.value
  if (!surface) return
  const rect = surface.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * VIEW.w
  const y = ((event.clientY - rect.top) / rect.height) * VIEW.h
  emit('pickSpawn', x, y)
}

onMounted(() => {
  frame = requestAnimationFrame(draw)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <canvas
    ref="canvas"
    class="table-glass"
    :class="{ 'table-glass-practice': !!doc.practice }"
    :aria-label="doc.practice ? '练习台面，点击选择发球出生点' : '弹球台，白色球在绿色台面上运动'"
    @pointerdown="onPointerDown"
  ></canvas>
</template>
