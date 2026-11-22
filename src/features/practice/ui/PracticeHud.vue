<script setup lang="ts">
import { computed } from 'vue'
import type { PinballDocument } from '@/shared/document'
import { speedOf } from '@/shared/geometry'
import { practiceMeta } from '@/features/practice/model/practice-session'

const props = defineProps<{ doc: PinballDocument }>()

const meta = computed(() => practiceMeta(props.doc))

const clock = computed(() => {
  const total = Math.floor(props.doc.run.playMs / 1000)
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
})

const speed = computed(() => Math.round(speedOf(props.doc.ball.vx, props.doc.ball.vy)))

const phaseLabel = computed(() => {
  if (props.doc.ball.held === 'plunger') return '待发'
  return '练习中'
})

const spawnLabel = computed(() =>
  meta.value.atPlunger ? '发射槽' : `(${meta.value.spawnX}, ${meta.value.spawnY})`,
)
</script>

<template>
  <div class="score-window practice-hud">
    <p class="practice-eyebrow">练习分数 · 不计入正式局</p>
    <p class="score-digits" aria-live="polite">{{ doc.score }}</p>
    <dl class="score-meta">
      <div>
        <dt>已发球</dt>
        <dd>{{ meta.ballsServed }}</dd>
      </div>
      <div>
        <dt>用时</dt>
        <dd>{{ clock }}</dd>
      </div>
      <div>
        <dt>球速</dt>
        <dd>{{ speed }}</dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>{{ phaseLabel }}</dd>
      </div>
    </dl>
    <p class="ball-label">出生点：{{ spawnLabel }}</p>
    <p v-if="doc.note.ms > 0" class="note-line">{{ doc.note.text }}</p>
  </div>
</template>
