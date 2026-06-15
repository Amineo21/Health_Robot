import { useState, useRef, useEffect } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

export function RobotJoystick() {
  const [direction, setDirection] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPressed, setIsPressed] = useState(false)

  const handleMouseDown = (x: number, y: number) => {
    setIsPressed(true)
    setDirection({ x, y })
  }

  const handleMouseUp = () => {
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

  const btnClass = (key: string) =>
    `flex h-14 w-14 items-center justify-center rounded-2xl border text-white transition active:scale-95 select-none cursor-pointer ${
      activeKey === key
        ? 'border-cyan-400/60 bg-cyan-400/30 scale-95'
        : 'border-white/20 bg-white/10 hover:bg-white/20'
    }`

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
        {!direction && 'Ready for control'}
      </div>
    </div>
  )
}
