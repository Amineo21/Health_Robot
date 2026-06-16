import { apiFetch } from './api'
import type { UserRole } from './auth'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: UserRole
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface CreateAdminUserRequest {
  name: string
  email: string
  role: UserRole
  password: string
}

export interface UpdateAdminUserRequest {
  name?: string
  email?: string
  role?: UserRole
  is_active?: boolean
}

export interface AdminSettings {
  id?: string
  max_speed_mps: number
  meal_speed_mps: number
  low_battery_threshold: number
  auto_return_enabled: boolean
  teleop_enabled: boolean
  emergency_requires_admin_reset: boolean
  updated_at?: string
}

export function listAdminUsers() {
  return apiFetch<AdminUser[]>('/api/admin/users')
}

export function createAdminUser(payload: CreateAdminUserRequest) {
  return apiFetch<AdminUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAdminUser(userId: string, payload: UpdateAdminUserRequest) {
  return apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function resetAdminUserPassword(userId: string, password: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function deactivateAdminUser(userId: string) {
  return apiFetch<AdminUser>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

export function getAdminSettings() {
  return apiFetch<AdminSettings>('/api/admin/settings')
}

export function updateAdminSettings(payload: AdminSettings) {
  return apiFetch<AdminSettings>('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
