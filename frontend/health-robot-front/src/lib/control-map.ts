export interface ControlMapBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ControlMapRect {
  left: number
  top: number
  width: number
  height: number
}

export interface ControlMapMetadata {
  width: number
  height: number
  resolution: number
  origin_x: number
  origin_y: number
}

export const DEFAULT_CONTROL_MAP_BOUNDS: ControlMapBounds = {
  minX: -5,
  maxX: 5,
  minY: -5,
  maxY: 5,
}

export function mapMetadataToBounds(map: ControlMapMetadata): ControlMapBounds {
  return {
    minX: map.origin_x,
    maxX: map.origin_x + map.width * map.resolution,
    minY: map.origin_y,
    maxY: map.origin_y + map.height * map.resolution,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function roundMapCoordinate(value: number) {
  return Math.round(value * 100) / 100
}

export function screenPointToMapCoordinates(
  clientX: number,
  clientY: number,
  rect: ControlMapRect,
  bounds: ControlMapBounds = DEFAULT_CONTROL_MAP_BOUNDS,
) {
  const xRatio = rect.width === 0 ? 0.5 : clamp((clientX - rect.left) / rect.width, 0, 1)
  const yRatio = rect.height === 0 ? 0.5 : clamp((clientY - rect.top) / rect.height, 0, 1)

  return {
    x: roundMapCoordinate(bounds.minX + xRatio * (bounds.maxX - bounds.minX)),
    y: roundMapCoordinate(bounds.maxY - yRatio * (bounds.maxY - bounds.minY)),
  }
}

export function mapCoordinatesToPercent(
  x: number,
  y: number,
  bounds: ControlMapBounds = DEFAULT_CONTROL_MAP_BOUNDS,
) {
  const xRatio = (x - bounds.minX) / (bounds.maxX - bounds.minX)
  const yRatio = (bounds.maxY - y) / (bounds.maxY - bounds.minY)

  return {
    left: clamp(xRatio * 100, 0, 100),
    top: clamp(yRatio * 100, 0, 100),
  }
}

export function formatMapCoordinate(value: number) {
  return roundMapCoordinate(value).toFixed(2)
}
