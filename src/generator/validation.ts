import { ALL_LEVELS, LEVELS_PER_WORLD, TOTAL_LEVELS, dailyMeta, getLevelMeta, levelId } from '../data/levels'
import { WORLD_COUNT, worldAt } from '../data/worlds'
import type { LevelData, MirrorSpec, Rect } from '../types'
import { floorYFor, gapCenterFor, gapXFor, generateLevel, levelHeightFor } from './level'

export interface LevelReport {
  id: string
  errors: string[]
}

/** Liang–Barsky clip. Returns the entry t in [0,1] or null when the segment misses. */
export function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, rect: Rect): number | null {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height
  const dx = x2 - x1
  const dy = y2 - y1
  let tMin = 0
  let tMax = 1
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > tMax) return false
      if (r > tMin) tMin = r
    } else {
      if (r < tMin) return false
      if (r < tMax) tMax = r
    }
    return true
  }
  if (!clip(-dx, x1 - left)) return null
  if (!clip(dx, right - x1)) return null
  if (!clip(-dy, y1 - top)) return null
  if (!clip(dy, bottom - y1)) return null
  return tMin
}

/** Reflection about an axis-aligned 45° mirror surface normal. */
export function reflect(dx: number, dy: number, mirror: MirrorSpec): { dx: number; dy: number } {
  const inv = Math.SQRT1_2
  const nx = inv
  const ny = mirror.orientation === '/' ? inv : -inv
  const dot = dx * nx + dy * ny
  return { dx: dx - 2 * dot * nx, dy: dy - 2 * dot * ny }
}

export interface ShotHit {
  kind: 'switch' | 'mirror' | 'blocked' | 'miss'
  id?: string
  x: number
  y: number
  ricochets: number
}

interface TraceOptions {
  switchIds: Set<string>
  seedId?: string
  maxBounces?: number
  ignorePlatform?: Rect
}

export function traceShot(
  level: LevelData,
  fromX: number,
  fromY: number,
  dirX: number,
  dirY: number,
  options: TraceOptions,
): ShotHit {
  const maxBounces = options.maxBounces ?? 3
  let x = fromX
  let y = fromY
  let dx = dirX
  let dy = dirY
  let bounces = 0
  const blockers: Rect[] = [...level.platforms, ...level.hatches, ...level.crates].filter(
    (rect) => !options.ignorePlatform || rect !== options.ignorePlatform,
  )
  for (let pass = 0; pass < maxBounces + 4; pass += 1) {
    let closest = Number.POSITIVE_INFINITY
    let hitSwitch: string | undefined
    let hitMirror: MirrorSpec | undefined
    let blocked = false

    if (options.switchIds.size > 0) {
      for (const target of level.switches) {
        if (!options.switchIds.has(target.id)) continue
        const ox = target.x - x
        const oy = target.y - y
        const proj = ox * dx + oy * dy
        if (proj <= 0) continue
        const perp = Math.abs(ox * dy - oy * dx)
        if (perp > 26) continue
        if (proj < closest) {
          closest = proj
          hitSwitch = target.id
          hitMirror = undefined
          blocked = false
        }
      }
    }
    for (const mirror of level.mirrors) {
      const rect: Rect = {
        x: mirror.x - mirror.width / 2,
        y: mirror.y - mirror.height / 2,
        width: mirror.width,
        height: mirror.height,
      }
      const t = segmentHitsRect(x, y, x + dx * 4000, y + dy * 4000, rect)
      if (t !== null && t * 4000 < closest) {
        closest = t * 4000
        hitMirror = mirror
        hitSwitch = undefined
        blocked = false
      }
    }
    for (const rect of blockers) {
      if (rect.width <= 0 || rect.height <= 0) continue
      // The platform under the shooter is not in the line of fire.
      if (
        Math.abs(rect.y - (y + 57)) < 8 &&
        fromX >= rect.x - 2 &&
        fromX <= rect.x + rect.width + 2
      ) {
        continue
      }
      const t = segmentHitsRect(x, y, x + dx * 4000, y + dy * 4000, rect)
      if (t !== null && t * 4000 < closest) {
        closest = t * 4000
        blocked = true
        hitSwitch = undefined
        hitMirror = undefined
      }
    }

    if (options.seedId) {
      const seed = level.seeds.find((entry) => entry.id === options.seedId)
      if (seed) {
        const ox = seed.x - x
        const oy = seed.y - y
        const proj = ox * dx + oy * dy
        if (proj > 0 && Math.abs(ox * dy - oy * dx) <= 30 && proj < closest) {
          closest = proj
          blocked = false
          hitSwitch = undefined
          hitMirror = undefined
          return { kind: 'switch', id: seed.id, x: seed.x, y: seed.y, ricochets: bounces }
        }
      }
    }

    if (!Number.isFinite(closest)) return { kind: 'miss', x, y, ricochets: bounces }
    const nx = x + dx * closest
    const ny = y + dy * closest
    if (hitSwitch) return { kind: 'switch', id: hitSwitch, x: nx, y: ny, ricochets: bounces }
    if (hitMirror) {
      bounces += 1
      if (bounces > maxBounces) return { kind: 'blocked', x: nx, y: ny, ricochets: bounces }
      const next = reflect(dx, dy, hitMirror)
      x = nx + next.dx * 2
      y = ny + next.dy * 2
      dx = next.dx
      dy = next.dy
      continue
    }
    return { kind: blocked ? 'blocked' : 'miss', x: nx, y: ny, ricochets: bounces }
  }
  return { kind: 'blocked', x, y, ricochets: bounces }
}

