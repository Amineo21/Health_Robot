export type UserRole = 'aide-soignant' | 'infirmier' | 'manager' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  avatar?: string
}

export interface AuthRecord {
  user: User
  password: string
}

const USERS_KEY = 'health-robot-front:users'
const CURRENT_USER_KEY = 'health-robot-front:current-user'

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = window.localStorage.getItem(key)
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getStoredUsers() {
  return readJson<AuthRecord[]>(USERS_KEY, [])
}

export function saveStoredUsers(users: AuthRecord[]) {
  writeJson(USERS_KEY, users)
}

export function getCurrentUser() {
  return readJson<User | null>(CURRENT_USER_KEY, null)
}

export function setCurrentUser(user: User | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (user) {
    writeJson(CURRENT_USER_KEY, user)
  } else {
    window.localStorage.removeItem(CURRENT_USER_KEY)
  }
}

export function clearAuthStorage() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(CURRENT_USER_KEY)
}

export function createUser(email: string, name: string, role: UserRole): User {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
    email,
    name,
    role,
  }
}

export function seedDefaultUserIfNeeded() {
  const users = getStoredUsers()
  if (users.length > 0) {
    return users
  }

  const demoUser: AuthRecord = {
    user: createUser('demo@health-robot.local', 'Demo User', 'manager'),
    password: 'demo1234',
  }

  const seeded = [demoUser]
  saveStoredUsers(seeded)
  return seeded
}