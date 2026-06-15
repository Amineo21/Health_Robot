import { createFileRoute } from '@tanstack/react-router'
import { Bot, MapPin, Navigation } from 'lucide-react'

import { useRobot } from '@/lib/robot-context'

export const Route = createFileRoute('/map')({ component: MapPage })

function MapPage() {
  const { telemetry, activeMission, status } = useRobot()

  const rooms = [
    { id: '101', x: 10, y: 15, w: 18, h: 20 },
    { id: '102', x: 32, y: 15, w: 18, h: 20 },
    { id: '103', x: 54, y: 15, w: 18, h: 20 },
    { id: '201', x: 10, y: 45, w: 18, h: 20 },
    { id: '202', x: 32, y: 45, w: 18, h: 20 },
    { id: '203', x: 54, y: 45, w: 18, h: 20 },
    { id: 'nurses', x: 78, y: 15, w: 18, h: 25, label: 'Nurses' },
    { id: 'pharmacy', x: 78, y: 45, w: 18, h: 20, label: 'Pharmacy' },
  ]

  const robotX = ((telemetry.position.x % 20) / 20) * 80 + 10
  const robotY = ((telemetry.position.y % 12) / 12) * 60 + 10

  const getDestinationCoords = () => {
    if (!activeMission) return null
    const roomNumber = activeMission.destination.replace('Room ', '')
    const room = rooms.find((item) => item.id === roomNumber)
    return room ? { x: room.x + room.w / 2, y: room.y + room.h / 2 } : null
  }

  const destination = getDestinationCoords()

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Map</h1>
        <p className="text-sm text-slate-400">Real-time robot position and navigation</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold">Floor Plan - Level {telemetry.position.floor}</h2>
            <p className="mt-2 text-sm text-slate-400">Live robot tracking with mission path overlay</p>

            <div className="mt-5 aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
              <svg viewBox="0 0 100 80" className="h-full w-full">
                <defs>
                  <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                    <path d="M 5 0 L 0 0 0 5" fill="none" stroke="currentColor" strokeWidth="0.1" className="text-white/10" />
                  </pattern>
                </defs>
                <rect width="100" height="80" fill="url(#grid)" />
                <rect x="5" y="37" width="90" height="6" fill="currentColor" className="text-slate-950" stroke="currentColor" strokeWidth="0.3" />
                {rooms.map((room) => (
                  <g key={room.id}>
                    <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="currentColor" className="text-slate-950" stroke="currentColor" strokeWidth="0.4" rx="1" />
                    <text x={room.x + room.w / 2} y={room.y + room.h / 2} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[3px] font-medium">
                      {room.label || `Room ${room.id}`}
                    </text>
                  </g>
                ))}

                {destination && (
                  <>
                    <line x1={robotX} y1={robotY} x2={destination.x} y2={destination.y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,1" className="text-cyan-300" />
                    <circle cx={destination.x} cy={destination.y} r="3" fill="currentColor" className="text-cyan-300/30" />
                    <circle cx={destination.x} cy={destination.y} r="1.5" fill="currentColor" className="text-cyan-300" />
                  </>
                )}

                <g transform={`translate(${robotX}, ${robotY})`}>
                  <circle r="4" fill="currentColor" className={status === 'delivering' ? 'text-emerald-300/20' : 'text-cyan-300/20'} />
                  <circle r="2.5" fill="currentColor" className={status === 'delivering' ? 'text-emerald-300' : 'text-cyan-300'} />
                  <circle r="1.2" fill="currentColor" className="text-white" />
                </g>
              </svg>
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Bot className="h-4 w-4" /> Robot Position</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-center">
                <p className="text-xs text-slate-500">X Position</p>
                <p className="text-lg font-mono font-semibold">{telemetry.position.x.toFixed(2)}m</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-center">
                <p className="text-xs text-slate-500">Y Position</p>
                <p className="text-lg font-mono font-semibold">{telemetry.position.y.toFixed(2)}m</p>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-center">
              <p className="text-xs text-slate-500">Floor Level</p>
              <p className="text-lg font-mono font-semibold">Level {telemetry.position.floor}</p>
            </div>
          </article>

          {activeMission && (
            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="flex items-center gap-2 text-base font-semibold"><Navigation className="h-5 w-5" /> Active Mission</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Destination</span><span className="font-medium text-white">{activeMission.destination}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Type</span><span className="rounded-full border border-white/10 px-3 py-1 capitalize text-white">{activeMission.type}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="text-slate-400">Status</span><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-cyan-200">In Progress</span></div>
              </div>
            </article>
          )}

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-base font-semibold"><MapPin className="h-5 w-5" /> Map Legend</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3"><div className="h-4 w-4 rounded-full bg-cyan-300" /> Robot Position</div>
              <div className="flex items-center gap-3"><div className="h-4 w-4 rounded-full bg-cyan-300/30 ring-2 ring-cyan-300" /> Destination</div>
              <div className="flex items-center gap-3"><div className="h-0.5 w-4 border-t-2 border-dashed border-cyan-300" /> Mission Path</div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  )
}