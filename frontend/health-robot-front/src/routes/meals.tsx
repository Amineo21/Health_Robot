import { useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Clock, Play, UtensilsCrossed, Users } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useRobot } from '@/lib/robot-context'
import { CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const mealSchedule = [
  { id: 'breakfast', name: 'Breakfast', time: '07:30', status: 'completed' },
  { id: 'lunch', name: 'Lunch', time: '12:00', status: 'in-progress' },
  { id: 'snack', name: 'Afternoon Snack', time: '15:30', status: 'pending' },
  { id: 'dinner', name: 'Dinner', time: '18:30', status: 'pending' },
] as const

const rooms = [
  { id: '101', resident: 'Marie D.', delivered: true },
  { id: '102', resident: 'Jean P.', delivered: true },
  { id: '103', resident: 'Francoise M.', delivered: false },
  { id: '201', resident: 'Pierre L.', delivered: false },
  { id: '202', resident: 'Simone B.', delivered: false },
  { id: '203', resident: 'Henri R.', delivered: false },
]

export const Route = createFileRoute('/meals')({ component: MealsRoute })

function MealsRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <MealsPage />
    </ProtectedRoute>
  )
}

function MealsPage() {
  const { addMission, missions } = useRobot()
  const [selectedRooms, setSelectedRooms] = useState<string[]>([])

  const mealMissions = missions.filter((mission) => mission.type === 'meal')
  const completedMeals = mealMissions.filter((mission) => mission.status === 'completed').length
  const totalResidents = rooms.length
  const deliveredCount = rooms.filter((room) => room.delivered).length
  const progress = (deliveredCount / totalResidents) * 100

  const handleStartDelivery = () => {
    selectedRooms.forEach((roomId) => {
      const room = rooms.find((candidate) => candidate.id === roomId)
      if (room) {
        addMission({
          type: 'meal',
          destination: `Room ${roomId}`,
          priority: 'medium',
          notes: `Meal delivery for ${room.resident}`,
        })
      }
    })
    setSelectedRooms([])
  }

  const toggleRoom = (roomId: string) => {
    setSelectedRooms((previous) =>
      previous.includes(roomId) ? previous.filter((value) => value !== roomId) : [...previous, roomId],
    )
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Distribution</h1>
        <p className="text-sm text-slate-400">Manage and track meal deliveries to residents</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Meals Today</p>
              <p className="mt-2 text-3xl font-black text-white">{completedMeals}</p>
            </div>
            <UtensilsCrossed className="h-5 w-5 text-cyan-200" />
          </div>
          <p className="mt-2 text-xs text-slate-400">Deliveries completed</p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Current Meal</p>
              <p className="mt-2 text-3xl font-black text-white">Lunch</p>
            </div>
            <Clock className="h-5 w-5 text-cyan-200" />
          </div>
          <p className="mt-2 text-xs text-slate-400">Distribution in progress</p>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Residents Served</p>
              <p className="mt-2 text-3xl font-black text-white">{deliveredCount}/{totalResidents}</p>
            </div>
            <Users className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Success Rate</p>
              <p className="mt-2 text-3xl font-black text-emerald-200">100%</p>
            </div>
            <CheckCircle className="h-5 w-5 text-emerald-200" />
          </div>
          <p className="mt-2 text-xs text-slate-400">On-time delivery</p>
        </article>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">Meal Schedule</h2>
          <p className="mt-2 text-sm text-slate-400">Daily meal distribution times</p>

          <div className="mt-5 space-y-3">
            {mealSchedule.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', meal.status === 'completed' ? 'bg-emerald-400/10' : meal.status === 'in-progress' ? 'bg-cyan-400/10' : 'bg-white/10')}>
                    {meal.status === 'completed' ? <CheckCircle className="h-5 w-5 text-emerald-200" /> : meal.status === 'in-progress' ? <Play className="h-5 w-5 text-cyan-200" /> : <Clock className="h-5 w-5 text-slate-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-white">{meal.name}</p>
                    <p className="text-sm text-slate-400">{meal.time}</p>
                  </div>
                </div>
                <span className={cn('rounded-full px-3 py-1 text-xs font-medium capitalize', meal.status === 'completed' ? 'bg-emerald-400/10 text-emerald-200' : meal.status === 'in-progress' ? 'bg-cyan-400/10 text-cyan-200' : 'bg-white/10 text-slate-300')}>
                  {meal.status === 'in-progress' ? 'In Progress' : meal.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Room Deliveries</h2>
              <p className="mt-2 text-sm text-slate-400">Select rooms for meal delivery</p>
            </div>
            <button
              type="button"
              disabled={selectedRooms.length === 0}
              onClick={handleStartDelivery}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start Delivery ({selectedRooms.length})
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {rooms.map((room) => (
              <div key={room.id} className={cn('flex items-center justify-between rounded-2xl border border-white/10 p-4', room.delivered && 'bg-slate-950/40')}>
                <div className="flex items-center gap-3">
                  <input
                    id={room.id}
                    type="checkbox"
                    checked={selectedRooms.includes(room.id)}
                    onChange={() => toggleRoom(room.id)}
                    disabled={room.delivered}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950/60"
                  />
                  <label htmlFor={room.id} className="cursor-pointer flex flex-col">
                    <span className="font-medium text-white">Room {room.id}</span>
                    <span className="text-sm text-slate-400">{room.resident}</span>
                  </label>
                </div>
                {room.delivered && <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">Delivered</span>}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
