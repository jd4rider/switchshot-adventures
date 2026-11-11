import { BLASTER_COLORS, LEVEL } from '../config'
import { clamp, mulberry32, pick, range } from '../core/rng'
import type { LevelMeta } from '../data/levels'
import { WORLD_COUNT, worldAt } from '../data/worlds'
import type {
  BlasterMode,
  BossSpec,
  BossWeakPoint,
  CheckpointSpec,
  CrateSpec,
  EnemyKind,
  EnemySpec,
  GemSpec,
  HatchSpec,
  LevelData,
  MirrorSpec,
  MovingPlatformSpec,
  PlateSpec,
  PlatformSpec,
  PlayMode,
  PuzzleKind,
  SeedSpec,
  SwitchSpec,
} from '../types'

export interface GenerateOptions {
  mode?: PlayMode
  stage?: number
  seedSalt?: number
}

const CHAMBER = LEVEL.chamberHeight
export const FLOOR_HEIGHT = LEVEL.floorHeight
export const GAP_WIDTH = LEVEL.gapWidth

export const levelHeightFor = (chambers: number): number => 260 + chambers * CHAMBER
export const floorYFor = (height: number, chamber: number): number => height - 200 - chamber * CHAMBER
export const gapXFor = (chamber: number): number => (chamber % 2 === 0 ? 90 : 430)
export const gapCenterFor = (chamber: number): number => gapXFor(chamber) + GAP_WIDTH / 2

const PUZZLE_KINDS: PuzzleKind[] = ['switch', 'timed', 'sequence', 'mirror', 'circuit', 'growth', 'gravity']

function modesForWorld(worldIndex: number): BlasterMode[] {
  const modes: BlasterMode[] = ['pulse']
  if (worldIndex >= 3) modes.push('volt')
  if (worldIndex >= 4) modes.push('growth')
  if (worldIndex >= 5) modes.push('gravity')
  return modes
}

function puzzlePool(worldIndex: number): PuzzleKind[] {
  const pool: PuzzleKind[] = ['switch', 'switch']
  if (worldIndex >= 1) pool.push('timed')
  if (worldIndex >= 2) pool.push('sequence')
  if (worldIndex >= 2) pool.push('mirror')
  if (worldIndex >= 3) pool.push('circuit')
  if (worldIndex >= 4) pool.push('growth')
  if (worldIndex >= 5) pool.push('gravity')
  return pool
}

function enemyPool(worldIndex: number): EnemyKind[] {
  if (worldIndex <= 1) return ['wobblebot', 'hopper']
  if (worldIndex <= 3) return ['wobblebot', 'hopper', 'drone']
  if (worldIndex <= 6) return ['hopper', 'drone', 'shieldbug', 'wobblebot']
  return ['drone', 'shieldbug', 'hopper']
}

function chamberCount(meta: LevelMeta, stage: number, mode: PlayMode): number {
  if (mode === 'challenge') return 6
  if (stage > 0) return clamp(6 + Math.floor(stage / 3), 6, 10)
  return clamp(6 + Math.floor(meta.worldIndex / 2) + (meta.levelNumber > 25 ? 1 : 0), 6, 10)
}

function floorSegments(floorY: number, gapX: number): PlatformSpec[] {
  const segments: PlatformSpec[] = []
  if (gapX > 30) segments.push({ x: 0, y: floorY, width: gapX, height: FLOOR_HEIGHT, kind: 'solid', role: 'floor' })
  const rightX = gapX + GAP_WIDTH
  if (720 - rightX > 30) segments.push({ x: rightX, y: floorY, width: 720 - rightX, height: FLOOR_HEIGHT, kind: 'solid', role: 'floor' })
  return segments
}

function widerSegment(segments: PlatformSpec[]): PlatformSpec {
  return segments.reduce((best, segment) => (segment.width > best.width ? segment : best), segments[0])
}

