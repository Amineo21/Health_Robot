import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { AUTH_UNAUTHORIZED_EVENT, getAccessToken, setAccessToken } from '@/lib/api'
import { fetchCurrentUser, loginWithPassword, logoutCurrentUser, type User } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null)
      setIsLoading(false)
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      const token = getAccessToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const currentUser = await fetchCurrentUser()
        if (!cancelled) {
          setUser(currentUser)
        }
      } catch {
        setAccessToken(null)
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await loginWithPassword(email, password)
      setAccessToken(data.access_token)
      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      if (getAccessToken()) {
        await logoutCurrentUser().catch(() => undefined)
      }
    } finally {
      setAccessToken(null)
      setUser(null)
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
