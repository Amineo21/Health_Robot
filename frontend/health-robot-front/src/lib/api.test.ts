// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { API_BASE_URL, AUTH_UNAUTHORIZED_EVENT, apiFetch, getAccessToken, setAccessToken } from './api'

const fetchMock = vi.fn()

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/auth/login')
    setAccessToken(null)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('adds bearer token and JSON headers', async () => {
    setAccessToken('admin-token')
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    const data = await apiFetch<{ ok: boolean }>('/api/robot/status', {
      method: 'POST',
      body: JSON.stringify({ probe: true }),
    })

    expect(data).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/api/robot/status`, expect.any(Object))

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer admin-token')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('clears token and emits event on 401', async () => {
    const unauthorizedListener = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorizedListener)
    setAccessToken('expired-token')
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Token expired' }, { status: 401 }))

    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({ status: 401, message: 'Token expired' })

    expect(getAccessToken()).toBeNull()
    expect(window.localStorage.getItem('health-robot-front:access-token')).toBeNull()
    expect(unauthorizedListener).toHaveBeenCalledTimes(1)
  })

  it('keeps 403 exploitable for access denied UI', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Only admin users can update settings.' }, { status: 403 }))

    await expect(apiFetch('/api/admin/settings')).rejects.toMatchObject({
      status: 403,
      message: 'Only admin users can update settings.',
    })
  })
})
