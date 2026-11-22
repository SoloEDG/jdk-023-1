import type { FrameInput } from '@/shared/commands'
import type { PinballDocument } from '@/shared/document'
import { absorbZones, tickBonus } from '@/features/bonus'
import { advanceControls } from '@/features/flippers'
import { simulateBall } from '@/features/scoring'
import {
  anchors,
  consumeContacts,
  publishGates,
  sampleRamp,
  sampleScoop,
  stickPlunger,
  syncTable,
} from '@/features/table'
import { applyPracticeDrain } from '@/features/practice/model/practice-session'

/**
 * 练习帧：与正式局共用同一套物理、机关与计分代码，但作用在独立副本上，
 * 不调用 syncRecords / commitSession / persist，因此不写历史、不点亮生涯、不落盘。
 */
export function runPracticeFrame(doc: PinballDocument, input: FrameInput, dtMs: number): void {
  if (doc.note.ms > 0) doc.note.ms -= dtMs

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
    if (doc.signals.drain) applyPracticeDrain(doc)
  }
}
