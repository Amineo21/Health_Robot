// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from './api'
import { loginWithPassword } from './auth'

const fetchMock = vi.fn()

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

describe('auth API', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setAccessToken(null)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('logs in with backend access_token payload', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'admin-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 'admin-id',
          email: 'admin@health-robot.local',
          name: 'Admin',
          role: 'admin',
          is_active: true,
        },
      }),
    )

    const result = await loginWithPassword('admin@health-robot.local', 'admin')

    expect(result.access_token).toBe('admin-token')
    expect(result.user.role).toBe('admin')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/auth/login')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'admin@health-robot.local', password: 'admin' })
  })

  it('returns backend error for invalid credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Invalid credentials' }, { status: 401 }))

    await expect(loginWithPassword('admin@health-robot.local', 'wrong')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    })
  })
})