export function standingPoints(level: LevelData, minY: number, maxY: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  const add = (platform: Rect): void => {
    if (platform.y < minY || platform.y > maxY) return
    const muzzleY = platform.y - 57
    for (let x = platform.x + 12; x <= platform.x + platform.width - 12; x += 26) {
      points.push({ x, y: muzzleY })
    }
  }
  level.platforms.forEach(add)
  level.seeds.forEach((seed) => add(seed.platform))
  return points
}

/** True when a switch can be hit from at least one reachable firing position. */
export function switchIsShootable(level: LevelData, switchId: string): boolean {
  const target = level.switches.find((entry) => entry.id === switchId)
  if (!target) return false
  const points = standingPoints(level, target.y - 470, target.y + 470)
  const ids = new Set([switchId])
  for (const point of points) {
    const aims = [{ x: target.x, y: target.y }, ...level.mirrors.map((mirror) => ({ x: mirror.x, y: mirror.y }))]
    for (const aim of aims) {
      const length = Math.hypot(aim.x - point.x, aim.y - point.y)
      if (length < 8) continue
      const hit = traceShot(level, point.x, point.y, (aim.x - point.x) / length, (aim.y - point.y) / length, { switchIds: ids })
      if (hit.kind === 'switch' && hit.id === switchId) return true
    }
  }
  return false
}

export function seedIsShootable(level: LevelData, seedId: string): boolean {
  const seed = level.seeds.find((entry) => entry.id === seedId)
  if (!seed) return false
  const points = standingPoints(level, seed.y - 350, seed.y + 350)
  for (const point of points) {
    const length = Math.hypot(seed.x - point.x, seed.y - point.y)
    if (length < 10) continue
    const hit = traceShot(level, point.x, point.y, (seed.x - point.x) / length, (seed.y - point.y) / length, {
      switchIds: new Set(),
      seedId,
    })
    if (hit.kind === 'switch' && hit.id === seedId) return true
  }
  return false
}

export function crateIsShovable(level: LevelData, plateId: string): boolean {
  const plate = level.plates.find((entry) => entry.id === plateId)
  if (!plate) return false
  return level.crates.some((crate) => {
    if (Math.abs(crate.y + crate.height - (plate.y + plate.height)) > 8) return false
    const gap = Math.abs(crate.x + crate.width / 2 - (plate.x + plate.width / 2))
    return gap >= 120 && gap <= 320
  })
}

