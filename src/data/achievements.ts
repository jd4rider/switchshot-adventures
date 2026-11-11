import { completedLevels, totalStars } from './levels'
import type { SaveData } from '../types'

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  glyph: string
  test: (save: SaveData) => boolean
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-step', name: 'First Step', description: 'Clear a level.', glyph: '★', test: (save) => completedLevels(save) >= 1 },
  { id: 'first-shot', name: 'First Shot', description: 'Fire the Switchshot.', glyph: '●', test: (save) => save.stats.shots >= 1 },
  { id: 'puzzle-solver', name: 'Puzzle Solver', description: 'Activate 25 switches.', glyph: '⚙', test: (save) => save.stats.switchesActivated >= 25 },
  { id: 'crystal-collector', name: 'Crystal Collector', description: 'Collect 250 gems.', glyph: '◆', test: (save) => save.stats.gems >= 250 },
  { id: 'switch-master', name: 'Switch Master', description: 'Activate 250 switches.', glyph: '⏻', test: (save) => save.stats.switchesActivated >= 250 },
  { id: 'ricochet-expert', name: 'Ricochet Expert', description: 'Bounce 25 shots off mirrors.', glyph: '⟋', test: (save) => save.stats.ricochets >= 25 },
  { id: 'crack-shot', name: 'Crack Shot', description: 'Land 100 shots on targets.', glyph: '◎', test: (save) => save.stats.shotsHit >= 100 },
  { id: 'bot-botherer', name: 'Bot Botherer', description: 'Defeat 50 playful machines.', glyph: '✖', test: (save) => save.stats.enemiesDefeated >= 50 },
  { id: 'untouchable', name: 'Untouchable', description: 'Clear 10 levels without damage.', glyph: '♡', test: (save) => save.stats.noDamageClears >= 10 },
  { id: 'world-one', name: 'Meadow Champion', description: 'Clear Sparkle Meadows.', glyph: '✿', test: (save) => Boolean(save.levels['w1-50']?.completed) },
  { id: 'world-five', name: 'Halfway Hero', description: 'Clear Floating Gardens.', glyph: '❧', test: (save) => Boolean(save.levels['w5-50']?.completed) },
  { id: 'world-ten', name: 'Grand Adventurer', description: 'Clear The Grand Switchworks.', glyph: '☀', test: (save) => Boolean(save.levels['w10-50']?.completed) },
  { id: 'star-30', name: 'Star Gatherer', description: 'Earn 30 stars.', glyph: '✦', test: (save) => totalStars(save) >= 30 },
  { id: 'star-150', name: 'Star Struck', description: 'Earn 150 stars.', glyph: '✧', test: (save) => totalStars(save) >= 150 },
  { id: 'boss-one', name: 'Foreman Down', description: 'Defeat a world guardian.', glyph: '⚒', test: (save) => save.stats.bossesDefeated >= 1 },
  { id: 'boss-ten', name: 'Tower Tamer', description: 'Defeat ten world guardians.', glyph: '♛', test: (save) => save.stats.bossesDefeated >= 10 },
  { id: 'tower-climber', name: 'Tower Climber', description: 'Reach floor 5 in the Endless Tower.', glyph: '↑', test: (save) => save.modes.endlessBestHeight >= 5 },
  { id: 'daily-devotee', name: 'Daily Devotee', description: 'Finish 3 Daily Puzzles.', glyph: '☼', test: (save) => save.modes.dailyCompletions >= 3 },
  { id: 'speed-demon', name: 'Speed Demon', description: 'Set a Speedrun record.', glyph: '⏱', test: (save) => Object.keys(save.modes.speedrun).length > 0 },
  { id: 'challenger', name: 'Challenge Champion', description: 'Clear a Challenge Room.', glyph: '◈', test: (save) => Object.values(save.modes.challenges).some((record) => record.completed) },
  { id: 'gem-hoard', name: 'Gem Hoard', description: 'Collect every gem in 10 levels.', glyph: '❖', test: (save) => Object.values(save.levels).filter((record) => record.allGems).length >= 10 },
  { id: 'journey-100', name: 'A Hundred Doors', description: 'Clear 100 Journey levels.', glyph: '➜', test: (save) => completedLevels(save) >= 100 },
]

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]))

export function newlyUnlocked(save: SaveData): AchievementDefinition[] {
  const owned = new Set(save.achievements)
  return ACHIEVEMENTS.filter((achievement) => !owned.has(achievement.id) && achievement.test(save))
}
