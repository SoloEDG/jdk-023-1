export interface FrameInput {
  left: boolean
  right: boolean
  plunger: boolean
  plungerReleased: boolean
  nudgeLeft: boolean
  nudgeRight: boolean
  pauseEdge: boolean
  restartEdge: boolean
  practiceEdge: boolean
  serveEdge: boolean
}

export type CabinetCommand =
  | { type: 'pause-toggle' }
  | { type: 'restart' }
  | { type: 'practice-toggle' }
  | { type: 'practice-serve' }

export function commandFromInput(input: FrameInput): CabinetCommand | null {
  if (input.restartEdge) return { type: 'restart' }
  if (input.pauseEdge) return { type: 'pause-toggle' }
  if (input.practiceEdge) return { type: 'practice-toggle' }
  if (input.serveEdge) return { type: 'practice-serve' }
  return null
}

export function idleInput(): FrameInput {
  return {
    left: false,
    right: false,
    plunger: false,
    plungerReleased: false,
    nudgeLeft: false,
    nudgeRight: false,
    pauseEdge: false,
    restartEdge: false,
    practiceEdge: false,
    serveEdge: false,
  }
}
