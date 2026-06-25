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

export type SupplyType = 'serviettes' | 'papier_toilette' | 'gants' | 'protections' | 'linge'
export type AnnotatedPointType = 'STOCK' | 'DELIVERY_ROOM' | 'ROBOT_BASE'
export type MissionStatus =
  | 'PENDING'
  | 'NAVIGATING_TO_STOCK'
  | 'WAITING_FOR_RECOVERY_CONFIRMATION'
  | 'NAVIGATING_TO_DELIVERY'
  | 'WAITING_FOR_DELIVERY_CONFIRMATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'

export interface AnnotatedPoint {
  id: string
  name: string
  type: AnnotatedPointType
  x: number
  y: number
  yaw: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AnnotatedPointPayload {
  name: string
  type: AnnotatedPointType
  x: number
  y: number
  yaw: number
  is_active?: boolean
}

export interface StockPointSupply {
  stock_point_id: string
  supply_type: SupplyType
  priority_order: number
  is_active: boolean
}

export interface StockPointSupplyPayload {
  supply_type: SupplyType
  priority_order: number
  is_active?: boolean
}

export interface Mission {
  id: string
  status: MissionStatus
  supply_type: SupplyType
  delivery_room_id: string
  delivery_room_name_snapshot: string
  delivery_x_snapshot: number
  delivery_y_snapshot: number
  delivery_yaw_snapshot: number
  stock_point_id: string
  stock_point_name_snapshot: string
  stock_x_snapshot: number
  stock_y_snapshot: number
  stock_yaw_snapshot: number
  created_by_user_id: string
  created_by_name_snapshot: string
  created_at: string
  started_at?: string | null
  arrived_at_stock_at?: string | null
  recovery_confirmed_at?: string | null
  recovery_confirmed_by_user_id?: string | null
  arrived_at_delivery_at?: string | null
  delivery_confirmed_at?: string | null
  delivery_confirmed_by_user_id?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  cancelled_by_user_id?: string | null
  failure_reason?: string | null
  updated_at: string
}

export interface RobotScreenStatus {
  robot_state: string
  screen_title_fr: string
  screen_message_fr: string
  current_mission: {
    id: string
    status: MissionStatus
    supply_label_fr: string
    destination_label_fr: string
  } | null
  updated_at: string
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

export function setPoseOrigin() {
  return apiFetch<RobotCommandResponse>('/api/robot/command/set-pose-origin', {
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

export function fetchAnnotatedPoints(params: { type?: AnnotatedPointType; active_only?: boolean } = {}) {
  const search = new URLSearchParams()
  if (params.type) search.set('type', params.type)
  if (params.active_only !== undefined) search.set('active_only', String(params.active_only))
  const query = search.toString()
  return apiFetch<AnnotatedPoint[]>(`/api/annotated-points${query ? `?${query}` : ''}`)
}

export function createAnnotatedPoint(payload: AnnotatedPointPayload) {
  return apiFetch<AnnotatedPoint>('/api/annotated-points', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAnnotatedPoint(pointId: string, payload: Partial<AnnotatedPointPayload>) {
  return apiFetch<AnnotatedPoint>(`/api/annotated-points/${encodeURIComponent(pointId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deactivateAnnotatedPoint(pointId: string) {
  return apiFetch<AnnotatedPoint>(`/api/annotated-points/${encodeURIComponent(pointId)}`, {
    method: 'DELETE',
  })
}

export function updateStockPointSupplies(pointId: string, supplies: StockPointSupplyPayload[]) {
  return apiFetch<StockPointSupply[]>(`/api/annotated-points/${encodeURIComponent(pointId)}/supplies`, {
    method: 'PUT',
    body: JSON.stringify({ supplies }),
  })
}

export function fetchStockPointSupplies(pointId: string) {
  return apiFetch<StockPointSupply[]>(`/api/annotated-points/${encodeURIComponent(pointId)}/supplies`)
}

export function fetchMissions(params: { include_terminal?: boolean; limit?: number } = {}) {
  const search = new URLSearchParams()
  if (params.include_terminal !== undefined) search.set('include_terminal', String(params.include_terminal))
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  const query = search.toString()
  return apiFetch<Mission[]>(`/api/missions${query ? `?${query}` : ''}`)
}

export function createMission(payload: { supply_type: SupplyType; delivery_room_id: string }) {
  return apiFetch<Mission>('/api/missions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function confirmMissionRecovery(missionId: string) {
  return apiFetch<Mission>(`/api/missions/${encodeURIComponent(missionId)}/confirm-recovery`, {
    method: 'POST',
  })
}

export function confirmMissionDelivery(missionId: string) {
  return apiFetch<Mission>(`/api/missions/${encodeURIComponent(missionId)}/confirm-delivery`, {
    method: 'POST',
  })
}

export function cancelMission(missionId: string) {
  return apiFetch<Mission>(`/api/missions/${encodeURIComponent(missionId)}/cancel`, {
    method: 'POST',
  })
}

export async function fetchRobotScreenStatus(token: string) {
  const response = await fetch(resolveApiUrl('/api/robot-screen/status'), {
    headers: {
      Accept: 'application/json',
      'X-Robot-Screen-Token': token,
    },
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json') ? await response.json().catch(() => undefined) : await response.text()
    throw new ApiError(getRawErrorMessage(data, response.statusText || 'Erreur API'), response.status, data)
  }

  return response.json() as Promise<RobotScreenStatus>
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
