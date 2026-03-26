"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RobotJoystick } from "@/components/robot-joystick"
import { useRobot } from "@/lib/robot-context"
import { 
  OctagonX, 
  MapPin, 
  Gauge, 
  Battery, 
  Wifi, 
  Video,
  Bot
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function ControlPage() {
  const { telemetry, status, emergencyStop } = useRobot()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Robot Control</h1>
        <p className="text-muted-foreground">
          Manual control and telemetry monitoring
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Control</CardTitle>
              <CardDescription>
                Use the directional controls to manually navigate the robot
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-8">
              <RobotJoystick />

              <Button
                variant="destructive"
                size="lg"
                className="h-20 w-full sm:h-24 sm:w-56 md:w-64 text-base sm:text-lg font-bold shadow-lg hover:shadow-xl transition-shadow active:scale-95"
                onClick={emergencyStop}
              >
                <OctagonX className="h-6 w-6 sm:h-8 sm:w-8 mr-2" />
                EMERGENCY STOP
              </Button>

              <p className="text-sm text-muted-foreground text-center max-w-md">
                Press and hold directional buttons to move. Release to stop.
                Use the Emergency Stop button to immediately halt all robot operations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Camera Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <div className="text-center">
                  <Bot className="h-16 w-16 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Camera feed placeholder</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Connect to robot for live video stream
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6 lg:gap-0">
          <Card className="lg:mb-0">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Robot Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Position</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">X</p>
                    <p className="text-sm font-mono font-medium">
                      {telemetry.position.x.toFixed(2)}m
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Y</p>
                    <p className="text-sm font-mono font-medium">
                      {telemetry.position.y.toFixed(2)}m
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Floor</p>
                    <p className="text-sm font-mono font-medium">
                      {telemetry.position.floor}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Speed</span>
                  </div>
                  <span className="text-sm font-mono">{telemetry.speed.toFixed(2)} m/s</span>
                </div>
                <Progress 
                  value={(telemetry.speed / 1) * 100} 
                  className="h-2" 
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Battery className={cn(
                      "h-4 w-4",
                      telemetry.battery > 50 ? "text-green-500" : 
                      telemetry.battery > 20 ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-sm font-medium">Battery</span>
                  </div>
                  <span className="text-sm font-mono">{Math.round(telemetry.battery)}%</span>
                </div>
                <Progress 
                  value={telemetry.battery} 
                  className={cn(
                    "h-2",
                    telemetry.battery > 50 ? "[&>div]:bg-green-500" : 
                    telemetry.battery > 20 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
                  )} 
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className={cn(
                      "h-4 w-4",
                      telemetry.connectionQuality > 80 ? "text-green-500" : 
                      telemetry.connectionQuality > 50 ? "text-yellow-500" : "text-red-500"
                    )} />
                    <span className="text-sm font-medium">Connection Quality</span>
                  </div>
                  <span className="text-sm font-mono">{Math.round(telemetry.connectionQuality)}%</span>
                </div>
                <Progress 
                  value={telemetry.connectionQuality} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "rounded-lg p-4 text-center",
                status === "idle" && "bg-muted",
                status === "moving" && "bg-blue-500/10",
                status === "charging" && "bg-yellow-500/10",
                status === "delivering" && "bg-green-500/10"
              )}>
                <p className={cn(
                  "text-2xl font-bold capitalize",
                  status === "idle" && "text-muted-foreground",
                  status === "moving" && "text-blue-500",
                  status === "charging" && "text-yellow-500",
                  status === "delivering" && "text-green-500"
                )}>
                  {status}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {status === "idle" && "Robot is standing by"}
                  {status === "moving" && "Robot is in motion"}
                  {status === "charging" && "Battery is charging"}
                  {status === "delivering" && "Delivery in progress"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
