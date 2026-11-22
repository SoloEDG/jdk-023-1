<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { createInputController } from '@/app/input-map'
import { startLoop } from '@/app/game-loop'
import { createDocument, type PinballDocument } from '@/shared/document'
import { PracticeBar, PracticeHud, clampSpawn, createPracticeWorkspace, restartPractice, servePractice, setPracticeSpawn } from '@/features/practice'
import { BonusBanner, ChainMeter } from '@/features/bonus'
import { ControlDeck, TiltLamp, firePlunger } from '@/features/flippers'
import { ChallengeBoard, HistoryList, readSave, ResultCard } from '@/features/records'
import { EventTicker, ScoreHud } from '@/features/scoring'
import { MechanismPanel, mountFresh, TableView } from '@/features/table'

const formal = shallowRef<PinballDocument>(createDocument())
mountFresh(formal.value, readSave())

const practice = shallowRef<PinballDocument | null>(null)
const active = computed<PinballDocument>(() => practice.value ?? formal.value)
const inPractice = computed(() => practice.value !== null)

const input = createInputController(window)
let stop = (): void => {}

function canEnter(): boolean {
  const phase = formal.value.phase
  return phase === 'ready' || phase === 'playing' || phase === 'paused'
}

function enterPractice(): void {
  if (practice.value || !canEnter()) return
  if (formal.value.phase !== 'paused') {
    formal.value.phaseBeforePause = formal.value.phase
    formal.value.phase = 'paused'
  }
  practice.value = createPracticeWorkspace(formal.value)
}

function exitPractice(): void {
  if (!practice.value) return
  practice.value = null
  if (formal.value.phase === 'paused') {
    formal.value.phase = formal.value.phaseBeforePause ?? 'ready'
    formal.value.phaseBeforePause = null
  }
}

function resetPractice(): void {
  if (!practice.value) return
  practice.value = restartPractice(formal.value, practice.value)
}

function reServe(): void {
  const doc = practice.value
  if (!doc) return
  if (doc.ball.held === 'plunger') {
    // 发射槽出生点：按一次 R 即满力打出
    doc.plunger.power = 1
    firePlunger(doc)
    doc.phase = 'playing'
    if (doc.practice) doc.practice.ballsServed += 1
    return
  }
  servePractice(doc)
}

function pickSpawn(x: number, y: number): void {
  if (!practice.value) return
  setPracticeSpawn(practice.value, clampSpawn(x, y))
}

onMounted(() => {
  stop = startLoop(
    {
      formal: () => formal.value,
      practice: () => practice.value,
      hooks: {
        enter: enterPractice,
        exit: exitPractice,
        serve: reServe,
        reset: resetPractice,
      },
    },
    () => input.snapshot(),
  )
})

onBeforeUnmount(() => {
  stop()
  input.destroy()
})

const canPause = computed(() => {
  if (inPractice.value) return true
  const phase = formal.value.phase
  return phase === 'ready' || phase === 'playing' || phase === 'paused'
})
const plungerReady = computed(
  () => active.value.ball.held === 'plunger' && active.value.phase !== 'gameover',
)

function onPlunger(down: boolean): void {
  if (down) input.setPlunger(true)
  else input.releasePlunger()
}

function onPauseButton(): void {
  if (inPractice.value) exitPractice()
  else input.pulsePause()
}
</script>

<template>
  <div class="hall" :class="{ 'hall-practice': inPractice }">
    <main class="cabinet">
      <header class="backglass">
        <div class="bulb-row" aria-hidden="true">
          <i v-for="index in 11" :key="index" :style="{ animationDelay: `${index * 0.12}s` }"></i>
        </div>
        <div class="marquee">
          <p class="marquee-kicker">街机弹球</p>
          <h1>霓虹弹珠厅</h1>
          <p v-if="inPractice" class="practice-marquee">练习模式进行中 · 正式局已暂停</p>
        </div>
        <PracticeHud v-if="practice" :doc="practice" />
        <ScoreHud v-else :doc="formal" />
      </header>

      <section class="play-row">
        <div class="table-wrap">
          <TableView :doc="active" @pick-spawn="pickSpawn" />
          <p class="how">
            A 与左 Shift 是左挡板，D 与右 Shift 是右挡板。按住空格蓄力，松开把球打上发射槽。Q、E 轻推，三次会倾斜。P 暂停。T 进入/退出练习，练习中 R 重新发球。
          </p>
        </div>
        <aside class="side">
          <TiltLamp :warnings="active.nudge.warnings" :tilted="active.nudge.tilted" />
          <BonusBanner :doc="active" />
          <ResultCard v-if="!inPractice" :doc="formal" />
          <ChainMeter :doc="active" />
          <EventTicker :doc="active" />
          <PracticeBar
            v-if="practice"
            :doc="practice"
            @spawn="(x, y) => pickSpawn(x, y)"
            @serve="reServe"
            @reset="resetPractice"
            @exit="exitPractice"
          />
          <ChallengeBoard v-if="!inPractice" :doc="formal" />
          <MechanismPanel :doc="active" />
          <HistoryList v-if="!inPractice" :doc="formal" />
        </aside>
      </section>

      <ControlDeck
        :plunger-power="active.plunger.power"
        :plunger-ready="plungerReady"
        :paused="formal.phase === 'paused'"
        :can-pause="canPause"
        :practicing="inPractice"
        :can-enter-practice="canEnter()"
        @left="input.setLeft"
        @right="input.setRight"
        @plunger="onPlunger"
        @nudge-left="input.pulseNudge(-1)"
        @nudge-right="input.pulseNudge(1)"
        @pause="onPauseButton"
        @restart="inPractice ? resetPractice : input.pulseRestart"
        @practice="enterPractice"
      />
    </main>
  </div>
</template>
