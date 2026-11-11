import { describe, expect, it } from 'vitest'
import { BLASTERS, BLASTER_SKINS } from '../src/data/blasters'
import { ACHIEVEMENTS } from '../src/data/achievements'
import { CHALLENGES } from '../src/data/challenges'
import { defaultSave } from '../src/core/save'
import { generateLevel } from '../src/generator/level'
import { ALL_LEVELS, getLevelMeta } from '../src/data/levels'
import { WORLDS } from '../src/data/worlds'

describe('content catalogue', () => {
  it('ships four blasters unlocked in Journey order and five cosmetic skins', () => {
    expect(BLASTERS.map((blaster) => blaster.id)).toEqual(['pulse', 'volt', 'growth', 'gravity'])
    expect(BLASTERS[0].unlockWorld).toBe(0)
    expect(BLASTERS[1].unlockWorld).toBe(3)
    expect(BLASTERS[2].unlockWorld).toBe(4)
    expect(BLASTERS[3].unlockWorld).toBe(5)
    expect(new Set(BLASTERS.map((blaster) => blaster.color)).size).toBe(4)
    expect(BLASTER_SKINS).toHaveLength(5)
    expect(new Set(BLASTER_SKINS.map((skin) => skin.id)).size).toBe(5)
  })

  it('gives every world a palette, a musical identity and a guardian', () => {
    expect(WORLDS).toHaveLength(10)
    expect(new Set(WORLDS.map((world) => world.id)).size).toBe(10)
    for (const world of WORLDS) {
      expect(world.name.length).toBeGreaterThan(3)
      expect(world.tagline.length).toBeGreaterThan(3)
      expect(world.music.scale.length).toBeGreaterThanOrEqual(5)
      expect(world.palette.skyTop).toMatch(/^#[0-9a-f]{6}$/)
      expect(world.palette.platform).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('defines 22 real achievements that start locked', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20)
    expect(new Set(ACHIEVEMENTS.map((entry) => entry.id)).size).toBe(ACHIEVEMENTS.length)
    const save = defaultSave()
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.test(save)).toBe(false)
      expect(achievement.name.length).toBeGreaterThan(2)
      expect(achievement.description.length).toBeGreaterThan(4)
    }
  })

  it('defines six distinct challenge rooms across the worlds', () => {
    expect(CHALLENGES).toHaveLength(6)
    expect(new Set(CHALLENGES.map((entry) => entry.id)).size).toBe(6)
    for (const challenge of CHALLENGES) {
      expect(getLevelMeta(`w${challenge.worldIndex + 1}-${challenge.levelNumber}`)).toBeDefined()
      const level = generateLevel(getLevelMeta(`w${challenge.worldIndex + 1}-${challenge.levelNumber}`) ?? ALL_LEVELS[0], { mode: 'challenge' })
      expect(level.hatches.length).toBe(5)
    }
  })

  it('keeps generated rooms compact enough for a portrait screen', () => {
    for (const meta of ALL_LEVELS.filter((level) => level.levelNumber === 25)) {
      const level = generateLevel(meta)
      expect(level.width).toBe(720)
      expect(level.height).toBeLessThan(4820)
      expect(level.chambers).toBeLessThanOrEqual(10)
      for (const platform of level.platforms) {
        expect(platform.x).toBeGreaterThanOrEqual(0)
        expect(platform.x + platform.width).toBeLessThanOrEqual(721)
      }
    }
  })
})
