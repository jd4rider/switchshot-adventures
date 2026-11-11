import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../src/config'
import { reconcileProgress } from '../src/core/progress'
import { defaultSave, loadSave, recordLevelResult, sanitizeSave, saveSettings, saveSkin, writeSave } from '../src/core/save'
import type { LevelResult } from '../src/types'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  clear(): void {
    this.map.clear()
  }
  get length(): number {
    return this.map.size
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
}

const storage = new MemoryStorage()

function result(overrides: Partial<LevelResult> = {}): LevelResult {
  return {
    levelId: 'w1-1',
    mode: 'journey',
    score: 2400,
    stars: 2,
    timeMs: 42_000,
    gems: 5,
    optionalGems: 1,
    requiredGems: 5,
    noDamage: false,
    shots: 9,
    hits: 7,
    ricochets: 1,
    enemies: 1,
    deaths: 0,
    worldIndex: 0,
    ...overrides,
  }
}

beforeEach(() => {
  storage.clear()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
})

describe('save schema', () => {
  it('starts from a complete default and rejects corrupt data', () => {
    const save = loadSave()
    expect(save.schemaVersion).toBe(1)
    expect(save.settings.controlScheme).toBe('glide')
    expect(save.settings.aimAssist).toBe(true)
    expect(save.blasterSkin).toBe('classic')
    expect(defaultSave().levels).toEqual({})
    expect(sanitizeSave(null)).toEqual(defaultSave())
    expect(sanitizeSave('broken')).toEqual(defaultSave())
    expect(sanitizeSave({ levels: { 'not-a-level': {} }, settings: { touchScale: 99 } }).levels).toEqual({})
  })

  it('clamps risky values and drops unknown levels', () => {
    const clean = sanitizeSave({
      levels: {
        'w1-1': { completed: true, stars: 9, bestScore: -5, bestTimeMs: 12, noDamage: 'yes', allGems: true },
        'w99-1': { completed: true, stars: 3 },
      },
      settings: { masterVolume: 2, touchScale: 99, controlScheme: 'buttons', aimAssist: false },
      modes: { speedrun: { 'w1-1': 1000, garbage: 4 }, daily: { date: 'not-a-date' } },
      stats: { gems: -10, shots: 12 },
    })
    expect(clean.levels['w99-1']).toBeUndefined()
    expect(clean.levels['w1-1'].stars).toBe(0)
    expect(clean.levels['w1-1'].bestScore).toBe(0)
    expect(clean.levels['w1-1'].noDamage).toBe(false)
    expect(clean.levels['w1-1'].allGems).toBe(true)
    expect(clean.settings.masterVolume).toBe(1)
    expect(clean.settings.touchScale).toBe(1.35)
    expect(clean.settings.controlScheme).toBe('buttons')
    expect(clean.modes.speedrun['w1-1']).toBe(1000)
    expect(clean.modes.speedrun.garbage).toBeUndefined()
    expect(clean.modes.daily).toBeNull()
    expect(clean.stats.gems).toBe(0)
    expect(clean.stats.shots).toBe(12)
  })

  it('persists settings, skins and level results', () => {
    saveSettings({ ...defaultSave().settings, muted: true, controlScheme: 'buttons' })
    expect(loadSave().settings.muted).toBe(true)
    saveSkin('golden')
    expect(loadSave().blasterSkin).toBe('golden')
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
  })
})

describe('results recording', () => {
  it('keeps the best stars, score and time for a journey room', () => {
    recordLevelResult(result({ stars: 2, score: 2000, timeMs: 50_000 }))
    recordLevelResult(result({ stars: 3, score: 1500, timeMs: 60_000 }))
    const record = loadSave().levels['w1-1']
    expect(record.completed).toBe(true)
    expect(record.stars).toBe(3)
    expect(record.bestScore).toBe(2000)
    expect(record.bestTimeMs).toBe(50_000)
    expect(loadSave().stats.gems).toBe(10)
    expect(loadSave().lastLevelId).toBe('w1-1')
  })

  it('separates speedrun, daily, challenge and endless records', () => {
    recordLevelResult(result({ mode: 'speedrun', levelId: 'w1-2', timeMs: 21_000 }))
    expect(loadSave().modes.speedrun['w1-2']).toBe(21_000)
    recordLevelResult(result({ mode: 'daily', dailyDate: '2026-11-11', stars: 2 }))
    recordLevelResult(result({ mode: 'daily', dailyDate: '2026-11-11', stars: 3, timeMs: 30_000 }))
    expect(loadSave().modes.daily?.stars).toBe(3)
    expect(loadSave().modes.dailyCompletions).toBe(1)
    recordLevelResult(result({ mode: 'daily', dailyDate: '2026-11-12', stars: 1 }))
    expect(loadSave().modes.dailyCompletions).toBe(2)
    recordLevelResult(result({ mode: 'endless', levelId: 'endless-4', endlessHeight: 4, score: 9000 }))
    expect(loadSave().modes.endlessBestHeight).toBe(4)
    expect(loadSave().modes.endlessBestScore).toBe(9000)
    recordLevelResult(result({ mode: 'challenge', challengeId: 'steady-hands', stars: 2 }))
    expect(loadSave().modes.challenges['steady-hands'].completed).toBe(true)
  })

  it('unlocks achievements from real recorded play', () => {
    recordLevelResult(result({ stars: 3, noDamage: true }))
    const progress = reconcileProgress()
    expect(progress.save.achievements).toContain('first-step')
    expect(progress.save.achievements).toContain('first-shot')
    expect(progress.save.achievements).toContain('first-shot')
    expect(progress.achievements).toContain('first-step')
    const again = reconcileProgress()
    expect(again.achievements).toEqual([])
  })

  it('survives a storage implementation that throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('quota')
        },
        removeItem: () => undefined,
      },
      configurable: true,
    })
    expect(loadSave().schemaVersion).toBe(1)
    const saved = writeSave(defaultSave())
    expect(saved.schemaVersion).toBe(1)
  })
})
