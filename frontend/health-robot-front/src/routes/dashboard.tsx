import { createFileRoute, Link } from '@tanstack/react-router'
import { Activity, Battery, Gauge, OctagonX, Route as RouteIcon, Users } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { useRobot } from '@/lib/robot-context'
import { ADMIN_ROLES, CAREGIVER_OR_ADMIN_ROLES } from '@/lib/permissions'

export const Route = createFileRoute('/dashboard')({ component: DashboardRoute })

function DashboardRoute() {
  return (
    <ProtectedRoute allowedRoles={CAREGIVER_OR_ADMIN_ROLES}>
      <DashboardPage />
    </ProtectedRoute>
  )
}

function DashboardPage() {
  const { user, logout } = useAuth()
  const { backendStatus, status, statusError, isStatusLoading } = useRobot()

  if (!user) {
    return null
  }

  const cards = [
    {
      label: 'Mode du robot',
      value: backendStatus?.mode ?? status,
      icon: Activity,
    },
    {
      label: 'Batterie',
      value: backendStatus ? `${backendStatus.battery_level}%` : 'N/A',
      icon: Battery,
    },
    {
      label: 'Vitesse actuelle',
      value: `${(backendStatus?.current_speed_mps ?? 0).toFixed(4)} m/s`,
      icon: Gauge,
    },
    {
      label: 'Arrêt d\'urgence',
      value: backendStatus?.emergency_active ? 'Actif' : 'Inactif',
      icon: OctagonX,
    },
  ]

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#111827_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-cyan-400/20 bg-slate-950/50 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                Tableau de bord
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Bienvenue {user.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Supervision connectée au backend FastAPI. Les commandes robot passent par l'API et les droits suivent ton rôle.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/control"
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Accéder au contrôle
              </Link>
              <RoleGuard allowedRoles={ADMIN_ROLES}>
                <Link
                  to="/admin/users"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <Users className="h-4 w-4" /> Utilisateurs
                </Link>
              </RoleGuard>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </section>

        {statusError && (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            État du robot indisponible : {statusError}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-400">{card.label}</p>
                <card.icon className="h-5 w-5 text-cyan-200" />
              </div>
              <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <RouteIcon className="h-5 w-5 text-cyan-200" /> Mission en cours
            </h2>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <InfoItem label="ID de mission" value={backendStatus?.mission_id ?? 'Aucune'} />
              <InfoItem label="ETA à la base" value={backendStatus?.eta_to_base_seconds == null ? 'N/A' : `${backendStatus.eta_to_base_seconds}s`} />
              <InfoItem label="Distance restante" value={backendStatus?.distance_remaining_m == null ? 'N/A' : `${backendStatus.distance_remaining_m}m`} />
              <InfoItem label="Statut" value={isStatusLoading ? 'Synchronisation...' : 'Toutes les 3s'} />
            </dl>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Compte actif</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-300">
              <InfoItem label="E-mail" value={user.email} />
              <InfoItem label="Rôle" value={user.role} />
            </dl>
          </article>
        </section>
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  )
}
