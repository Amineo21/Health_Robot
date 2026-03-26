"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRobot } from "@/lib/robot-context"
import { Bot, MapPin, Navigation } from "lucide-react"

export default function MapPage() {
  const { telemetry, activeMission, status } = useRobot()

  // Simulated floor plan rooms
  const rooms = [
    { id: "101", x: 10, y: 15, w: 18, h: 20 },
    { id: "102", x: 32, y: 15, w: 18, h: 20 },
    { id: "103", x: 54, y: 15, w: 18, h: 20 },
    { id: "201", x: 10, y: 45, w: 18, h: 20 },
    { id: "202", x: 32, y: 45, w: 18, h: 20 },
    { id: "203", x: 54, y: 45, w: 18, h: 20 },
    { id: "nurses", x: 78, y: 15, w: 18, h: 25, label: "Nurses" },
    { id: "pharmacy", x: 78, y: 45, w: 18, h: 20, label: "Pharmacy" },
  ]

  // Normalize robot position to SVG coordinates
  const robotX = ((telemetry.position.x % 20) / 20) * 80 + 10
  const robotY = ((telemetry.position.y % 12) / 12) * 60 + 10

  // Destination position (if active mission)
  const getDestinationCoords = () => {
    if (!activeMission) return null
    const roomNum = activeMission.destination.replace("Room ", "")
    const room = rooms.find((r) => r.id === roomNum)
    if (room) {
      return { x: room.x + room.w / 2, y: room.y + room.h / 2 }
    }
    return null
  }

  const destination = getDestinationCoords()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Map</h1>
        <p className="text-muted-foreground">
          Real-time robot position and navigation
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 order-1 lg:order-none">
          <Card>
            <CardHeader>
              <CardTitle>Floor Plan - Level {telemetry.position.floor}</CardTitle>
              <CardDescription>
                Live robot tracking with mission path overlay
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-[16/10] bg-muted rounded-lg overflow-hidden border">
                <svg
                  viewBox="0 0 100 80"
                  className="w-full h-full"
                  style={{ background: "var(--muted)" }}
                >
                  {/* Grid pattern */}
                  <defs>
                    <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                      <path
                        d="M 5 0 L 0 0 0 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.1"
                        className="text-border"
                      />
                    </pattern>
                  </defs>
                  <rect width="100" height="80" fill="url(#grid)" />

                  {/* Hallway */}
                  <rect
                    x="5"
                    y="37"
                    width="90"
                    height="6"
                    fill="currentColor"
                    className="text-background"
                    stroke="currentColor"
                    strokeWidth="0.3"
                  />

                  {/* Rooms */}
                  {rooms.map((room) => (
                    <g key={room.id}>
                      <rect
                        x={room.x}
                        y={room.y}
                        width={room.w}
                        height={room.h}
                        fill="currentColor"
                        className="text-background"
                        stroke="currentColor"
                        strokeWidth="0.4"
                        rx="1"
                      />
                      <text
                        x={room.x + room.w / 2}
                        y={room.y + room.h / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[3px] fill-muted-foreground font-medium"
                      >
                        {room.label || `Room ${room.id}`}
                      </text>
                    </g>
                  ))}

                  {/* Mission path */}
                  {destination && (
                    <>
                      <line
                        x1={robotX}
                        y1={robotY}
                        x2={destination.x}
                        y2={destination.y}
                        stroke="currentColor"
                        strokeWidth="0.5"
                        strokeDasharray="2,1"
                        className="text-primary"
                      />
                      {/* Destination marker */}
                      <circle
                        cx={destination.x}
                        cy={destination.y}
                        r="3"
                        fill="currentColor"
                        className="text-primary/30"
                      />
                      <circle
                        cx={destination.x}
                        cy={destination.y}
                        r="1.5"
                        fill="currentColor"
                        className="text-primary"
                      />
                    </>
                  )}

                  {/* Robot position */}
                  <g transform={`translate(${robotX}, ${robotY})`}>
                    {/* Outer glow */}
                    <circle
                      r="4"
                      fill="currentColor"
                      className={status === "delivering" ? "text-green-500/20" : "text-primary/20"}
                    >
                      <animate
                        attributeName="r"
                        values="3;5;3"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Robot icon */}
                    <circle
                      r="2.5"
                      fill="currentColor"
                      className={status === "delivering" ? "text-green-500" : "text-primary"}
                    />
                    <circle
                      r="1.2"
                      fill="currentColor"
                      className="text-primary-foreground"
                    />
                  </g>
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 order-2 lg:order-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6 lg:gap-6">
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                Robot Position
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 pt-0">
              <div className="grid grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">X Position</p>
                  <p className="text-lg font-mono font-semibold">
                    {telemetry.position.x.toFixed(2)}m
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Y Position</p>
                  <p className="text-lg font-mono font-semibold">
                    {telemetry.position.y.toFixed(2)}m
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Floor Level</p>
                <p className="text-lg font-mono font-semibold">
                  Level {telemetry.position.floor}
                </p>
              </div>
            </CardContent>
          </Card>

          {activeMission && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5" />
                  Active Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Destination</span>
                  <span className="font-medium">{activeMission.destination}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <Badge variant="outline" className="capitalize">
                    {activeMission.type}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                    In Progress
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Map Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-primary" />
                <span className="text-sm">Robot Position</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-primary/30 ring-2 ring-primary" />
                <span className="text-sm">Destination</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-0.5 w-4 border-t-2 border-dashed border-primary" />
                <span className="text-sm">Mission Path</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-background border" />
                <span className="text-sm">Room / Area</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
