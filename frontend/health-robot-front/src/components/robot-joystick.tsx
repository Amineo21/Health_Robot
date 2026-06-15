'use client'

import { useRef } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'

export function RobotJoystick({ activeKey }: { activeKey?: string | null }) {
  const { sendCommand } = useRobot()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleStart = (command: 'forward' | 'backward' | 'left' | 'right') => {
    sendCommand(command)
    intervalRef.current = setInterval(() => sendCommand(command), 150)
  }

  const handleEnd = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    sendCommand('stop')
  }

  const btnClass = (key: string) =>
    `flex h-14 w-14 items-center justify-center rounded-2xl border text-white transition active:scale-95 select-none cursor-pointer ${
      activeKey === key
        ? 'border-cyan-400/60 bg-cyan-400/30 scale-95'
        : 'border-white/20 bg-white/10 hover:bg-white/20'
    }`

  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" className={btnClass('ArrowUp')}
        onMouseDown={() => handleStart('forward')} onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={() => handleStart('forward')} onTouchEnd={handleEnd}>
        <ArrowUp className="h-6 w-6" />
      </button>

      <div className="flex items-center gap-3">
        <button type="button" className={btnClass('ArrowLeft')}
          onMouseDown={() => handleStart('left')} onMouseUp={handleEnd} onMouseLeave={handleEnd}
          onTouchStart={() => handleStart('left')} onTouchEnd={handleEnd}>
          <ArrowLeft className="h-6 w-6" />
        </button>

        <button type="button" className={btnClass('')} onClick={handleEnd}>
          <Square className="h-5 w-5" />
        </button>

        <button type="button" className={btnClass('ArrowRight')}
          onMouseDown={() => handleStart('right')} onMouseUp={handleEnd} onMouseLeave={handleEnd}
          onTouchStart={() => handleStart('right')} onTouchEnd={handleEnd}>
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>

      <button type="button" className={btnClass('ArrowDown')}
        onMouseDown={() => handleStart('backward')} onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={() => handleStart('backward')} onTouchEnd={handleEnd}>
        <ArrowDown className="h-6 w-6" />
      </button>
    </div>
  )
}