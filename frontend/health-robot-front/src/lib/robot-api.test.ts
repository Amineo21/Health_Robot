// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from './api'
import { fetchCurrentRobotMap, navigateToPosition, saveCurrentRobotMap, sendTeleop } from './robot-api'

const fetchMock = vi.fn()

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  })
}

describe('robot-api', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setAccessToken('jwt')
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('posts navigate payload through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ command_id: 'cmd-1', status: 'published' }))

    await navigateToPosition({ x: 1.5, y: 2.3, yaw: 0, label: 'position libre' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/command/navigate')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ x: 1.5, y: 2.3, yaw: 0, label: 'position libre' })
  })

  it('posts teleop payload through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ command_id: 'cmd-2', status: 'published' }))

    await sendTeleop({ linear_x: 0.1, angular_z: 0.2, duration_ms: 300 })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/command/teleop')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ linear_x: 0.1, angular_z: 0.2, duration_ms: 300 })
  })

  it('fetches the current robot map through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ width: 2, height: 2, resolution: 0.05, origin_x: 0, origin_y: 0, data: [0, 100, -1, 0], updated_at: 1 }))

    await fetchCurrentRobotMap()

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/maps/current')
  })

  it('saves maps through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, name: 'map_1', base_path: '/root/maps/map_1' }))

    await saveCurrentRobotMap('map_1')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/maps/save')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'map_1' })
  })
})
