import { hashString } from '../core/rng'
import type { BlasterMode, SaveData, WorldTheme } from '../types'
import { WORLD_COUNT, worldAt } from './worlds'

export const LEVELS_PER_WORLD = 50
export const TOTAL_LEVELS = WORLD_COUNT * LEVELS_PER_WORLD

export interface LevelMeta {
  id: string
  worldIndex: number
  levelNumber: number
  name: string
  seed: number
  boss: boolean
  difficulty: number
}

const ADJECTIVES = [
  'Amber', 'Breezy', 'Bright', 'Bouncing', 'Chiming', 'Cobalt', 'Copper', 'Crystal',
  'Dancing', 'Dappled', 'Electric', 'Floating', 'Frosted', 'Gilded', 'Glowing', 'Golden',
  'Hidden', 'Humming', 'Lively', 'Lucky', 'Lunar', 'Magnetic', 'Misty', 'Neon',
  'Playful', 'Quiet', 'Radiant', 'Rapid', 'Ringing', 'Rising', 'Rolling', 'Silver',
  'Singing', 'Skipping', 'Sparkling', 'Spinning', 'Starlit', 'Sunny', 'Tender', 'Thunder',
  'Velvet', 'Wandering', 'Winding', 'Wondrous', 'Zippy', 'Bright-Eyed', 'Whistling', 'Giggling',
  'Tumbling', 'Polished',
] as const

const NOUNS = [
  'Antenna', 'Archway', 'Balloon', 'Beacon', 'Belt', 'Bridge', 'Cable', 'Cadence',
  'Chime', 'Circuit', 'Cog', 'Conduit', 'Crate', 'Crystal', 'Drum', 'Elevator',
  'Fan', 'Gantry', 'Gear', 'Glimmer', 'Hatch', 'Hoist', 'Key', 'Lantern',
  'Ledge', 'Lift', 'Loom', 'Meadow', 'Mirror', 'Nook', 'Overture', 'Pedestal',
  'Piston', 'Portal', 'Pulse', 'Relay', 'Ribbon', 'Rocket', 'Shaft', 'Signal',
  'Spindle', 'Spring', 'Stair', 'Star', 'Switch', 'Tower', 'Valve', 'Vine',
  'Wheel', 'Window',
] as const

export function levelId(worldIndex: number, levelNumber: number): string {
  return `w${worldIndex + 1}-${levelNumber}`
}

export function parseLevelId(id: string): { worldIndex: number; levelNumber: number } | null {
  const match = /^w(\d{1,2})-(\d{1,2})$/.exec(id)
  if (!match) return null
  const worldIndex = Number(match[1]) - 1
  const levelNumber = Number(match[2])
  if (worldIndex < 0 || worldIndex >= WORLD_COUNT) return null
  if (levelNumber < 1 || levelNumber > LEVELS_PER_WORLD) return null
  return { worldIndex, levelNumber }
}

export function levelName(worldIndex: number, levelNumber: number): string {
  if (levelNumber === LEVELS_PER_WORLD) return worldAt(worldIndex).name + ' Guardian'
  const adjective = ADJECTIVES[(levelNumber - 1) % ADJECTIVES.length]
  const noun = NOUNS[(levelNumber * 7 + worldIndex * 13) % NOUNS.length]
  return `${adjective} ${noun}`
}

function buildCatalog(): LevelMeta[] {
  const out: LevelMeta[] = []
  for (let worldIndex = 0; worldIndex < WORLD_COUNT; worldIndex += 1) {
    for (let levelNumber = 1; levelNumber <= LEVELS_PER_WORLD; levelNumber += 1) {
      const id = levelId(worldIndex, levelNumber)
      const boss = levelNumber === LEVELS_PER_WORLD
      out.push({
        id,
        worldIndex,
        levelNumber,
        name: levelName(worldIndex, levelNumber),
        seed: hashString(`switchshot:${id}:v1`),
        boss,
        difficulty: Math.min(10, 1 + Math.floor(((worldIndex * LEVELS_PER_WORLD + levelNumber) / TOTAL_LEVELS) * 10)),
      })
    }
  }
  return out
}

export const ALL_LEVELS: LevelMeta[] = buildCatalog()
export const LEVELS_BY_ID = new Map(ALL_LEVELS.map((level) => [level.id, level]))

