import { commandFromInput, type FrameInput } from '@/shared/commands'
import type { PinballDocument } from '@/shared/document'
import { absorbZones, tickBonus } from '@/features/bonus'
import { advanceControls } from '@/features/flippers'
import { persist, syncRecords } from '@/features/records'
import { runPracticeFrame } from '@/features/practice'
import { simulateBall } from '@/features/scoring'
import { anchors, consumeContacts, publishGates, sampleRamp, sampleScoop, stickPlunger, syncTable } from '@/features/table'
import { applyDrain, restartGame, togglePause } from '@/app/cabinet-actions'

export interface PracticeHooks {
  enter: () => void
  exit: () => void
  serve: () => void
  reset: () => void
}

export interface LoopSessions {
  formal: () => PinballDocument
  practice: () => PinballDocument | null
  hooks: PracticeHooks
}

function runFormalFrame(doc: PinballDocument, input: FrameInput, dtMs: number): void {
  if (doc.phase !== 'paused' && doc.note.ms > 0) doc.note.ms -= dtMs
  if (doc.phase === 'paused' || doc.phase === 'gameover') return

  advanceControls(doc, input, dtMs, anchors())
  if (doc.ball.held === 'plunger') stickPlunger(doc)
  if (doc.phase !== 'playing') return

  doc.run.playMs += dtMs
  tickBonus(doc, dtMs)
  const solids = syncTable(doc, dtMs)
  if (doc.ball.held !== 'plunger') {
    const events = simulateBall(doc, solids, dtMs, { ramp: sampleRamp, scoop: sampleScoop })
    consumeContacts(doc, events)
    absorbZones(doc, events)
    publishGates(doc)
    if (doc.signals.drain) applyDrain(doc)
  }
  syncRecords(doc)
}

export function runFrame(sessions: LoopSessions, input: FrameInput, dtMs: number): void {
  const practiceDoc = sessions.practice()

  const command = commandFromInput(input)
  if (command?.type === 'restart') {
    if (practiceDoc) {
      sessions.hooks.reset()
      return
    }
    restartGame(sessions.formal())
    return
  }
  if (command?.type === 'pause-toggle') {
    if (practiceDoc) {
      sessions.hooks.exit()
      return
    }
    togglePause(sessions.formal())
    return
  }
  if (command?.type === 'practice-toggle') {
    if (practiceDoc) sessions.hooks.exit()
    else sessions.hooks.enter()
    return
  }
  if (command?.type === 'practice-serve') {
    if (practiceDoc) sessions.hooks.serve()
    return
  }

  if (practiceDoc) {
    runPracticeFrame(practiceDoc, input, dtMs)
    return
  }
  runFormalFrame(sessions.formal(), input, dtMs)
}

export function startLoop(sessions: LoopSessions, pull: () => FrameInput): () => void {
  let last = performance.now()
  let handle = 0
  const persistFormal = (): void => {
    const practice = sessions.practice()
    if (!practice) persist(sessions.formal())
  }
  const onHide = (): void => {
    if (document.hidden) persistFormal()
  }
  const onLeave = (): void => persistFormal()
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onLeave)
  const tick = (now: number): void => {
    const step = Math.min(32, Math.max(0, now - last))
    last = now
    runFrame(sessions, pull(), step)
    handle = requestAnimationFrame(tick)
  }
  handle = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(handle)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onLeave)
  }
}
