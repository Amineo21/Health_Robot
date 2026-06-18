import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Bot, Shield } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { getAdminSettings, updateAdminSettings, type AdminSettings } from '@/lib/admin-api'
import { ADMIN_ROLES } from '@/lib/permissions'

export const Route = createFileRoute('/settings')({ component: SettingsRoute })

function SettingsRoute() {
  return (
    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
      <SettingsPage />
    </ProtectedRoute>
  )
}

function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await getAdminSettings()
        if (!cancelled) {
          setSettings(data)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les settings')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const validationError = getValidationError(settings)

  const handleSave = async () => {
    if (!settings || validationError) {
      return
    }

    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateAdminSettings(settings)
      setSettings(updated)
      setMessage('Settings sauvegardés')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erreur de sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-slate-400">Configuration admin chargée depuis le backend</p>
      </div>

      {isLoading && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          Chargement des settings...
        </div>
      )}

      {(error || validationError || message) && (
        <div className={`rounded-3xl border p-4 text-sm ${message ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-rose-400/30 bg-rose-400/10 text-rose-100'}`}>
          {message || validationError || error}
        </div>
      )}

      {settings && (
        <div className="grid gap-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Bot className="h-5 w-5" /> Robot Configuration</h2>
            <p className="mt-2 text-sm text-slate-400">Contraintes MVP : max_speed_mps ≤ 0.5, meal_speed_mps ≤ 0.3, low_battery_threshold entre 5 et 50.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Maximum Speed (m/s)"
                max={0.5}
                step="0.01"
                value={settings.max_speed_mps}
                onChange={(value) => setSettings((previous) => previous && { ...previous, max_speed_mps: value })}
              />
              <NumberField
                label="Meal Speed (m/s)"
                max={0.3}
                step="0.01"
                value={settings.meal_speed_mps}
                onChange={(value) => setSettings((previous) => previous && { ...previous, meal_speed_mps: value })}
              />
              <NumberField
                label="Low Battery Threshold (%)"
                min={5}
                max={50}
                step="1"
                value={settings.low_battery_threshold}
                onChange={(value) => setSettings((previous) => previous && { ...previous, low_battery_threshold: Math.round(value) })}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Shield className="h-5 w-5" /> Paramètres de sécurité</h2>
            <p className="mt-2 text-sm text-slate-400">Options de sécurité et de comportement côté backend.</p>

            <div className="mt-6 space-y-4 text-sm">
              <ToggleRow
                title="Auto return enabled"
                description="Retour automatique à la base si les conditions backend le déclenchent"
                checked={settings.auto_return_enabled}
                onChange={(checked) => setSettings((previous) => previous && { ...previous, auto_return_enabled: checked })}
              />
              <ToggleRow
                title="Teleop enabled"
                description="Autorise les commandes teleop admin via le backend"
                checked={settings.teleop_enabled}
                onChange={(checked) => setSettings((previous) => previous && { ...previous, teleop_enabled: checked })}
              />
              <ToggleRow
                title="Emergency requires admin reset"
                description="Demande un reset admin pour lever un emergency stop"
                checked={settings.emergency_requires_admin_reset}
                onChange={(checked) => setSettings((previous) => previous && { ...previous, emergency_requires_admin_reset: checked })}
              />
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isSaving || Boolean(validationError)}
              onClick={() => void handleSave()}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Sauvegarde...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getValidationError(settings: AdminSettings | null) {
  if (!settings) {
    return ''
  }
  if (settings.max_speed_mps > 0.5) {
    return 'max_speed_mps doit être inférieur ou égal à 0.5'
  }
  if (settings.meal_speed_mps > 0.3) {
    return 'meal_speed_mps doit être inférieur ou égal à 0.3'
  }
  if (settings.low_battery_threshold < 5 || settings.low_battery_threshold > 50) {
    return 'low_battery_threshold doit être entre 5 et 50'
  }
  return ''
}

function NumberField({ label, value, onChange, min = 0, max, step }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step: string }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
      />
    </label>
  )
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <span className="space-y-0.5">
        <span className="block font-medium text-white">{title}</span>
        <span className="block text-sm text-slate-400">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 rounded border-white/20 bg-slate-950/60" />
    </label>
  )
}
