import assert from 'node:assert/strict'
import { createDocument, type PinballDocument } from '../src/shared/document'
import { idleInput, type FrameInput } from '../src/shared/commands'
import { createMechanisms, mountFresh } from '../src/features/table/model/mechanism-rules'
import {
  clampSpawn,
  createPracticeWorkspace,
  restartPractice,
  servePractice,
  setPracticeSpawn,
} from '../src/features/practice/model/practice-session'
import { runPracticeFrame } from '../src/features/practice/model/practice-frame'
import { runFrame, type LoopSessions } from '../src/app/game-loop'

const DT = 16

function snapshot(doc: PinballDocument): string {
  return JSON.stringify({
    phase: doc.phase,
    phaseBeforePause: doc.phaseBeforePause,
    score: doc.score,
    ballsLeft: doc.ballsLeft,
    ball: doc.ball,
    plunger: doc.plunger,
    nudge: doc.nudge,
    gates: doc.gates,
    chain: doc.chain,
    live: doc.live,
    mechanisms: doc.mechanisms.map((m) => ({
      id: m.id,
      up: m.up,
      openMs: m.openMs,
      lit: m.lit,
      lamp: m.lamp,
      cooldownMs: m.cooldownMs,
    })),
    note: doc.note,
    run: doc.run,
    career: doc.career,
    historyLength: doc.history.length,
  })
}

function makeFormal(): PinballDocument {
  const doc = createDocument()
  mountFresh(doc, { career: doc.career, history: doc.history, bestScore: 0 })
  return doc
}

function launchFormal(doc: PinballDocument, frames = 4): void {
  const input: FrameInput = { ...idleInput(), plunger: true }
  for (let i = 0; i < frames; i += 1) runFormal(doc, input)
  input.plunger = false
  input.plungerReleased = true
  runFormal(doc, input)
  input.plungerReleased = false
}

function runFormal(doc: PinballDocument, input: FrameInput): void {
  const sessions: LoopSessions = {
    formal: () => doc,
    practice: () => null,
    hooks: { enter: () => {}, exit: () => {}, serve: () => {}, reset: () => {} },
  }
  runFrame(sessions, input, DT)
}

/** 镜像 App.vue 的 enterPractice：先暂停正式局，再建副本。 */
function enterPractice(formal: PinballDocument): PinballDocument {
  if (formal.phase !== 'paused') {
    formal.phaseBeforePause = formal.phase
    formal.phase = 'paused'
  }
  return createPracticeWorkspace(formal)
}

/** 镜像 App.vue 的 exitPractice：恢复进入前的阶段。 */
function exitPractice(formal: PinballDocument): void {
  if (formal.phase === 'paused') {
    formal.phase = formal.phaseBeforePause ?? 'ready'
    formal.phaseBeforePause = null
  }
}

let failures = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures += 1
    console.error(`  ✗ ${name}`)
    console.error(error)
  }
}

// 1. 练习中正式局保持暂停且状态字节级不变
test('练习期间正式局冻结，落靶/闸/连锁/轻推/分数都不写回', () => {
  const formal = makeFormal()
  launchFormal(formal)
  formal.score = 4321
  formal.nudge.warnings = 2
  const beforeEnter = snapshot(formal)

  const practice = enterPractice(formal)
  assert.equal(formal.phase, 'paused', '进入练习后正式局应暂停')
  assert.ok(practice.practice, '副本带练习标记')
  assert.equal(practice.score, 0, '练习分数单独从 0 开始')
  const pausedSnapshot = snapshot(formal)

  const sessions: LoopSessions = {
    formal: () => formal,
    practice: () => practice,
    hooks: {
      enter: () => {},
      exit: () => {},
      serve: () => servePractice(practice),
      reset: () => {},
    },
  }

  // 在练习里模拟大量帧，期间触发轻推，并等落靶重置开闸逻辑跑起来
  for (let i = 0; i < 1200; i += 1) {
    const input: FrameInput = { ...idleInput() }
    if (i === 10 || i === 20 || i === 30) {
      input.nudgeLeft = true
    }
    runFrame(sessions, input, DT)
  }

  assert.equal(snapshot(formal), pausedSnapshot, '练习期间正式局（含暂停标记）逐字节不变')
  assert.equal(formal.phase, 'paused')
  assert.equal(formal.nudge.warnings, 2, '正式局轻推次数原样保留')
  assert.equal(formal.score, 4321, '正式局分数原样保留')
  assert.equal(formal.career.score10k, false, '练习不点亮生涯徽章')
  assert.equal(formal.history.length, 0, '练习不写历史')

  exitPractice(formal)
  assert.equal(snapshot(formal), beforeEnter, '退出后正式局完整恢复到进入前的状态')
})

// 2. 练习副本与正式局是两份独立台面
test('练习打落的靶只影响副本', () => {
  const formal = makeFormal()
  const practice = enterPractice(formal)
  const dropId = practice.mechanisms.find((m) => m.kind === 'drop')!.id
  const pDrop = practice.mechanisms.find((m) => m.id === dropId)!
  const fDrop = formal.mechanisms.find((m) => m.id === dropId)!
  assert.equal(pDrop.up, true)
  pDrop.up = false
  assert.equal(fDrop.up, true, '改副本不能动正式局的落靶')
  assert.notEqual(pDrop, fDrop)
})

