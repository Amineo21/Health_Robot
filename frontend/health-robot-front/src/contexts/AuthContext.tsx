'use client'

import { createContext, useContext, useEffect, useState } from 'react'

import {
  clearAuthStorage,
  createUser,
  getCurrentUser,
  getStoredUsers,
  saveStoredUsers,
  seedDefaultUserIfNeeded,
  setCurrentUser,
  type User,
  type UserRole,
} from '@/lib/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    seedDefaultUserIfNeeded()
    setUser(getCurrentUser())
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const users = seedDefaultUserIfNeeded()
    const existingUser = users.find(
      (entry) => entry.user.email.toLowerCase() === email.toLowerCase() && entry.password === password,
    )

    if (existingUser) {
      setCurrentUser(existingUser.user)
      setUser(existingUser.user)
      return
    }

    const fallbackUser = createUser(email, email.split('@')[0] || 'Utilisateur', 'infirmier')
    const nextUsers = [...users, { user: fallbackUser, password }]
    saveStoredUsers(nextUsers)
    setCurrentUser(fallbackUser)
    setUser(fallbackUser)
  }

  const logout = async () => {
    clearAuthStorage()
    setUser(null)
  }

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    const users = seedDefaultUserIfNeeded()
    const duplicate = users.some((entry) => entry.user.email.toLowerCase() === email.toLowerCase())

    if (duplicate) {
      throw new Error('Un compte existe déjà avec cet email')
    }

    const nextUser = createUser(email, name, role)
    const nextUsers = [...users, { user: nextUser, password }]

    saveStoredUsers(nextUsers)
    setCurrentUser(nextUser)
    setUser(nextUser)
  }

  const resetPassword = async (email: string) => {
    const users = getStoredUsers()
    const userExists = users.some((entry) => entry.user.email.toLowerCase() === email.toLowerCase())

    if (!userExists) {
      throw new Error('Aucun compte trouvé pour cet email')
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, logout, signup, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}