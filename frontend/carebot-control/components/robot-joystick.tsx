"use client"

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRobot } from "@/lib/robot-context"

export function RobotJoystick() {
  const { sendCommand } = useRobot()

  const handleStart = (command: "forward" | "backward" | "left" | "right") => {
    sendCommand(command)
  }

  const handleEnd = () => {
    sendCommand("stop")
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <Button
        variant="secondary"
        size="lg"
        className="h-14 w-14 sm:h-16 sm:w-16 active:scale-95 transition-transform"
        onMouseDown={() => handleStart("forward")}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={() => handleStart("forward")}
        onTouchEnd={handleEnd}
      >
        <ArrowUp className="h-6 w-6 sm:h-7 sm:w-7" />
        <span className="sr-only">Move Forward</span>
      </Button>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="h-14 w-14 sm:h-16 sm:w-16 active:scale-95 transition-transform"
          onMouseDown={() => handleStart("left")}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={() => handleStart("left")}
          onTouchEnd={handleEnd}
        >
          <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="sr-only">Turn Left</span>
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-14 w-14 sm:h-16 sm:w-16 active:scale-95 transition-transform"
          onClick={() => sendCommand("stop")}
        >
          <Square className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="sr-only">Stop</span>
        </Button>

        <Button
          variant="secondary"
          size="lg"
          className="h-14 w-14 sm:h-16 sm:w-16 active:scale-95 transition-transform"
          onMouseDown={() => handleStart("right")}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={() => handleStart("right")}
          onTouchEnd={handleEnd}
        >
          <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="sr-only">Turn Right</span>
        </Button>
      </div>

      <Button
        variant="secondary"
        size="lg"
        className="h-14 w-14 sm:h-16 sm:w-16 active:scale-95 transition-transform"
        onMouseDown={() => handleStart("backward")}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={() => handleStart("backward")}
        onTouchEnd={handleEnd}
      >
        <ArrowDown className="h-6 w-6 sm:h-7 sm:w-7" />
        <span className="sr-only">Move Backward</span>
      </Button>
    </div>
  )
}