export function getLevelMeta(id: string): LevelMeta | undefined {
  return LEVELS_BY_ID.get(id)
}

export function levelsForWorld(worldIndex: number): LevelMeta[] {
  return ALL_LEVELS.filter((level) => level.worldIndex === worldIndex)
}

export function nextLevelId(id: string): string | null {
  const meta = getLevelMeta(id)
  if (!meta) return null
  if (meta.worldIndex === WORLD_COUNT - 1 && meta.levelNumber === LEVELS_PER_WORLD) return null
  if (meta.levelNumber === LEVELS_PER_WORLD) return levelId(meta.worldIndex + 1, 1)
  return levelId(meta.worldIndex, meta.levelNumber + 1)
}

export function levelUnlocked(save: SaveData, id: string): boolean {
  const meta = getLevelMeta(id)
  if (!meta) return false
  if (!worldUnlocked(save, meta.worldIndex)) return false
  if (meta.levelNumber === 1) return true
  return Boolean(save.levels[levelId(meta.worldIndex, meta.levelNumber - 1)]?.completed)
}

export function worldUnlocked(save: SaveData, worldIndex: number): boolean {
  if (worldIndex <= 0) return true
  return Boolean(save.levels[levelId(worldIndex - 1, LEVELS_PER_WORLD)]?.completed)
}

export function firstIncompleteLevel(save: SaveData, worldIndex?: number): string {
  const pool = typeof worldIndex === 'number' ? levelsForWorld(worldIndex) : ALL_LEVELS
  for (const level of pool) {
    if (worldUnlocked(save, level.worldIndex) && !save.levels[level.id]?.completed) return level.id
  }
  return typeof worldIndex === 'number' ? levelId(worldIndex, LEVELS_PER_WORLD) : levelId(WORLD_COUNT - 1, LEVELS_PER_WORLD)
}

export function worldStars(save: SaveData, worldIndex: number): number {
  return levelsForWorld(worldIndex).reduce((total, level) => total + (save.levels[level.id]?.stars ?? 0), 0)
}

export function worldCompleted(save: SaveData, worldIndex: number): number {
  return levelsForWorld(worldIndex).filter((level) => save.levels[level.id]?.completed).length
}

export function totalStars(save: SaveData): number {
  return Object.values(save.levels).reduce((total, record) => total + record.stars, 0)
}

export function completedLevels(save: SaveData): number {
  return Object.values(save.levels).filter((record) => record.completed).length
}

export function currentWorld(save: SaveData): number {
  return getLevelMeta(firstIncompleteLevel(save))?.worldIndex ?? 0
}

/** Blaster unlocks are tied to Journey milestones, never to a purchase. */
export function unlockedModes(save: SaveData): BlasterMode[] {
  const modes: BlasterMode[] = ['pulse']
  const reached = (world: number): boolean => worldUnlocked(save, world) || worldCompleted(save, world) > 0
  if (reached(3)) modes.push('volt')
  if (reached(4)) modes.push('growth')
  if (reached(5)) modes.push('gravity')
  return modes
}

export function availableModesFor(save: SaveData, worldIndex: number): BlasterMode[] {
  const base = unlockedModes(save)
  if (worldIndex >= 3 && !base.includes('volt')) base.push('volt')
  if (worldIndex >= 4 && !base.includes('growth')) base.push('growth')
  if (worldIndex >= 5 && !base.includes('gravity')) base.push('gravity')
  return base
}

export function worldTheme(worldIndex: number): WorldTheme {
  return worldAt(worldIndex)
}

export function dailyDate(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

export function dailyMeta(date = dailyDate()): LevelMeta {
  const seed = hashString(`switchshot:daily:${date}`)
  const worldIndex = seed % WORLD_COUNT
  const levelNumber = 2 + ((seed >>> 9) % (LEVELS_PER_WORLD - 3))
  const base = getLevelMeta(levelId(worldIndex, levelNumber)) ?? ALL_LEVELS[0]
  return {
    ...base,
    name: `Daily · ${base.name}`,
    seed: hashString(`${date}:switchshot:daily:v1`),
    boss: false,
    difficulty: 6,
  }
}

export function speedrunCandidates(save: SaveData): LevelMeta[] {
  return ALL_LEVELS.filter((level) => save.levels[level.id]?.completed && !level.boss)
}
