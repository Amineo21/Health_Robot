import { useEffect, useRef } from 'react'
import { Layers3 } from 'lucide-react'

import type { AnnotatedPoint, Mission, RobotMapSnapshot } from '@/lib/robot-api'
import { cn } from '@/lib/utils'

type RobotPose = { x: number; y: number; yaw?: number | null }

interface MissionMapViewProps {
  map: RobotMapSnapshot | null
  pose?: RobotPose | null
  points?: AnnotatedPoint[]
  activeMission?: Mission | null
  selectedPointId?: string | null
  className?: string
}

const POINT_STYLE = {
  STOCK: { color: '#34d399', label: 'S' },
  DELIVERY_ROOM: { color: '#38bdf8', label: 'C' },
  ROBOT_BASE: { color: '#fbbf24', label: 'B' },
} as const

export function MissionMapView({ map, pose = null, points = [], activeMission = null, selectedPointId = null, className }: MissionMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !map) return

    canvas.width = map.width
    canvas.height = map.height
    const context = canvas.getContext('2d')
    if (!context) return

    drawOccupancyGrid(context, map)
    if (activeMission) drawMissionRoute(context, map, activeMission)
    drawAnnotatedPoints(context, map, points, selectedPointId)
    if (activeMission) drawMissionTargets(context, map, activeMission)
    if (pose) drawRobotPose(context, map, pose)
  }, [activeMission, map, points, pose, selectedPointId])

  if (!map) {
    return (
      <div className={cn('flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-8 text-center text-sm text-slate-400', className)}>
        <div>
          <Layers3 className="mx-auto mb-3 h-12 w-12 text-slate-500" />
          <p className="font-semibold text-white">Aucune OccupancyGrid reçue</p>
          <p className="mt-2">Démarre le mode mapping ou attends que le robot publie `/map`.</p>
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn('h-auto max-h-[68vh] w-full rounded-xl bg-slate-950 [image-rendering:pixelated]', className)}
      style={{ aspectRatio: `${map.width} / ${map.height}` }}
      aria-label="Carte mission du robot avec points annotés"
    />
  )
}

