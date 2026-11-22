<script setup lang="ts">
import type { PinballDocument } from '@/shared/document'
import {
  practiceMeta,
  spawnPresets,
} from '@/features/practice/model/practice-session'

const props = defineProps<{ doc: PinballDocument }>()

const emit = defineEmits<{
  spawn: [x: number, y: number]
  serve: []
  reset: []
  exit: []
}>()

const meta = () => practiceMeta(props.doc)
</script>

<template>
  <section class="slip practice-bar" aria-label="练习控制">
    <header class="slip-head">
      <p class="eyebrow">练习模式</p>
      <h2>发球台</h2>
    </header>
    <p class="slip-copy">
      点击台面任意位置即可选为出生点并立刻发球；正式局已暂停，这里的靶、闸门、连锁和分数都不会写回。
    </p>
    <div class="spawn-grid">
      <button
        v-for="point in spawnPresets"
        :key="point.label"
        type="button"
        class="spawn-key"
        @click="emit('spawn', point.x, point.y)"
      >
        {{ point.label }}
      </button>
    </div>
    <p class="slip-copy">
      当前出生点：{{ meta().atPlunger ? '发射槽' : `(${meta().spawnX}, ${meta().spawnY})` }} ·
      已发 {{ meta().ballsServed }} 颗（R 键重发）
    </p>
    <div class="practice-actions">
      <button type="button" class="text-key" @click="emit('serve')">重新发球</button>
      <button type="button" class="text-key" @click="emit('reset')">重置练习</button>
      <button type="button" class="text-key text-key-strong" @click="emit('exit')">退出练习</button>
    </div>
  </section>
</template>