export function validateLevel(level: LevelData): string[] {
  const errors: string[] = []
  const bounds = (rect: Rect, label: string): void => {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
      errors.push(`${label} is not finite`)
      return
    }
    if (rect.x < -1 || rect.y < -1 || rect.x + rect.width > level.width + 1 || rect.y + rect.height > level.height + 1) {
      errors.push(`${label} is out of bounds`)
    }
  }

  level.platforms.forEach((platform, index) => bounds(platform, `platform ${index}`))
  level.hatches.forEach((hatch) => bounds(hatch, `hatch ${hatch.id}`))
  level.crates.forEach((crate) => bounds(crate, `crate ${crate.id}`))
  level.seeds.forEach((seed) => bounds(seed.platform, `grown platform ${seed.id}`))
  level.gems.forEach((gem) => {
    if (gem.x < 0 || gem.x > level.width || gem.y < 0 || gem.y > level.height) {
      errors.push(`gem at ${Math.round(gem.x)},${Math.round(gem.y)} is out of bounds`)
    }
  })

  if (level.start.y <= level.exit.y) errors.push('start is not below the exit')
  if (level.start.x < 0 || level.start.x > level.width) errors.push('start x is invalid')
  if (level.exit.x < 0 || level.exit.x > level.width) errors.push('exit x is invalid')
  if (level.height !== levelHeightFor(level.chambers)) errors.push('height does not match chamber count')
  if (level.chambers < 6) errors.push('too few chambers')

  for (const hatch of level.hatches) {
    if (hatch.puzzle === 'gravity') {
      const plate = level.plates.find((entry) => entry.hatchId === hatch.id)
      if (!plate) errors.push(`hatch ${hatch.id} has no pressure plate`)
      else if (!crateIsShovable(level, plate.id)) errors.push(`hatch ${hatch.id} plate cannot be reached by a crate`)
      continue
    }
    if (hatch.switchIds.length === 0) errors.push(`hatch ${hatch.id} has no switch`)
    for (const switchId of hatch.switchIds) {
      const target = level.switches.find((entry) => entry.id === switchId)
      if (!target) {
        errors.push(`hatch ${hatch.id} references missing switch ${switchId}`)
        continue
      }
      if (target.y <= hatch.y) errors.push(`switch ${switchId} is not below its hatch`)
      if (!level.availableModes.includes(target.requiredMode)) {
        errors.push(`switch ${switchId} needs locked mode ${target.requiredMode}`)
      }
      if (!switchIsShootable(level, switchId)) errors.push(`switch ${switchId} is not shootable`)
    }
    if (hatch.puzzle === 'sequence' && hatch.switchIds.length < 2) {
      errors.push(`sequence hatch ${hatch.id} needs two switches`)
    }
  }

  for (const seed of level.seeds) {
    if (!level.availableModes.includes('growth')) errors.push('growth seed exists without the growth blaster')
    if (!seedIsShootable(level, seed.id)) errors.push(`seed ${seed.id} is not shootable`)
  }

  // Climb chain: every chamber's staircase must be jumpable and lead to its hatch.
  for (let index = 0; index < level.chambers; index += 1) {
    const floorY = floorYFor(level.height, index)
    const steps = [
      ...level.platforms.filter((platform) => platform.role === 'stair' && platform.y < floorY && platform.y >= floorY - 340),
      ...level.seeds.map((seed) => seed.platform).filter((platform) => platform.y < floorY && platform.y >= floorY - 340),
    ].sort((a, b) => b.y - a.y)
    if (steps.length < 3) {
      errors.push(`chamber ${index} has ${steps.length} climb steps`)
      continue
    }
    let previous = { x: level.width / 2, y: floorY }
    for (const step of steps) {
      const rise = previous.y - step.y
      if (rise > 125) errors.push(`chamber ${index} step rises ${Math.round(rise)}`)
      const gap = Math.abs(step.x + step.width / 2 - previous.x) - step.width / 2
      if (gap > 190) errors.push(`chamber ${index} step gap ${Math.round(gap)}`)
      previous = { x: step.x + step.width / 2, y: step.y }
    }
    const nextFloor = floorY - 420
    if (previous.y - nextFloor > 130) errors.push(`chamber ${index} top step cannot reach the hatch`)
  }

  if (level.boss) {
    if (level.boss.weakPoints.length < 3) errors.push('boss has fewer than three weak points')
    for (const weak of level.boss.weakPoints) {
      if (weak.x < 0 || weak.x > level.width || weak.y < 0 || weak.y > level.height) {
        errors.push(`boss weak point ${weak.id} is out of bounds`)
      }
    }
    if (level.enemies.some((enemy) => enemy.y < level.exit.y + 120)) errors.push('boss arena contains stray enemies')
  }

  if (level.requiredGems !== level.gems.filter((gem) => !gem.optional).length) errors.push('required gem count is wrong')
  if (!level.availableModes.includes('pulse')) errors.push('pulse is not available')
  if (level.puzzles.length !== Math.max(0, level.chambers - 1)) errors.push('puzzle count does not match hatches')
  if (level.switches.length === 0 && level.plates.length === 0 && level.hatches.length > 0) errors.push('no puzzle wiring exists')

  return errors
}

