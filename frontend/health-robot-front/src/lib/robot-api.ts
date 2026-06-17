import { API_BASE_URL, ApiError, apiFetch, getAccessToken } from './api'
import type { UserRole } from './auth'

export interface BatteryEvent {
  timestamp: string
  battery_level: number
  status: string
  severity: string
  action: string
  eta_seconds?: number | null
  eta_source?: string | null
  path_distance_m?: number | null
  distance_remaining_m?: number | null
  mission_id?: string | null
  details?: string | null
}

export interface EmergencyEvent {
  timestamp: string
  active: boolean
  source: string
  reason: string
  motor_cutoff_ms: number
  requires_admin_restart: boolean
  ui_state: string
  restart_procedure: string
}

export interface RobotStatusSnapshot {
  timestamp: string
  mode: string
  battery_level: number
  battery_status: string
  emergency_active: boolean
  mission_id: string | null
  eta_to_base_seconds: number | null
  eta_source?: string | null
  path_distance_m?: number | null
  distance_remaining_m: number | null
  current_speed_mps: number | null
  pose?: RobotPose | null
  map?: RobotMapMetadata | null
  min_obstacle_distance_m?: number | null
  last_battery_event: BatteryEvent | null
  last_emergency_event: EmergencyEvent | null
}

export interface RobotPose {
  x: number
  y: number
  yaw?: number | null
}

export interface RobotMapMetadata {
  width: number
  height: number
  resolution: number
  origin_x: number
  origin_y: number
}

export interface RobotMapSnapshot extends RobotMapMetadata {
  data: number[]
  updated_at: number
}

export interface SavedRobotMap {
  name: string
  parts: Record<string, string>
  mtime: number
  size: number
  loadable: boolean
}

export interface SavedRobotMapsResponse {
  maps: SavedRobotMap[]
}

export interface RobotMapOperationResponse {
  ok: boolean
  result: Record<string, unknown>
}

export interface SaveRobotMapResponse {
  ok: boolean
  name: string
  base_path: string
  occupancy?: Record<string, unknown> | null
  pose_graph?: Record<string, unknown> | null
}

export interface RobotSound {
  name: string
  size: number
  modified: number
}

export interface RobotSoundsResponse {
  sounds: RobotSound[]
}

export interface RobotSoundOperationResponse {
  ok: boolean
  name?: string | null
  size?: number | null
}

export interface RobotArmState {
  joints: number[]
}

export interface NavigatePayload {
  x: number
  y: number
  yaw: number
  label: string
}

export interface TeleopPayload {
  linear_x: number
  angular_z: number
  duration_ms: number
}

export interface RobotCommandResponse {
  command_id: string
  type: string
  requested_by: string
  requested_by_role: UserRole
  payload: Record<string, unknown>
  timestamp: string
  status: string
}

function resolveApiUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function getRawErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'string' && data.length > 0) {
    return data
  }

  if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    return data.detail
  }

  return fallback
}

async function rawApiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  const token = getAccessToken()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json') ? await response.json().catch(() => undefined) : await response.text()
    throw new ApiError(getRawErrorMessage(data, response.statusText || 'Erreur API'), response.status, data)
  }

  return response
}

export function fetchRobotStatus() {
  return apiFetch<RobotStatusSnapshot>('/api/robot/status')
}

export function navigateToPosition(payload: NavigatePayload) {
  return apiFetch<RobotCommandResponse>('/api/robot/command/navigate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function sendTeleop(payload: TeleopPayload) {
  return apiFetch<RobotCommandResponse>('/api/robot/command/teleop', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function triggerEmergencyStop(reason = 'manual_ui_stop') {
  return apiFetch<RobotCommandResponse>('/api/robot/command/emergency-stop', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function returnBase() {
  return apiFetch<RobotCommandResponse>('/api/robot/command/return-base', {
    method: 'POST',
  })
}

export function clearCostmaps() {
  return apiFetch<RobotCommandResponse>('/api/robot/command/clear-costmaps', {
    method: 'POST',
  })
}

export function resetEmergency() {
  return apiFetch<{ status: string }>('/api/safety/emergency/reset?actor=frontend', {
    method: 'POST',
  })
}

export function fetchCurrentRobotMap() {
  return apiFetch<RobotMapSnapshot>('/api/robot/maps/current')
}

export function fetchSavedRobotMaps() {
  return apiFetch<SavedRobotMapsResponse>('/api/robot/maps')
}

export function fetchRobotMapMode() {
  return apiFetch<RobotMapOperationResponse>('/api/robot/maps/mode')
}

export function startMappingMode() {
  return apiFetch<RobotMapOperationResponse>('/api/robot/maps/mapping/start', {
    method: 'POST',
  })
}

export function saveCurrentRobotMap(name: string) {
  return apiFetch<SaveRobotMapResponse>('/api/robot/maps/save', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function loadSavedRobotMap(name: string) {
  return apiFetch<RobotMapOperationResponse>(`/api/robot/maps/${encodeURIComponent(name)}/load`, {
    method: 'POST',
  })
}

export function deleteSavedRobotMap(name: string) {
  return apiFetch<RobotMapOperationResponse>(`/api/robot/maps/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export async function fetchRobotCameraSnapshot() {
  const response = await rawApiFetch('/api/robot/camera/snapshot', {
    headers: { Accept: 'image/jpeg' },
  })
  return response.blob()
}

export function fetchRobotSounds() {
  return apiFetch<RobotSoundsResponse>('/api/robot/sounds')
}

export function uploadRobotSound(name: string, data: Blob | ArrayBuffer) {
  return apiFetch<RobotSoundOperationResponse>(`/api/robot/sounds/upload?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: data,
  })
}

export function playRobotSound(name: string) {
  return apiFetch<RobotSoundOperationResponse>(`/api/robot/sounds/${encodeURIComponent(name)}/play`, {
    method: 'POST',
  })
}

export function deleteRobotSound(name: string) {
  return apiFetch<RobotSoundOperationResponse>(`/api/robot/sounds/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export function fetchRobotArmState() {
  return apiFetch<RobotArmState>('/api/robot/arm')
}

export function commandRobotArm(joints: number[], timeMs = 800) {
  return apiFetch<RobotArmState>('/api/robot/arm', {
    method: 'POST',
    body: JSON.stringify({
      joint1: joints[0],
      joint2: joints[1],
      joint3: joints[2],
      joint4: joints[3],
      joint5: joints[4],
      joint6: joints[5],
      time_ms: timeMs,
    }),
  })
}
