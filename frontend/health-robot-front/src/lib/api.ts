const ACCESS_TOKEN_KEY = 'health-robot-front:access-token'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
export const AUTH_UNAUTHORIZED_EVENT = 'health-robot-front:auth-unauthorized'

type ApiFetchOptions = RequestInit & {
  redirectOnUnauthorized?: boolean
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let accessToken: string | null = readStoredAccessToken()

function readStoredAccessToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string | null) {
  accessToken = token

  if (typeof window === 'undefined') {
    return
  }

  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

export function getAccessToken() {
  return accessToken
}

function resolveUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function parseResponseBody(response: Response) {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return text
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'string' && data.length > 0) {
    return data
  }

  if (!data || typeof data !== 'object') {
    return fallback
  }

  const record = data as { detail?: unknown; message?: unknown; error?: unknown }
  const detail = record.detail ?? record.message ?? record.error

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      .join(', ')
  }

  return fallback
}

function isFormBody(body: BodyInit) {
  return (
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)
  )
}

function handleUnauthorized() {
  setAccessToken(null)

  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))

  if (window.location.pathname !== '/auth/login') {
    window.location.assign('/auth/login')
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { redirectOnUnauthorized = true, headers: providedHeaders, ...requestOptions } = options
  const headers = new Headers(providedHeaders)
  const token = getAccessToken()

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (requestOptions.body && !headers.has('Content-Type') && !isFormBody(requestOptions.body)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(resolveUrl(path), {
    ...requestOptions,
    headers,
  })

  const data = await parseResponseBody(response)

  if (!response.ok) {
    const message = getErrorMessage(data, response.statusText || 'Erreur API')

    if (response.status === 401 && redirectOnUnauthorized) {
      handleUnauthorized()
    }

    throw new ApiError(message, response.status, data)
  }

  return data as T
}
