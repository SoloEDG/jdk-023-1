import { flashNote, type PinballDocument, type PracticeMeta } from '@/shared/document'
import { VIEW, plungerSeat, stickPlunger } from '@/features/table/lib/playfield-layout'
import { clearChain } from '@/features/bonus'
import { clearWarnings } from '@/features/flippers'

export interface SpawnPoint {
  label: string
  x: number
  y: number
}

const SPAWN_MARGIN = 20
const SERVE_SPEED = 60

export const spawnPresets: SpawnPoint[] = [
  { label: '上区', x: 200, y: 120 },
  { label: '弹力柱', x: 206, y: 250 },
  { label: '转轮', x: 250, y: 386 },
  { label: '下挡板', x: 200, y: 560 },
]

export function isPractice(doc: PinballDocument): boolean {
  return doc.practice !== null
}

export function practiceMeta(doc: PinballDocument): PracticeMeta {
  if (!doc.practice) throw new Error('practice meta missing')
  return doc.practice
}

function plungerSpawn(): SpawnPoint {
  return { label: '发射槽', x: plungerSeat.x, y: plungerSeat.restY }
}

/** 把点击位置约束在台面内部；落在发射槽纵列时归一到发射位。 */
export function clampSpawn(x: number, y: number): SpawnPoint {
  const cx = Math.min(VIEW.w - SPAWN_MARGIN, Math.max(SPAWN_MARGIN, x))
  const cy = Math.min(VIEW.h - SPAWN_MARGIN, Math.max(SPAWN_MARGIN, y))
  if (cx >= 352) return plungerSpawn()
  return { label: '自选点', x: Math.round(cx), y: Math.round(cy) }
}

/**
 * 从当前正式台面复制一份练习工作台。
 * 深拷贝保证练习里打落的靶、打开的闸、连锁和分数都不可能写回正式局；
 * 练习分数、动态播报、单局目标与计时全部归零，不触碰生涯与历史。
 */
export function createPracticeWorkspace(formal: PinballDocument): PinballDocument {
  const clone = structuredClone(formal) as PinballDocument
  clone.score = 0
  clone.feed = []
  clone.feedSeq = 0
  clone.run = { launched: false, committed: false, playMs: 0, storedScore: 0, storageWarned: false }
  clone.live = {
    bonusEntries: 0,
    bankClears: 0,
    tilted: false,
    bankPending: false,
    bankResetMs: 0,
  }
  const atPlunger = clone.ball.held === 'plunger'
  const spawn = atPlunger ? plungerSpawn() : { label: '当前球位', x: clone.ball.x, y: clone.ball.y }
  clone.practice = {
    ballsServed: 0,
    spawnX: spawn.x,
    spawnY: spawn.y,
    atPlunger: atPlunger || spawn.x >= 352,
  }
  clone.phase = 'ready'
  clone.phaseBeforePause = null
  clone.signals.drain = false
  clone.note = { text: '', ms: 0 }
  flashNote(clone, '练习模式：不计分、不记历史')
  servePractice(clone)
  return clone
}

/** 无限发球：在当前出生点重新放出一颗练习球，不计球数。 */
export function servePractice(doc: PinballDocument): void {
  const meta = practiceMeta(doc)
  meta.ballsServed += 1
  clearChain(doc)
  clearWarnings(doc)
  doc.plunger.power = 0
  doc.plunger.charging = false
  doc.signals.drain = false
  doc.ball.rideMs = 0
  doc.ball.rideDur = 1
  doc.ball.holdMs = 0
  doc.ball.idleMs = 0
  doc.phase = 'playing'
  if (meta.atPlunger) {
    stickPlunger(doc)
    doc.phase = 'ready'
    return
  }
  doc.ball.held = 'none'
  doc.ball.x = meta.spawnX
  doc.ball.y = meta.spawnY
  doc.ball.vx = 0
  doc.ball.vy = SERVE_SPEED
}

export function setPracticeSpawn(doc: PinballDocument, point: SpawnPoint): void {
  const meta = practiceMeta(doc)
  meta.atPlunger = point.x >= 352
  meta.spawnX = point.x
  meta.spawnY = point.y
  servePractice(doc)
}

/** 练习球落袋：不减球、不结算，只在当前出生点再放一颗。 */
export function applyPracticeDrain(doc: PinballDocument): void {
  doc.signals.drain = false
  servePractice(doc)
  flashNote(doc, '练习球重发')
}

/** 重置练习：回到进入练习那一刻的台面快照，但保留已选出生点。 */
export function restartPractice(formal: PinballDocument, previous: PinballDocument): PinballDocument {
  const spawn = {
    x: practiceMeta(previous).spawnX,
    y: practiceMeta(previous).spawnY,
    atPlunger: previous.practice!.atPlunger,
  }
  const next = createPracticeWorkspace(formal)
  const meta = practiceMeta(next)
  meta.spawnX = spawn.x
  meta.spawnY = spawn.y
  meta.atPlunger = spawn.atPlunger
  // createPracticeWorkspace 已按初始出生点发过一颗球，这里改到保留的出生点再发一次
  servePractice(next)
  return next
}
