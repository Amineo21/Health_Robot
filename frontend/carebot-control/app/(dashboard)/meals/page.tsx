"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { useRobot } from "@/lib/robot-context"
import { UtensilsCrossed, Clock, Users, CheckCircle, Play } from "lucide-react"
import { cn } from "@/lib/utils"

const mealSchedule = [
  { id: "breakfast", name: "Breakfast", time: "07:30", status: "completed" },
  { id: "lunch", name: "Lunch", time: "12:00", status: "in-progress" },
  { id: "snack", name: "Afternoon Snack", time: "15:30", status: "pending" },
  { id: "dinner", name: "Dinner", time: "18:30", status: "pending" },
]

const rooms = [
  { id: "101", resident: "Marie D.", delivered: true },
  { id: "102", resident: "Jean P.", delivered: true },
  { id: "103", resident: "Francoise M.", delivered: false },
  { id: "201", resident: "Pierre L.", delivered: false },
  { id: "202", resident: "Simone B.", delivered: false },
  { id: "203", resident: "Henri R.", delivered: false },
]

export default function MealsPage() {
  const { addMission, missions } = useRobot()
  const [selectedRooms, setSelectedRooms] = useState<string[]>([])

  const mealMissions = missions.filter((m) => m.type === "meal")
  const completedMeals = mealMissions.filter((m) => m.status === "completed").length
  const totalResidents = rooms.length
  const deliveredCount = rooms.filter((r) => r.delivered).length
  const progress = (deliveredCount / totalResidents) * 100

  const handleStartDelivery = () => {
    selectedRooms.forEach((roomId) => {
      const room = rooms.find((r) => r.id === roomId)
      if (room) {
        addMission({
          type: "meal",
          destination: `Room ${roomId}`,
          priority: "medium",
          notes: `Meal delivery for ${room.resident}`,
        })
      }
    })
    setSelectedRooms([])
  }

  const toggleRoom = (roomId: string) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Distribution</h1>
        <p className="text-muted-foreground">
          Manage and track meal deliveries to residents
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Meals Today</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedMeals}</div>
            <p className="text-xs text-muted-foreground">Deliveries completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current Meal</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Lunch</div>
            <p className="text-xs text-muted-foreground">Distribution in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Residents Served</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliveredCount}/{totalResidents}
            </div>
            <Progress value={progress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">100%</div>
            <p className="text-xs text-muted-foreground">On-time delivery</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meal Schedule</CardTitle>
            <CardDescription>Daily meal distribution times</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mealSchedule.map((meal) => (
                <div
                  key={meal.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        meal.status === "completed"
                          ? "bg-green-500/10"
                          : meal.status === "in-progress"
                          ? "bg-blue-500/10"
                          : "bg-muted"
                      )}
                    >
                      {meal.status === "completed" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : meal.status === "in-progress" ? (
                        <Play className="h-5 w-5 text-blue-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{meal.name}</p>
                      <p className="text-sm text-muted-foreground">{meal.time}</p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      meal.status === "completed"
                        ? "bg-green-500/10 text-green-500"
                        : meal.status === "in-progress"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {meal.status === "in-progress" ? "In Progress" : meal.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Room Deliveries</CardTitle>
                <CardDescription>Select rooms for meal delivery</CardDescription>
              </div>
              <Button
                size="sm"
                disabled={selectedRooms.length === 0}
                onClick={handleStartDelivery}
              >
                Start Delivery ({selectedRooms.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                    room.delivered && "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={room.id}
                      checked={selectedRooms.includes(room.id)}
                      onCheckedChange={() => toggleRoom(room.id)}
                      disabled={room.delivered}
                    />
                    <label
                      htmlFor={room.id}
                      className="flex flex-col cursor-pointer"
                    >
                      <span className="font-medium">Room {room.id}</span>
                      <span className="text-sm text-muted-foreground">
                        {room.resident}
                      </span>
                    </label>
                  </div>
                  {room.delivered && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      Delivered
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
