"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRobot, type MissionType } from "@/lib/robot-context"
import { Plus, X, Play, CheckCircle, Clock, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const rooms = [
  "Room 101", "Room 102", "Room 103",
  "Room 201", "Room 202", "Room 203",
  "Room 301", "Room 302", "Room 303",
  "Nurses Station", "Pharmacy", "Kitchen"
]

const statusConfig = {
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  "in-progress": { icon: Play, color: "text-blue-500", bg: "bg-blue-500/10" },
  completed: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  cancelled: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
}

const priorityConfig = {
  low: { color: "text-muted-foreground", bg: "bg-muted" },
  medium: { color: "text-yellow-500", bg: "bg-yellow-500/10" },
  high: { color: "text-red-500", bg: "bg-red-500/10" },
}

export default function MissionsPage() {
  const { missions, addMission, cancelMission } = useRobot()
  const [open, setOpen] = useState(false)
  const [newMission, setNewMission] = useState({
    type: "medical" as MissionType,
    destination: "",
    priority: "medium" as "low" | "medium" | "high",
    notes: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMission.destination) return

    addMission({
      type: newMission.type,
      destination: newMission.destination,
      priority: newMission.priority,
      notes: newMission.notes || undefined,
    })

    setNewMission({
      type: "medical",
      destination: "",
      priority: "medium",
      notes: "",
    })
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
          <p className="text-muted-foreground">
            Create and manage robot delivery missions
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              New Mission
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Mission</DialogTitle>
              <DialogDescription>
                Send the robot on a new delivery mission
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Mission Type</Label>
                  <Select
                    value={newMission.type}
                    onValueChange={(v) => setNewMission({ ...newMission, type: v as MissionType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medical">Medical Delivery</SelectItem>
                      <SelectItem value="meal">Meal Distribution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Room</Label>
                  <Select
                    value={newMission.destination}
                    onValueChange={(v) => setNewMission({ ...newMission, destination: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room} value={room}>
                          {room}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newMission.priority}
                    onValueChange={(v) => setNewMission({ ...newMission, priority: v as "low" | "medium" | "high" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any special instructions..."
                    value={newMission.notes}
                    onChange={(e) => setNewMission({ ...newMission, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!newMission.destination}>
                  Send Mission
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mission History</CardTitle>
          <CardDescription>
            View all past and current delivery missions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {/* Mobile Cards View */}
          <div className="block lg:hidden space-y-3 p-4 sm:p-0">
            {missions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No missions yet. Create your first mission to get started.
              </div>
            ) : (
              missions.map((mission) => {
                const StatusIcon = statusConfig[mission.status].icon
                return (
                  <div key={mission.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{mission.destination}</p>
                        <p className="text-xs text-muted-foreground font-mono">{mission.id}</p>
                      </div>
                      {(mission.status === "pending" || mission.status === "in-progress") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelMission(mission.id)}
                          className="text-destructive hover:text-destructive -mt-1 -mr-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">{mission.type}</Badge>
                      <Badge
                        variant="secondary"
                        className={cn("capitalize", priorityConfig[mission.priority].bg, priorityConfig[mission.priority].color)}
                      >
                        {mission.priority}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className={cn("h-3.5 w-3.5", statusConfig[mission.status].color)} />
                        <span className="capitalize text-xs">{mission.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Started: {mission.startTime.toLocaleTimeString()}
                    </p>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No missions yet. Create your first mission to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  missions.map((mission) => {
                    const StatusIcon = statusConfig[mission.status].icon
                    return (
                      <TableRow key={mission.id}>
                        <TableCell className="font-mono text-sm">{mission.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {mission.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{mission.destination}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "capitalize",
                              priorityConfig[mission.priority].bg,
                              priorityConfig[mission.priority].color
                            )}
                          >
                            {mission.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={cn("h-4 w-4", statusConfig[mission.status].color)} />
                            <span className="capitalize text-sm">{mission.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {mission.startTime.toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {(mission.status === "pending" || mission.status === "in-progress") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelMission(mission.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Cancel mission</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
