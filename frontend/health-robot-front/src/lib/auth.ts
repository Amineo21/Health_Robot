import { apiFetch } from './api'

export type UserRole = 'admin' | 'caregiver'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  is_active?: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export function loginWithPassword(email: string, password: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    redirectOnUnauthorized: false,
  })
}

export function fetchCurrentUser() {
  return apiFetch<User>('/api/auth/me')
}

export function logoutCurrentUser() {
  return apiFetch<{ status: string }>('/api/auth/logout', {
    method: 'POST',
    redirectOnUnauthorized: false,
  })
}
