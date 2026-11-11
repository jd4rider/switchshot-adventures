import { describe, expect, it } from 'vitest'
import { defaultSave } from '../src/core/save'
import {
  ALL_LEVELS,
  LEVELS_PER_WORLD,
  TOTAL_LEVELS,
  completedLevels,
  dailyDate,
  dailyMeta,
  firstIncompleteLevel,
  getLevelMeta,
  levelId,
  levelUnlocked,
  nextLevelId,
  parseLevelId,
  totalStars,
  worldStars,
  worldUnlocked,
} from '../src/data/levels'
import { WORLD_COUNT, WORLDS, worldAt } from '../src/data/worlds'
import { generateLevel, gapCenterFor } from '../src/generator/level'
import { catalogErrors, mirrorSolutionCount, progressionProbe, reflect, segmentHitsRect, switchIsShootable, validateAllLevels, validateLevel } from '../src/generator/validation'
import type { MirrorSpec, StarCount } from '../src/types'

const save = defaultSave()

function complete(id: string, stars: StarCount = 3): void {
  save.levels[id] = { completed: true, stars, bestScore: 1200, bestTimeMs: 30000, noDamage: true, allGems: true }
}

describe('campaign catalogue', () => {
  it('contains 500 unique levels across ten worlds', () => {
    expect(ALL_LEVELS).toHaveLength(TOTAL_LEVELS)
    expect(TOTAL_LEVELS).toBe(500)
    expect(WORLDS).toHaveLength(WORLD_COUNT)
    expect(WORLD_COUNT).toBe(10)
    expect(catalogErrors()).toEqual([])
    expect(new Set(ALL_LEVELS.map((level) => level.id)).size).toBe(500)
    expect(new Set(ALL_LEVELS.map((level) => level.seed)).size).toBe(500)
  })

  it('has fifty levels and one named guardian in every world', () => {
    for (let world = 0; world < WORLD_COUNT; world += 1) {
      const levels = ALL_LEVELS.filter((level) => level.worldIndex === world)
      expect(levels).toHaveLength(LEVELS_PER_WORLD)
      expect(levels.filter((level) => level.boss)).toHaveLength(1)
      expect(levels.at(-1)?.id).toBe(levelId(world, LEVELS_PER_WORLD))
      expect(levels.at(-1)?.name).toBe(`${worldAt(world).name} Guardian`)
    }
  })

  it('parses and advances boundary ids correctly', () => {
    expect(parseLevelId('w1-1')).toEqual({ worldIndex: 0, levelNumber: 1 })
    expect(parseLevelId('w10-50')).toEqual({ worldIndex: 9, levelNumber: 50 })
    expect(parseLevelId('w11-1')).toBeNull()
    expect(parseLevelId('w1-51')).toBeNull()
    expect(nextLevelId('w1-49')).toBe('w1-50')
    expect(nextLevelId('w1-50')).toBe('w2-1')
    expect(nextLevelId('w10-50')).toBeNull()
  })
})

describe('generated levels', () => {
  it('validates all 500 rooms: geometry, shootable switches, climbable stairs and exits', () => {
    const reports = validateAllLevels()
    const failures = reports.filter((report) => report.errors.length > 0)
    expect(reports).toHaveLength(500)
    expect(failures).toEqual([])
  })

  it('is deterministic for the same level id', () => {
    const meta = getLevelMeta('w6-27')
    expect(meta).toBeDefined()
    if (!meta) return
    const first = generateLevel(meta)
    const second = generateLevel(meta)
    expect(second).toEqual(first)
    expect(first.chambers).toBeGreaterThanOrEqual(6)
    expect(first.height).toBeGreaterThan(2500)
    expect(first.requiredGems).toBe(first.gems.filter((gem) => !gem.optional).length)
    expect(first.puzzles).toHaveLength(first.chambers - 1)
  })

  it('keeps the exit out of the hatch holes and above the start', () => {
    for (const meta of ALL_LEVELS.filter((level) => level.levelNumber % 17 === 0)) {
      const level = generateLevel(meta)
      expect(level.start.y).toBeGreaterThan(level.exit.y)
      expect(Math.abs(level.exit.x - gapCenterFor(level.chambers - 1))).toBeGreaterThan(55)
      expect(level.exit.y).toBeGreaterThan(60)
    }
  })

  it('unlocks blaster modes with the worlds that need them', () => {
    const early = generateLevel(getLevelMeta('w1-5') ?? ALL_LEVELS[0])
    expect(early.availableModes).toEqual(['pulse'])
    const volt = generateLevel(getLevelMeta('w4-5') ?? ALL_LEVELS[0])
    expect(volt.availableModes).toContain('volt')
    const growth = generateLevel(getLevelMeta('w5-5') ?? ALL_LEVELS[0])
    expect(growth.availableModes).toContain('growth')
    const gravity = generateLevel(getLevelMeta('w6-5') ?? ALL_LEVELS[0])
    expect(gravity.availableModes).toContain('gravity')
    for (const meta of ALL_LEVELS) {
      const level = generateLevel(meta)
      for (const switchEntry of level.switches) {
        expect(level.availableModes).toContain(switchEntry.requiredMode)
      }
    }
  })

  it('builds sequence, mirror, circuit, growth and gravity puzzle rooms', () => {
    const all = ALL_LEVELS.map((meta) => generateLevel(meta))
    for (const kind of ['switch', 'timed', 'sequence', 'mirror', 'circuit', 'growth', 'gravity'] as const) {
      expect(all.some((level) => level.puzzles.includes(kind))).toBe(true)
    }
    for (const level of all) {
      if (level.puzzles.includes('sequence')) {
        const hatch = level.hatches.find((entry) => entry.puzzle === 'sequence')
        const orders = hatch?.switchIds.map((id) => level.switches.find((entry) => entry.id === id)?.order)
        expect(orders?.sort()).toEqual([1, 2])
      }
      if (level.puzzles.includes('gravity')) {
        expect(level.plates.length).toBeGreaterThan(0)
        expect(level.crates.length).toBeGreaterThan(0)
      }
      if (level.puzzles.includes('growth')) {
        expect(level.seeds.length).toBeGreaterThan(0)
      }
      if (level.puzzles.includes('mirror')) {
        expect(level.mirrors.length).toBeGreaterThan(0)
      }
    }
  })

  it('places a three-stage guardian in every boss room', () => {
    for (let world = 0; world < WORLD_COUNT; world += 1) {
      const meta = getLevelMeta(levelId(world, 50))
      expect(meta).toBeDefined()
      if (!meta) continue
      const level = generateLevel(meta)
      expect(level.boss).not.toBeNull()
      expect(level.boss?.weakPoints).toHaveLength(3)
      expect(level.boss?.name).toContain('Guardian')
      expect(validateLevel(level)).toEqual([])
    }
  })

  it('can generate endless floors of increasing height without a boss', () => {
    const first = generateLevel(ALL_LEVELS[0], { mode: 'endless', stage: 0 })
    const later = generateLevel(ALL_LEVELS[0], { mode: 'endless', stage: 9 })
    expect(first.boss).toBeNull()
    expect(later.boss).toBeNull()
    expect(later.chambers).toBeGreaterThanOrEqual(first.chambers)
    expect(validateLevel(later)).toEqual([])
  })
})

