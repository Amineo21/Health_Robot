import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Bot, Bell, Monitor, Moon, Shield, Sun } from 'lucide-react'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark')

  return (
    <div className="space-y-4 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-400">Configure your CareBot control platform</p>
      </div>

      <div className="grid gap-4">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Bot className="h-5 w-5" /> Robot Configuration</h2>
          <p className="mt-2 text-sm text-slate-400">Configure robot connection and behavior settings</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm"><span className="text-slate-300">Robot IP Address</span><input defaultValue="192.168.1.100" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" /></label>
            <label className="space-y-2 text-sm"><span className="text-slate-300">Robot Port</span><input defaultValue="9090" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" /></label>
            <label className="space-y-2 text-sm"><span className="text-slate-300">MQTT Broker URL</span><input defaultValue="mqtt://broker:1883" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" /></label>
            <label className="space-y-2 text-sm"><span className="text-slate-300">WebSocket Server</span><input defaultValue="ws://localhost:8080" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" /></label>
          </div>

          <div className="my-6 border-t border-white/10" />

          <div className="space-y-4 text-sm">
            <ToggleRow title="Auto-reconnect" description="Automatically reconnect when connection is lost" />
            <ToggleRow title="Verbose Logging" description="Enable detailed logging for debugging" />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5" /> Notifications</h2>
          <p className="mt-2 text-sm text-slate-400">Configure alert and notification preferences</p>
          <div className="mt-6 space-y-4 text-sm">
            <ToggleRow title="Low Battery Alerts" description="Notify when battery drops below 20%" defaultChecked />
            <ToggleRow title="Mission Completion" description="Notify when missions are completed" defaultChecked />
            <ToggleRow title="Connection Alerts" description="Notify when connection is lost or restored" defaultChecked />
            <ToggleRow title="Sound Alerts" description="Play sound for important notifications" />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 text-lg font-semibold">{theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} Appearance</h2>
          <p className="mt-2 text-sm text-slate-400">Customize the look and feel of the interface</p>
          <div className="mt-6 space-y-4 text-sm">
            <div>
              <p className="mb-2 font-medium text-slate-300">Theme</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Monitor },
                ].map((option) => (
                  <button key={option.value} type="button" onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')} className={`inline-flex items-center justify-center rounded-2xl border px-4 py-3 font-medium transition ${theme === option.value ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-white/10 bg-slate-950/40 text-white hover:bg-white/10'}`}>
                    <option.icon className="mr-2 h-4 w-4" /> {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Language</span>
              <select defaultValue="fr" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
                <option value="en">English</option>
                <option value="fr">Francais</option>
                <option value="de">Deutsch</option>
                <option value="es">Espanol</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Shield className="h-5 w-5" /> Safety Settings</h2>
          <p className="mt-2 text-sm text-slate-400">Configure robot safety parameters</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm"><span className="text-slate-300">Maximum Speed (m/s)</span><input type="number" defaultValue="0.8" step="0.1" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" /></label>
            <label className="space-y-2 text-sm"><span className="text-slate-300">Collision Detection Distance (m)</span><input type="number" defaultValue="0.5" step="0.1" className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" /></label>
          </div>

          <div className="my-6 border-t border-white/10" />

          <div className="space-y-4 text-sm">
            <ToggleRow title="Emergency Stop Enabled" description="Allow manual emergency stop activation" disabled defaultChecked />
            <ToggleRow title="Obstacle Avoidance" description="Automatic obstacle detection and avoidance" defaultChecked />
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10">Reset to Defaults</button>
          <button type="button" className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ title, description, defaultChecked, disabled }: { title: string; description: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="space-y-0.5">
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      <input type="checkbox" defaultChecked={defaultChecked} disabled={disabled} className="h-5 w-5 rounded border-white/20 bg-slate-950/60" />
    </div>
  )
}