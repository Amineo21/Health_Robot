'use client'

import { useEffect } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { useAuth } from '@/contexts/AuthContext'

export function useProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/auth/login', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  return { isAuthenticated, isLoading }
}

export function usePublicRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  return { isLoading }
}