// 3. 退出练习：正式局恢复原阶段，球与倒计时等原样还在；待发局进入再退出仍是待发
test('退出后正式局恢复到进入前的阶段', () => {
  const playing = makeFormal()
  launchFormal(playing)
  assert.equal(playing.phase, 'playing')
  const beforePlay = snapshot(playing)
  enterPractice(playing)
  assert.equal(playing.phase, 'paused')
  exitPractice(playing)
  assert.equal(playing.phase, 'playing')
  assert.equal(snapshot(playing), beforePlay)

  const ready = makeFormal()
  assert.equal(ready.phase, 'ready')
  const beforeReady = snapshot(ready)
  const p2 = enterPractice(ready)
  assert.equal(ready.phase, 'paused')
  exitPractice(ready)
  assert.equal(ready.phase, 'ready', '正式局还没发射过时，退出后仍是待发')
  assert.equal(snapshot(ready), beforeReady)
  assert.ok(p2)
})

// 4. 无限发球与练习落袋：不减正式球数，练习计数器工作
test('练习无限发球、落袋重发，不动正式球数', () => {
  const formal = makeFormal()
  launchFormal(formal)
  const practice = enterPractice(formal)
  // 把出生点显式放到台面内部（而非发射槽），让练习球真正进入台面
  setPracticeSpawn(practice, clampSpawn(200, 300))
  const firstServed = practice.practice!.ballsServed
  servePractice(practice)
  servePractice(practice)
  assert.equal(practice.practice!.ballsServed, firstServed + 2)
  assert.equal(practice.ballsLeft, formal.ballsLeft)
  assert.equal(practice.ball.held, 'none')
  const leftBefore = formal.ballsLeft
  // 模拟练习球落袋
  practice.signals.drain = true
  runPracticeFrame(practice, idleInput(), DT)
  assert.equal(practice.signals.drain, false, '落袋信号被练习逻辑消费')
  assert.equal(practice.practice!.ballsServed, firstServed + 3, '落袋自动再发一颗')
  assert.equal(formal.ballsLeft, leftBefore, '正式球数不变')
  exitPractice(formal)
})

// 5. 出生点选择：发射槽 vs 台面内部；重置练习回到入场快照并保留出生点
test('出生点约束与练习重置', () => {
  const plunger = clampSpawn(380, 640)
  assert.equal(plunger.x, 372, '发射槽纵列归一到发射位')
  const inside = clampSpawn(10, 9999)
  assert.equal(inside.x, 20)
  assert.equal(inside.y, 700)

  const formal = makeFormal()
  formal.score = 999
  const practice = enterPractice(formal)
  // 练习里打一些分数、改落靶
  practice.score = 2468
  const drop = practice.mechanisms.find((m) => m.kind === 'drop')!
  drop.up = false
  const spawn = clampSpawn(120, 400)
  setPracticeSpawn(practice, spawn)

  const reset = restartPractice(formal, practice)
  assert.equal(reset.score, 0, '重置后练习分数清零')
  assert.equal(reset.mechanisms.find((m) => m.id === drop.id)!.up, true, '台面回到入场快照')
  assert.equal(reset.practice!.spawnX, 120, '出生点选择被保留')
  assert.equal(reset.practice!.spawnY, 400)
  assert.equal(formal.score, 999, '重置练习不影响正式局')
  exitPractice(formal)
})

// 6. 计分只记在练习副本上，正式局分数不变；生涯不被练习触发
test('练习计分与生涯隔离', () => {
  const formal = makeFormal()
  const practice = enterPractice(formal)
  practice.score = 15000
  // 同步逻辑从未在练习帧中调用，这里直接验证 latchCareer 不会因练习分数被触发：
  // 正式生涯字段保持初始值
  assert.equal(formal.career.score10k, false)
  assert.equal(formal.score, 0)
  // structuredClone 生成独立深拷贝，副本里的生涯改动碰不到正式局
  assert.notEqual(practice.career, formal.career)
  practice.career.score10k = true
  assert.equal(formal.career.score10k, false, '练习里点亮的徽章不写回正式局')
  exitPractice(formal)
})

// 7. 输入命令路由：练习中暂停键走退出钩子，而不是切换正式局暂停
test('命令路由：练习中 pause/restart 不触碰正式局', () => {
  const formal = makeFormal()
  launchFormal(formal)
  const practice = enterPractice(formal)
  const formalBefore = snapshot(formal)
  let exited = false
  let reset = false
  const sessions: LoopSessions = {
    formal: () => formal,
    practice: () => practice,
    hooks: {
      enter: () => {},
      exit: () => {
        exited = true
      },
      serve: () => {},
      reset: () => {
        reset = true
      },
    },
  }
  runFrame(sessions, { ...idleInput(), pauseEdge: true }, DT)
  assert.equal(exited, true, '练习中暂停键触发退出钩子')
  runFrame(sessions, { ...idleInput(), restartEdge: true }, DT)
  assert.equal(reset, true, '练习中重开键触发重置练习钩子')
  assert.equal(snapshot(formal), formalBefore, '正式局未被命令改动')
})

// 8. R 键（practice-serve）经命令路由调用发球钩子，且只发一颗
test('R 键触发一次发球，正式局不受影响', () => {
  const formal = makeFormal()
  launchFormal(formal)
  const practice = enterPractice(formal)
  setPracticeSpawn(practice, clampSpawn(200, 300))
  const servedBefore = practice.practice!.ballsServed
  let serveCalls = 0
  const sessions: LoopSessions = {
    formal: () => formal,
    practice: () => practice,
    hooks: {
      enter: () => {},
      exit: () => {},
      serve: () => {
        serveCalls += 1
        servePractice(practice)
      },
      reset: () => {},
    },
  }
  runFrame(sessions, { ...idleInput(), serveEdge: true }, DT)
  assert.equal(serveCalls, 1, '一次 R 键只触发一次发球')
  assert.equal(practice.practice!.ballsServed, servedBefore + 1)
  assert.equal(formal.ballsLeft, 3)
  exitPractice(formal)
})

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 个失败`)
process.exit(failures === 0 ? 0 : 1)
