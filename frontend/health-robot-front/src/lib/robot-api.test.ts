// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from './api'
import { commandRobotArm, createAnnotatedPoint, createMission, fetchAnnotatedPoints, fetchCurrentRobotMap, fetchRobotCameraSnapshot, fetchRobotScreenStatus, loadSavedRobotMap, navigateToPosition, returnBase, saveCurrentRobotMap, sendTeleop, setPoseOrigin, updateStockPointSupplies, uploadRobotSound } from './robot-api'

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

  it('posts return base through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ command_id: 'cmd-home', status: 'published' }))

    await returnBase()

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/command/return-base')
    expect(init.method).toBe('POST')
  })

  it('posts set pose origin through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ command_id: 'cmd-origin', status: 'published' }))

    await setPoseOrigin()

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/command/set-pose-origin')
    expect(init.method).toBe('POST')
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

  it('loads saved maps through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: { map: 'map_1' } }))

    await loadSavedRobotMap('map_1')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/maps/map_1/load')
    expect(init.method).toBe('POST')
  })

  it('fetches camera snapshots with bearer auth', async () => {
    fetchMock.mockResolvedValueOnce(new Response('jpeg', { headers: { 'content-type': 'image/jpeg' } }))

    const blob = await fetchRobotCameraSnapshot()

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/camera/snapshot')
    expect(headers.get('Authorization')).toBe('Bearer jwt')
    expect(headers.get('Accept')).toBe('image/jpeg')
    expect(blob.type).toBe('image/jpeg')
  })

  it('uploads sound bytes through backend', async () => {
    const data = new Blob(['mp3'])
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, name: 'hello.mp3', size: 3 }))

    await uploadRobotSound('hello.mp3', data)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Headers
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/sounds/upload?name=hello.mp3')
    expect(init.method).toBe('POST')
    expect(headers.get('Content-Type')).toBe('application/octet-stream')
    expect(init.body).toBe(data)
  })

  it('posts arm commands through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ joints: [90, 60, 45, 90, 90, 90] }))

    await commandRobotArm([90, 60, 45, 90, 90, 90], 1200)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot/arm')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ joint1: 90, joint2: 60, joint3: 45, joint4: 90, joint5: 90, joint6: 90, time_ms: 1200 })
  })

  it('fetches annotated delivery points through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    await fetchAnnotatedPoints({ type: 'DELIVERY_ROOM', active_only: true })

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/annotated-points?type=DELIVERY_ROOM&active_only=true')
  })

  it('creates annotated points through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'pt-1' }))

    await createAnnotatedPoint({ name: 'Chambre 203', type: 'DELIVERY_ROOM', x: 3, y: 4, yaw: 0 })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/annotated-points')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Chambre 203', type: 'DELIVERY_ROOM', x: 3, y: 4, yaw: 0 })
  })

  it('updates stock supplies through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    await updateStockPointSupplies('pt-1', [{ supply_type: 'gants', priority_order: 1 }])

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/annotated-points/pt-1/supplies')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ supplies: [{ supply_type: 'gants', priority_order: 1 }] })
  })

  it('creates missions through backend', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'mis-1', status: 'NAVIGATING_TO_STOCK' }))

    await createMission({ supply_type: 'gants', delivery_room_id: 'pt-room' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/missions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ supply_type: 'gants', delivery_room_id: 'pt-room' })
  })

  it('fetches robot screen status with dedicated token only', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ robot_state: 'IDLE', screen_title_fr: 'CareBot' }))

    await fetchRobotScreenStatus('screen-token')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/robot-screen/status')
    expect(headers['X-Robot-Screen-Token']).toBe('screen-token')
    expect(headers.Authorization).toBeUndefined()
  })
})