export function validateAllLevels(): LevelReport[] {
  return ALL_LEVELS.map((meta) => ({ id: meta.id, errors: validateLevel(generateLevel(meta)) }))
}

export function catalogErrors(): string[] {
  const errors: string[] = []
  if (ALL_LEVELS.length !== TOTAL_LEVELS) errors.push(`expected ${TOTAL_LEVELS} levels, got ${ALL_LEVELS.length}`)
  if (WORLD_COUNT !== 10) errors.push(`expected 10 worlds, got ${WORLD_COUNT}`)
  for (let world = 0; world < WORLD_COUNT; world += 1) {
    const levels = ALL_LEVELS.filter((level) => level.worldIndex === world)
    if (levels.length !== LEVELS_PER_WORLD) errors.push(`world ${world + 1} has ${levels.length} levels`)
    if (levels.filter((level) => level.boss).length !== 1) errors.push(`world ${world + 1} needs exactly one boss`)
    if (levels.at(-1)?.id !== levelId(world, LEVELS_PER_WORLD)) errors.push(`world ${world + 1} boss id is wrong`)
    if (!worldAt(world).name) errors.push(`world ${world + 1} has no name`)
  }
  const dailyA = dailyMeta('2026-11-11')
  const dailyB = dailyMeta('2026-11-11')
  if (dailyA.seed !== dailyB.seed || dailyA.id !== dailyB.id) errors.push('daily challenge is not deterministic')
  return errors
}

export function progressionProbe(): string[] {
  const errors: string[] = []
  if (!getLevelMeta('w1-1')) errors.push('first level is missing')
  if (getLevelMeta('w11-1')) errors.push('catalogue accepts an eleventh world')
  const level = generateLevel(getLevelMeta('w5-25') ?? ALL_LEVELS[0])
  if (level.chambers < 6) errors.push('mid-campaign level is too short')
  if (!level.availableModes.includes('growth')) errors.push('growth blaster is missing in world five')
  if (level.start.y <= level.exit.y) errors.push('generated start/exit order is inverted')
  if (Math.abs(level.exit.x - gapCenterFor(level.chambers - 1)) < 60) errors.push('exit overlaps a hatch')
  return errors
}

/** Counts how many required switches across the campaign genuinely need a bounce. */
export function mirrorSolutionCount(): number {
  let count = 0
  for (const meta of ALL_LEVELS) {
    const level = generateLevel(meta)
    for (const switchEntry of level.switches) {
      if (!switchIsShootable(level, switchEntry.id)) continue
      const direct = standingPoints(level, switchEntry.y - 470, switchEntry.y + 470).some((point) => {
        const length = Math.hypot(switchEntry.x - point.x, switchEntry.y - point.y)
        if (length < 8) return false
        const hit = traceShot(level, point.x, point.y, (switchEntry.x - point.x) / length, (switchEntry.y - point.y) / length, {
          switchIds: new Set([switchEntry.id]),
        })
        return hit.kind === 'switch'
      })
      const mirrored = standingPoints(level, switchEntry.y - 470, switchEntry.y + 470).some((point) =>
        level.mirrors.some((mirror) => {
          const length = Math.hypot(mirror.x - point.x, mirror.y - point.y)
          if (length < 8) return false
          const hit = traceShot(level, point.x, point.y, (mirror.x - point.x) / length, (mirror.y - point.y) / length, {
            switchIds: new Set([switchEntry.id]),
          })
          return hit.kind === 'switch' && hit.ricochets > 0
        }),
      )
      if (mirrored && !direct) count += 1
    }
  }
  return count
}

export { generateLevel, gapXFor, levelHeightFor }