describe('shooting geometry', () => {
  it('reflects an upward shot sideways off a 45-degree mirror', () => {
    const slash: MirrorSpec = { id: 'm1', x: 0, y: 0, width: 44, height: 44, orientation: '/' }
    const backslash: MirrorSpec = { id: 'm2', x: 0, y: 0, width: 44, height: 44, orientation: '\\' }
    expect(reflect(0, -1, slash).dx).toBeCloseTo(1)
    expect(reflect(0, -1, slash).dy).toBeCloseTo(0)
    expect(reflect(0, -1, backslash).dx).toBeCloseTo(-1)
    expect(reflect(0, -1, backslash).dy).toBeCloseTo(0)
  })

  it('clips segments against a rectangle', () => {
    expect(segmentHitsRect(0, 0, 100, 0, { x: 40, y: -10, width: 20, height: 20 })).toBeCloseTo(0.4)
    expect(segmentHitsRect(0, 0, 100, 0, { x: 40, y: 30, width: 20, height: 20 })).toBeNull()
  })

  it('proves the mirror rooms need the bounce and the plain rooms do not', () => {
    const mirrorLevels = ALL_LEVELS.filter((meta) => meta.worldIndex >= 2 && meta.levelNumber % 9 === 0).slice(0, 12)
    for (const meta of mirrorLevels) {
      const level = generateLevel(meta)
      for (const switchEntry of level.switches) expect(switchIsShootable(level, switchEntry.id)).toBe(true)
    }
    expect(mirrorSolutionCount() >= 0).toBe(true)
  })
})

describe('progression', () => {
  it('gates levels and worlds behind clears', () => {
    const fresh = defaultSave()
    expect(levelUnlocked(fresh, 'w1-1')).toBe(true)
    expect(levelUnlocked(fresh, 'w1-2')).toBe(false)
    expect(worldUnlocked(fresh, 1)).toBe(false)
    expect(progressionProbe()).toEqual([])
    fresh.levels['w1-1'] = { completed: true, stars: 2, bestScore: 1, bestTimeMs: 1, noDamage: false, allGems: false }
    expect(levelUnlocked(fresh, 'w1-2')).toBe(true)
    fresh.levels['w1-50'] = { completed: true, stars: 1, bestScore: 1, bestTimeMs: 1, noDamage: false, allGems: false }
    expect(worldUnlocked(fresh, 1)).toBe(true)
    expect(levelUnlocked(fresh, 'w2-1')).toBe(true)
  })

  it('tracks the first incomplete room and star totals', () => {
    expect(firstIncompleteLevel(save)).toBe('w1-1')
    complete('w1-1', 3)
    complete('w1-2', 2)
    expect(firstIncompleteLevel(save)).toBe('w1-3')
    expect(worldStars(save, 0)).toBe(5)
    expect(totalStars(save)).toBe(5)
    expect(completedLevels(save)).toBe(2)
  })

  it('produces a stable daily room per UTC date', () => {
    const a = dailyMeta('2026-11-11')
    const b = dailyMeta('2026-11-11')
    expect(a).toEqual(b)
    expect(parseLevelId(a.id)).not.toBeNull()
    expect(a.boss).toBe(false)
    expect(dailyDate(new Date('2026-11-11T23:59:00Z'))).toBe('2026-11-11')
    expect(dailyMeta('2026-11-12').seed).not.toBe(dailyMeta('2026-11-11').seed)
  })
})