export function generateLevel(meta: LevelMeta, options: GenerateOptions = {}): LevelData {
  const mode: PlayMode = options.mode ?? 'journey'
  const stage = options.stage ?? 0
  const endless = mode === 'endless'
  const worldIndex = endless ? Math.min(WORLD_COUNT - 1, Math.floor(stage / 3)) : meta.worldIndex
  const world = worldAt(worldIndex)
  const seed = (options.seedSalt ? meta.seed ^ options.seedSalt : meta.seed) >>> 0
  const random = mulberry32(seed)
  const chambers = chamberCount({ ...meta, worldIndex }, stage, mode)
  const height = levelHeightFor(chambers)
  const bossFight = meta.boss && !endless && mode !== 'speedrun' && mode !== 'daily'
  const availableModes = modesForWorld(worldIndex)
  const puzzleKinds = puzzlePool(worldIndex)
  const hasGravity = availableModes.includes('gravity')
  const difficultyShift = stage > 0 ? Math.min(4, Math.floor(stage / 5)) : 0

  const platforms: PlatformSpec[] = []
  const movingPlatforms: MovingPlatformSpec[] = []
  const hatches: HatchSpec[] = []
  const switches: SwitchSpec[] = []
  const mirrors: MirrorSpec[] = []
  const crates: CrateSpec[] = []
  const plates: PlateSpec[] = []
  const seeds: SeedSpec[] = []
  const gems: GemSpec[] = []
  const enemies: EnemySpec[] = []
  const checkpoints: CheckpointSpec[] = []
  const puzzles: PuzzleKind[] = []

  let switchCounter = 0
  let mirrorCounter = 0

  for (let index = 0; index < chambers; index += 1) {
    const floorY = floorYFor(height, index)
    const gapX = gapXFor(index)
    const segments = floorSegments(floorY, gapX)
    platforms.push(...segments)

    const nextExists = index < chambers - 1
    const nextFloorY = floorYFor(height, index + 1)
    const target = gapCenterFor(index + 1)
    // Keep the switch pocket and its mirror on the roomier side of the hatch.
    const side: 1 | -1 = target > 360 ? -1 : 1
    const kind: PuzzleKind = nextExists
      ? index === 0 && (worldIndex < 2 || mode === 'daily')
        ? 'switch'
        : pick(random, puzzleKinds)
      : 'switch'
    const growthGate = nextExists && kind === 'growth'
    const puzzleKind: PuzzleKind = kind === 'growth' ? 'growth' : kind

    // --- climb staircase toward the next hatch -----------------------------
    const stepTop = floorY - 110
    const stepMid = floorY - 220
    const stepHigh = floorY - 320
    const clampX = (x: number): number => clamp(x, 14, 720 - 204)
    const stepA: PlatformSpec = {
      x: clampX(target + side * 300 - 95),
      y: stepTop,
      width: 190,
      height: 18,
      kind: worldIndex === 6 && index % 2 === 0 ? 'bounce' : 'solid',
      role: 'stair',
    }
    const stepB: PlatformSpec = {
      x: clampX(target + side * 150 - 95),
      y: stepMid,
      width: 190,
      height: 18,
      kind: 'solid',
      role: 'stair',
    }
    const stepC: PlatformSpec = {
      x: clampX(target - 95),
      y: stepHigh,
      width: 190,
      height: 18,
      kind: 'solid',
      role: 'stair',
    }
    platforms.push(stepA, stepB)
    if (growthGate) {
      seeds.push({
        id: `seed-${index}`,
        x: stepB.x + stepB.width - 44,
        y: stepB.y - 52,
        platform: { ...stepC },
      })
    } else {
      platforms.push(stepC)
    }

    // --- reward gems above the climb ---------------------------------------
    gems.push({ x: stepA.x + stepA.width / 2, y: stepA.y - 54, variant: index % 3, optional: false })
    gems.push({ x: stepB.x + stepB.width / 2, y: stepB.y - 54, variant: (index + 1) % 3, optional: false })
    gems.push({ x: stepC.x + stepC.width / 2, y: stepC.y - 54, variant: (index + 2) % 3, optional: false })

    if (index % 2 === 0 && index > 0) {
      const optionalX = side > 0 ? 120 : 600
      if (Math.abs(optionalX - target) > 160) {
        gems.push({ x: optionalX, y: floorY - 300, variant: 3, optional: true })
      }
    }

    // --- the hatch above this chamber and the puzzle that opens it ---------
    if (nextExists) {
      const hatchId = `hatch-${index + 1}`
      const switchIds: string[] = []
      const switchY = nextFloorY + 46
      const switchX = clamp(target + side * 150, 96, 624)
      puzzles.push(puzzleKind)

      if (puzzleKind === 'gravity' && hasGravity) {
        const plateX = clamp(target + side * -10, 120, 600)
        const crateX = clamp(plateX + side * 220, 90, 640)
        plates.push({ id: `plate-${index}`, x: plateX - 60, y: floorY - 12, width: 120, height: 12, hatchId })
        crates.push({ id: `crate-${index}`, x: crateX - 22, y: floorY - 44, width: 44, height: 44 })
      } else if (puzzleKind === 'mirror') {
        switchCounter += 1
        const pocketX = clamp(target + side * 200, 100, 620)
        const id = `switch-${switchCounter}`
        switchIds.push(id)
        switches.push({ id, x: pocketX, y: switchY, requiredMode: 'pulse', accent: BLASTER_COLORS.pulse })
        // The switch sits in a pocket sealed below and on the far side, open
        // only toward its mirror. The mirror turns an upward shot sideways.
        platforms.push({ x: pocketX - side * 80, y: nextFloorY, width: 20, height: 100, kind: 'solid', role: 'prop' })
        platforms.push({ x: pocketX - 45, y: nextFloorY + 100, width: 90, height: 20, kind: 'solid', role: 'prop' })
        mirrorCounter += 1
        mirrors.push({
          id: `mirror-${mirrorCounter}`,
          x: pocketX + side * 80,
          y: nextFloorY + 46,
          width: 44,
          height: 44,
          orientation: side > 0 ? '\\' : '/',
        })
      } else if (puzzleKind === 'sequence') {
        const first: SwitchSpec = {
          id: `switch-${++switchCounter}`,
          x: clamp(target + side * 150, 96, 624),
          y: switchY,
          requiredMode: 'pulse',
          order: 1,
          accent: BLASTER_COLORS.pulse,
        }
        const second: SwitchSpec = {
          id: `switch-${++switchCounter}`,
          x: clamp(target - side * 150, 96, 624),
          y: switchY,
          requiredMode: 'pulse',
          order: 2,
          accent: BLASTER_COLORS.growth,
        }
        switches.push(first, second)
        switchIds.push(first.id, second.id)
      } else if (puzzleKind === 'circuit') {
        const id = `switch-${++switchCounter}`
        switchIds.push(id)
        switches.push({ id, x: switchX, y: switchY, requiredMode: 'volt', accent: BLASTER_COLORS.volt })
      } else {
        const id = `switch-${++switchCounter}`
        switchIds.push(id)
        switches.push({ id, x: switchX, y: switchY, requiredMode: 'pulse', accent: BLASTER_COLORS.pulse })
      }

      hatches.push({
        id: hatchId,
        x: gapXFor(index + 1),
        y: nextFloorY,
        width: GAP_WIDTH,
        height: FLOOR_HEIGHT,
        switchIds,
        puzzle: puzzleKind,
        timedMs: puzzleKind === 'timed' ? Math.max(5200, 7600 - worldIndex * 220 - difficultyShift * 300) : 0,
      })
    }

    // --- checkpoint relays -------------------------------------------------
    if (index > 0 && (index === 3 || index === 6)) {
      const segment = widerSegment(segments)
      checkpoints.push({
        x: segment.x + segment.width / 2,
        y: floorY - 40,
        label: `Chamber ${index + 1}`,
      })
    }

    // --- playful machines --------------------------------------------------
    // The guardian room is an arena, so no patrolling enemies spawn in it.
    const guardianArena = bossFight && index === chambers - 1
    if (!guardianArena && (index > 0 || mode === 'endless' || worldIndex > 0 || meta.levelNumber > 2)) {
      const segment = widerSegment(segments)
      const spot = segment.x + 70 + random() * Math.max(1, segment.width - 140)
      const enemyKind = pick(random, enemyPool(worldIndex))
      const floorEnemy = enemyKind !== 'drone'
      enemies.push({
        x: spot,
        y: floorEnemy ? floorY - 34 : floorY - 190,
        kind: enemyKind,
        range: range(random, 70, 130),
        speed: 40 + random() * 26 + worldIndex * 2,
        variant: (worldIndex * 3 + index) % 4,
      })
    }

    // --- optional moving machinery ----------------------------------------
    if (index >= 2 && index % 3 === 0) {
      movingPlatforms.push({
        x: clamp(side > 0 ? 90 : 470, 70, 570),
        y: floorY - 170,
        width: 118,
        height: 16,
        axis: 'x',
        distance: 70,
        speed: 34 + random() * 14,
        phase: random(),
      })
    }
  }

  // --- boss arena ---------------------------------------------------------
  let boss: BossSpec | null = null
  if (bossFight) {
    const arenaFloor = floorYFor(height, chambers - 1)
    const weakPoints: BossWeakPoint[] = [0, 1, 2].map((order) => ({
      id: `boss-weak-${order + 1}`,
      x: 200 + order * 160,
      y: arenaFloor - 250 - (order % 2) * 40,
      order: order + 1,
    }))
    boss = {
      x: 360,
      y: arenaFloor - 330,
      name: world.name + ' Guardian',
      weakPoints,
      shotIntervalMs: Math.max(900, 1700 - worldIndex * 70),
      color: world.palette.accentTwo ? Number.parseInt(world.palette.accentTwo.slice(1), 16) : 0xffffff,
    }
  }

  const bottomSegments = floorSegments(floorYFor(height, 0), gapXFor(0))
  const startSegment = widerSegment(bottomSegments)
  const topSegments = floorSegments(floorYFor(height, chambers - 1), gapXFor(chambers - 1))
  const exitSegment = widerSegment(topSegments)
  const startX = startSegment.x + startSegment.width * 0.35
  const exitX = exitSegment.x + exitSegment.width * 0.5

  return {
    id: meta.id,
    worldIndex,
    levelNumber: meta.levelNumber,
    name: meta.name,
    seed,
    width: LEVEL.width,
    height,
    chambers,
    start: { x: clamp(startX, 40, 680), y: floorYFor(height, 0) - 50 },
    exit: { x: clamp(exitX, 60, 660), y: floorYFor(height, chambers - 1) - 50 },
    platforms,
    movingPlatforms,
    hatches,
    switches,
    mirrors,
    crates,
    plates,
    seeds,
    gems,
    enemies,
    checkpoints,
    puzzles,
    requiredGems: gems.filter((gem) => !gem.optional).length,
    availableModes,
    boss,
  }
}

/** The platform top a player stands on at a point, used by the validator. */
export function standingPlatformAt(level: LevelData, x: number, y: number): PlatformSpec | null {
  let best: PlatformSpec | null = null
  for (const platform of level.platforms) {
    if (x < platform.x || x > platform.x + platform.width) continue
    if (platform.y < y) continue
    if (!best || platform.y < best.y) best = platform
  }
  return best
}

export function allPuzzles(): PuzzleKind[] {
  return [...PUZZLE_KINDS]
}
