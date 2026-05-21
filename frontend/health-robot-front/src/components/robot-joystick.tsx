'use client'

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'

function ControlButton({
  children,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onClick,
  isActive,
}: {
  children: React.ReactNode
  onMouseDown?: () => void
  onMouseUp?: () => void
  onMouseLeave?: () => void
  onTouchStart?: () => void
  onTouchEnd?: () => void
  onClick?: () => void
  isActive?: boolean
}) {
  return (
    <button
      type="button"
      className={`btn-control ${isActive ? 'btn-control-active' : ''} hover:shadow-glow`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function RobotJoystick() {
  const { sendCommand } = useRobot()

  const handleStart = (command: 'forward' | 'backward' | 'left' | 'right') => {
    sendCommand(command)
  }

  const handleEnd = () => {
    sendCommand('stop')
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <ControlButton
        isActive
        onMouseDown={() => handleStart('forward')}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={() => handleStart('forward')}
        onTouchEnd={handleEnd}
      >
        <ArrowUp className="h-6 w-6" />
      </ControlButton>

      <div className="flex items-center gap-3">
        <ControlButton
          isActive
          onMouseDown={() => handleStart('left')}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={() => handleStart('left')}
          onTouchEnd={handleEnd}
        >
          <ArrowLeft className="h-6 w-6" />
        </ControlButton>

        <ControlButton onClick={() => sendCommand('stop')}>
          <Square className="h-5 w-5" />
        </ControlButton>

        <ControlButton
          isActive
          onMouseDown={() => handleStart('right')}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={() => handleStart('right')}
          onTouchEnd={handleEnd}
        >
          <ArrowRight className="h-6 w-6" />
        </ControlButton>
      </div>

      <ControlButton
        isActive
        onMouseDown={() => handleStart('backward')}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={() => handleStart('backward')}
        onTouchEnd={handleEnd}
      >
        <ArrowDown className="h-6 w-6" />
      </ControlButton>
    </div>
  )
}