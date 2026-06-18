import { describe, expect, it } from 'vitest'

import { mapCoordinatesToPercent, mapMetadataToBounds, screenPointToMapCoordinates } from './control-map'

const rect = { left: 100, top: 50, width: 200, height: 200 }

describe('control map coordinates', () => {
  it('maps center click to map origin', () => {
    expect(screenPointToMapCoordinates(200, 150, rect)).toEqual({ x: 0, y: 0 })
  })

  it('maps right side to positive X and top side to positive Y', () => {
    expect(screenPointToMapCoordinates(300, 50, rect)).toEqual({ x: 5, y: 5 })
  })

  it('clamps clicks outside the map', () => {
    expect(screenPointToMapCoordinates(500, 500, rect)).toEqual({ x: 5, y: -5 })
  })

  it('converts map coordinates back to marker percent', () => {
    expect(mapCoordinatesToPercent(0, 0)).toEqual({ left: 50, top: 50 })
    expect(mapCoordinatesToPercent(5, 5)).toEqual({ left: 100, top: 0 })
  })

  it('builds bounds from ROS map metadata', () => {
    expect(mapMetadataToBounds({ width: 100, height: 80, resolution: 0.05, origin_x: -2, origin_y: -1.5 })).toEqual({
      minX: -2,
      maxX: 3,
      minY: -1.5,
      maxY: 2.5,
    })
  })
})
