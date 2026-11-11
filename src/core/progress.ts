import { BLASTER_SKINS } from '../data/blasters'
import { ACHIEVEMENTS, newlyUnlocked } from '../data/achievements'
import { totalStars } from '../data/levels'
import type { SaveData } from '../types'
import { loadSave, writeSave } from './save'

export interface ProgressUpdate {
  save: SaveData
  achievements: string[]
}

/**
 * Achievements are evaluated locally: the Little Joy drop-in client mirrors
 * saves and identity, and does not expose an achievement endpoint.
 */
export function reconcileProgress(): ProgressUpdate {
  const save = loadSave()
  const before = new Set(save.achievements)
  const unlocked = newlyUnlocked(save)
  unlocked.forEach((achievement) => {
    if (!save.achievements.includes(achievement.id)) save.achievements.push(achievement.id)
  })
  const stars = totalStars(save)
  const availableSkins = new Set<string>(BLASTER_SKINS.filter((skin) => skin.unlockStars <= stars).map((skin) => skin.id))
  if (!availableSkins.has(save.blasterSkin)) save.blasterSkin = 'classic'
  const next = writeSave(save)
  return { save: next, achievements: next.achievements.filter((id) => !before.has(id)) }
}

export function achievementTotal(): number {
  return ACHIEVEMENTS.length
}

export function unlockedSkinIds(save: SaveData): string[] {
  const stars = totalStars(save)
  return BLASTER_SKINS.filter((skin) => skin.unlockStars <= stars).map((skin) => skin.id)
}
