import type { TeleopPayload } from './robot-api'

export const TELEOP_LINEAR_SPEED_MPS = 0.2
export const TELEOP_ANGULAR_SPEED_RAD_S = 0.8
export const TELEOP_COMMAND_INTERVAL_MS = 250
export const TELEOP_COMMAND_DURATION_MS = 500

export type TeleopDirection = 'forward' | 'backward' | 'left' | 'right' | 'stop'

export function teleopDirectionFromKey(key: string): TeleopDirection | null {
  switch (key.toLowerCase()) {
    case 'z':
    case 'arrowup':
      return 'forward'
    case 's':
    case 'arrowdown':
      return 'backward'
    case 'q':
    case 'arrowleft':
      return 'left'
    case 'd':
    case 'arrowright':
      return 'right'
    case ' ':
    case 'spacebar':
      return 'stop'
    default:
      return null
  }
}

export function buildTeleopPayload(directions: ReadonlySet<TeleopDirection>): TeleopPayload {
  let linearX = 0
  let angularZ = 0

  if (directions.has('forward')) linearX += TELEOP_LINEAR_SPEED_MPS
  if (directions.has('backward')) linearX -= TELEOP_LINEAR_SPEED_MPS
  if (directions.has('left')) angularZ += TELEOP_ANGULAR_SPEED_RAD_S
  if (directions.has('right')) angularZ -= TELEOP_ANGULAR_SPEED_RAD_S

  if (directions.has('stop')) {
    linearX = 0
    angularZ = 0
  }

  return {
    linear_x: Number(linearX.toFixed(3)),
    angular_z: Number(angularZ.toFixed(3)),
    duration_ms: TELEOP_COMMAND_DURATION_MS,
  }
}

export function buildStopTeleopPayload(): TeleopPayload {
  return { linear_x: 0, angular_z: 0, duration_ms: 300 }
}

export function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
