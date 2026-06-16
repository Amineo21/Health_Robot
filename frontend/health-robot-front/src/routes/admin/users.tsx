import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw, Shield, UserPlus } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import {
  createAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  type AdminUser,
} from '@/lib/admin-api'
import type { UserRole } from '@/lib/auth'
import { ADMIN_ROLES } from '@/lib/permissions'

const roles: UserRole[] = ['admin', 'caregiver']

export const Route = createFileRoute('/admin/users')({ component: AdminUsersRoute })

function AdminUsersRoute() {
  return (
    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
      <AdminUsersPage />
    </ProtectedRoute>
  )
}

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'caregiver' as UserRole, password: '' })
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadUsers = async () => {
    setIsLoading(true)
    setError('')
    try {
      setUsers(await listAdminUsers())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les users')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const runAction = async (action: () => Promise<AdminUser>, successMessage: string) => {
    setIsSubmitting(true)
    setMessage('')
    setError('')
    try {
      const updated = await action()
      setUsers((previous) => {
        const exists = previous.some((user) => user.id === updated.id)
        return exists ? previous.map((user) => (user.id === updated.id ? updated : user)) : [updated, ...previous]
      })
      setMessage(successMessage)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action admin refusée')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runAction(() => createAdminUser(newUser), 'Utilisateur créé')
    setNewUser({ name: '', email: '', role: 'caregiver', password: '' })
  }

  const handleResetPassword = async (userId: string) => {
    const password = resetPasswords[userId]
    if (!password) {
      setError('Saisis un nouveau mot de passe pour ce user')
      return
    }

    await runAction(() => resetAdminUserPassword(userId, password), 'Mot de passe réinitialisé')
    setResetPasswords((previous) => ({ ...previous, [userId]: '' }))
  }

  return (
    <div className="space-y-6 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-sm text-slate-400">Gestion des comptes admin/caregiver via le backend</p>
        </div>
        <button
          type="button"
          onClick={() => void loadUsers()}
          className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition hover:bg-white/10"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir
        </button>
      </div>

      {(message || error) && (
        <div className={`rounded-3xl border p-4 text-sm ${message ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-rose-400/30 bg-rose-400/10 text-rose-100'}`}>
          {message || error}
        </div>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus className="h-5 w-5" /> Créer un user</h2>
        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
          <TextField label="Name" value={newUser.name} onChange={(value) => setNewUser((previous) => ({ ...previous, name: value }))} required />
          <TextField label="Email" type="email" value={newUser.email} onChange={(value) => setNewUser((previous) => ({ ...previous, email: value }))} required />
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Role</span>
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((previous) => ({ ...previous, role: event.target.value as UserRole }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
            >
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <TextField label="Password" type="password" value={newUser.password} onChange={(value) => setNewUser((previous) => ({ ...previous, password: value }))} required />
          <div className="md:col-span-2 xl:col-span-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Créer
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Shield className="h-5 w-5" /> Users</h2>
        {isLoading ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-6 text-center text-slate-400">Chargement...</div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3">Reset password</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="px-3 py-4 font-medium text-white">{user.name}</td>
                    <td className="px-3 py-4 text-slate-300">{user.email}</td>
                    <td className="px-3 py-4">
                      <select
                        value={user.role}
                        disabled={isSubmitting}
                        onChange={(event) => void runAction(() => updateAdminUser(user.id, { role: event.target.value as UserRole }), 'Rôle mis à jour')}
                        className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white"
                      >
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${user.is_active ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>
                        {user.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={resetPasswords[user.id] ?? ''}
                          onChange={(event) => setResetPasswords((previous) => ({ ...previous, [user.id]: event.target.value }))}
                          placeholder="Nouveau mot de passe"
                          className="w-48 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-white placeholder:text-slate-500"
                        />
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleResetPassword(user.id)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      {user.is_active ? (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void runAction(() => deactivateAdminUser(user.id), 'Utilisateur désactivé')}
                          className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void runAction(() => updateAdminUser(user.id, { is_active: true }), 'Utilisateur réactivé')}
                          className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Réactiver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function TextField({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
      />
    </label>
  )
}
