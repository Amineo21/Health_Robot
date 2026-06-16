import { useState, useRef, useEffect } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

interface RobotJoystickProps {
  disabled?: boolean
  onTeleop?: (payload: { linear_x: number; angular_z: number; duration_ms: number }) => Promise<void> | void
}

export function RobotJoystick({ disabled = false, onTeleop }: RobotJoystickProps) {
  const [direction, setDirection] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPressed, setIsPressed] = useState(false)

  const emitTeleop = (x: number, y: number) => {
    const linear_x = y < 0 ? 0.1 : y > 0 ? -0.1 : 0
    const angular_z = x < 0 ? 0.2 : x > 0 ? -0.2 : 0
    void onTeleop?.({ linear_x, angular_z, duration_ms: 300 })
  }

  const handleMouseDown = (x: number, y: number) => {
    if (disabled) {
      return
    }

    setIsPressed(true)
    setDirection({ x, y })
    emitTeleop(x, y)
  }

  const handleMouseUp = () => {
    if (isPressed) {
      emitTeleop(0, 0)
    }

    setIsPressed(false)
    setDirection(null)
  }

  useEffect(() => {
    if (isPressed) {
      window.addEventListener('mouseup', handleMouseUp)
      return () => window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isPressed])

  const directionMap: Record<string, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }

  const isActive = (key: string) => {
    if (!direction) return false
    const dir = directionMap[key]
    return direction.x === dir.x && direction.y === dir.y
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-4"
    >
      <div className="grid grid-cols-3 gap-2">
        {/* Top padding */}
        <div></div>

        {/* Up Button */}
        <button
          onMouseDown={() => handleMouseDown(0, -1)}
          onTouchStart={() => handleMouseDown(0, -1)}
          onTouchEnd={handleMouseUp}
          disabled={disabled}
          className={`p-4 rounded-lg transition-all ${
            isActive('up')
              ? 'bg-cyan-500 text-white scale-110'
              : 'bg-white/10 text-cyan-400 hover:bg-white/20'
          }`}
        >
          <ArrowUp className="h-8 w-8" />
        </button>

        {/* Top padding */}
        <div></div>

        {/* Left Button */}
        <button
          onMouseDown={() => handleMouseDown(-1, 0)}
          onTouchStart={() => handleMouseDown(-1, 0)}
          onTouchEnd={handleMouseUp}
          disabled={disabled}
          className={`p-4 rounded-lg transition-all ${
            isActive('left')
              ? 'bg-cyan-500 text-white scale-110'
              : 'bg-white/10 text-cyan-400 hover:bg-white/20'
          }`}
        >
          <ArrowLeft className="h-8 w-8" />
        </button>

        {/* Center - Speed indicator */}
        <div className="flex items-center justify-center p-4 rounded-lg bg-white/5 border border-cyan-400/20">
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {direction ? Math.round(Math.sqrt(direction.x ** 2 + direction.y ** 2) * 100) : 0}
            </div>
            <div className="text-xs text-slate-400">%</div>
          </div>
        </div>

        {/* Right Button */}
        <button
          onMouseDown={() => handleMouseDown(1, 0)}
          onTouchStart={() => handleMouseDown(1, 0)}
          onTouchEnd={handleMouseUp}
          disabled={disabled}
          className={`p-4 rounded-lg transition-all ${
            isActive('right')
              ? 'bg-cyan-500 text-white scale-110'
              : 'bg-white/10 text-cyan-400 hover:bg-white/20'
          }`}
        >
          <ArrowRight className="h-8 w-8" />
        </button>

        {/* Bottom padding */}
        <div></div>

        {/* Down Button */}
        <button
          onMouseDown={() => handleMouseDown(0, 1)}
          onTouchStart={() => handleMouseDown(0, 1)}
          onTouchEnd={handleMouseUp}
          disabled={disabled}
          className={`p-4 rounded-lg transition-all ${
            isActive('down')
              ? 'bg-cyan-500 text-white scale-110'
              : 'bg-white/10 text-cyan-400 hover:bg-white/20'
          }`}
        >
          <ArrowDown className="h-8 w-8" />
        </button>

        {/* Bottom padding */}
        <div></div>
      </div>

      <div className="text-center text-sm text-slate-400">
        {isActive('up') && 'Moving Forward'}
        {isActive('down') && 'Moving Backward'}
        {isActive('left') && 'Turning Left'}
        {isActive('right') && 'Turning Right'}
        {disabled && 'Teleop reserved for admins'}
        {!disabled && !direction && 'Ready for control'}
      </div>
    </div>
  )
}
