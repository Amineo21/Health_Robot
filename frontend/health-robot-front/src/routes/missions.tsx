import { useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Clock, Plus, XCircle } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useRobot, type MissionType } from '@/lib/robot-context'
import { CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const rooms = [
  'Chambre 101', 'Chambre 102', 'Chambre 103',
  'Chambre 201', 'Chambre 202', 'Chambre 203',
  'Chambre 301', 'Chambre 302', 'Chambre 303',
  'Poste infirmier', 'Pharmacie', 'Cuisine',
]

const statusConfig = {
  pending: { label: 'En attente', icon: Clock, color: 'text-slate-300', bg: 'bg-white/10' },
  'in-progress': { label: 'En cours', icon: CheckCircle, color: 'text-cyan-200', bg: 'bg-cyan-400/10' },
  completed: { label: 'Terminée', icon: CheckCircle, color: 'text-emerald-200', bg: 'bg-emerald-400/10' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-rose-200', bg: 'bg-rose-400/10' },
} as const

export const Route = createFileRoute('/missions')({ component: MissionsRoute })

function MissionsRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <MissionsPage />
    </ProtectedRoute>
  )
}

function MissionsPage() {
  const { missions, addMission, cancelMission } = useRobot()
  const [type, setType] = useState<MissionType>('medical')
  const [destination, setDestination] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [notes, setNotes] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!destination) {
      return
    }

    addMission({ type, destination, priority, notes: notes || undefined })
    setType('medical')
    setDestination('')
    setPriority('medium')
    setNotes('')
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
          <p className="text-sm text-slate-400">Créer et gérer les missions de livraison du robot</p>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">Créer une nouvelle mission</h2>
          <p className="mt-2 text-sm text-slate-400">Envoyer le robot en mission de livraison</p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Type de mission</span>
              <select className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" value={type} onChange={(event) => setType(event.target.value as MissionType)}>
                <option value="medical">Livraison médicale</option>
                <option value="meal">Distribution de repas</option>
              </select>
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Chambre de destination</span>
              <select className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" value={destination} onChange={(event) => setDestination(event.target.value)}>
                <option value="">Sélectionner une destination</option>
                {rooms.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Priorité</span>
              <select className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" value={priority} onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high')}>
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
              </select>
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Remarques (Optionnel)</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
                placeholder="Ajouter des instructions spéciales..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>

            <button type="submit" disabled={!destination} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
              <Plus className="h-4 w-4" /> Envoyer la mission
            </button>
          </form>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">Historique des missions</h2>
          <p className="mt-2 text-sm text-slate-400">Voir toutes les missions passées et actuelles</p>

          <div className="mt-5 space-y-3">
            {missions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-slate-400">
                Aucune mission pour le moment. Créez votre première mission pour commencer.
              </div>
            ) : (
              missions.map((mission) => {
                const StatusIcon = statusConfig[mission.status].icon

                return (
                  <div key={mission.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-white">{mission.destination}</p>
                        <p className="text-xs text-slate-500 font-mono">{mission.id}</p>
                      </div>
                      {(mission.status === 'pending' || mission.status === 'in-progress') && (
                        <button type="button" onClick={() => cancelMission(mission.id)} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-200">
                          Annuler
                        </button>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-white/10 px-3 py-1 capitalize text-slate-300">{mission.type}</span>
                      <span className={cn('rounded-full px-3 py-1 capitalize', mission.priority === 'low' && 'bg-white/10 text-slate-300', mission.priority === 'medium' && 'bg-amber-400/10 text-amber-200', mission.priority === 'high' && 'bg-rose-400/10 text-rose-200')}>
                        {mission.priority}
                      </span>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 capitalize', statusConfig[mission.status].bg, statusConfig[mission.status].color)}>
                        <StatusIcon className="h-3.5 w-3.5" /> {statusConfig[mission.status].label}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">Started: {mission.startTime.toLocaleTimeString()}</p>
                  </div>
                )
              })
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