function drawOccupancyGrid(context: CanvasRenderingContext2D, map: RobotMapSnapshot) {
  const image = context.createImageData(map.width, map.height)
  for (let screenY = 0; screenY < map.height; screenY += 1) {
    const sourceY = map.height - 1 - screenY
    for (let x = 0; x < map.width; x += 1) {
      const value = map.data[sourceY * map.width + x] ?? -1
      const offset = (screenY * map.width + x) * 4
      const [r, g, b] = occupancyColor(value)
      image.data[offset] = r
      image.data[offset + 1] = g
      image.data[offset + 2] = b
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
}

function drawAnnotatedPoints(context: CanvasRenderingContext2D, map: RobotMapSnapshot, points: AnnotatedPoint[], selectedPointId: string | null) {
  points.forEach((point, index) => {
    const screen = mapToCanvas(map, point.x, point.y)
    if (!isOnMap(map, screen)) return
    const style = POINT_STYLE[point.type]
    drawPin(context, screen.x, screen.y, {
      color: style.color,
      label: style.label,
      title: point.name,
      index: index + 1,
      selected: selectedPointId === point.id,
      inactive: !point.is_active,
    })
  })
}

function drawMissionRoute(context: CanvasRenderingContext2D, map: RobotMapSnapshot, mission: Mission) {
  const stock = mapToCanvas(map, mission.stock_x_snapshot, mission.stock_y_snapshot)
  const delivery = mapToCanvas(map, mission.delivery_x_snapshot, mission.delivery_y_snapshot)
  if (!isOnMap(map, stock) && !isOnMap(map, delivery)) return

  context.save()
  context.strokeStyle = '#22d3ee'
  context.lineWidth = Math.max(2, Math.min(map.width, map.height) / 110)
  context.setLineDash([Math.max(5, map.width / 60), Math.max(4, map.width / 90)])
  context.beginPath()
  context.moveTo(stock.x, stock.y)
  context.lineTo(delivery.x, delivery.y)
  context.stroke()
  context.restore()
}

function drawMissionTargets(context: CanvasRenderingContext2D, map: RobotMapSnapshot, mission: Mission) {
  const stock = mapToCanvas(map, mission.stock_x_snapshot, mission.stock_y_snapshot)
  const delivery = mapToCanvas(map, mission.delivery_x_snapshot, mission.delivery_y_snapshot)
  if (isOnMap(map, stock)) {
    drawPin(context, stock.x, stock.y, { color: '#34d399', label: '1', title: mission.stock_point_name_snapshot, selected: true })
  }
  if (isOnMap(map, delivery)) {
    drawPin(context, delivery.x, delivery.y, { color: '#38bdf8', label: '2', title: mission.delivery_room_name_snapshot, selected: true })
  }
}

function drawRobotPose(context: CanvasRenderingContext2D, map: RobotMapSnapshot, pose: RobotPose) {
  const screen = mapToCanvas(map, pose.x, pose.y)
  if (!isOnMap(map, screen)) return

  context.save()
  context.fillStyle = '#34d399'
  context.strokeStyle = '#ecfeff'
  context.lineWidth = Math.max(1, Math.min(map.width, map.height) / 90)
  context.beginPath()
  context.arc(screen.x, screen.y, Math.max(2, Math.min(map.width, map.height) / 35), 0, Math.PI * 2)
  context.fill()
  context.stroke()
  const yaw = pose.yaw ?? 0
  const length = Math.max(5, Math.min(map.width, map.height) / 12)
  context.beginPath()
  context.moveTo(screen.x, screen.y)
  context.lineTo(screen.x + Math.cos(yaw) * length, screen.y - Math.sin(yaw) * length)
  context.stroke()
  context.restore()
}

function drawPin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: { color: string; label: string; title: string; index?: number; selected?: boolean; inactive?: boolean },
) {
  const radius = Math.max(7, Math.min(context.canvas.width, context.canvas.height) / 42)
  const alpha = options.inactive ? 0.45 : 1

  context.save()
  context.globalAlpha = alpha
  context.shadowColor = 'rgba(0, 0, 0, 0.45)'
  context.shadowBlur = radius * 0.7
  context.fillStyle = options.color
  context.strokeStyle = options.selected ? '#ffffff' : '#0f172a'
  context.lineWidth = options.selected ? Math.max(3, radius / 4) : Math.max(2, radius / 5)
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  context.shadowBlur = 0
  context.fillStyle = '#020617'
  context.font = `900 ${Math.max(10, radius * 0.95)}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(options.label, x, y + 0.5)

  const title = options.index ? `${options.index}. ${options.title}` : options.title
  context.font = `700 ${Math.max(10, radius * 0.65)}px sans-serif`
  const textWidth = context.measureText(title).width
  const labelX = Math.min(Math.max(x, textWidth / 2 + 8), context.canvas.width - textWidth / 2 - 8)
  const labelY = Math.max(radius + 14, y - radius - 10)
  context.fillStyle = 'rgba(2, 6, 23, 0.82)'
  roundRect(context, labelX - textWidth / 2 - 6, labelY - 8, textWidth + 12, 17, 5)
  context.fill()
  context.fillStyle = '#f8fafc'
  context.textBaseline = 'middle'
  context.fillText(title, labelX, labelY)
  context.restore()
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function mapToCanvas(map: RobotMapSnapshot, x: number, y: number) {
  return {
    x: (x - map.origin_x) / map.resolution,
    y: map.height - (y - map.origin_y) / map.resolution,
  }
}

function isOnMap(map: RobotMapSnapshot, point: { x: number; y: number }) {
  return point.x >= 0 && point.x <= map.width && point.y >= 0 && point.y <= map.height
}

function occupancyColor(value: number): [number, number, number] {
  if (value < 0) return [30, 41, 59]
  if (value === 0) return [226, 232, 240]
  const shade = Math.max(15, 210 - value * 1.8)
  return [shade, shade, shade]
}
