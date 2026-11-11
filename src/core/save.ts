import { SCHEMA_VERSION, STORAGE_KEY } from '../config'
import type {
  ChallengeRecord,
  DailyRecord,
  GameplaySettings,
  LevelRecord,
  LevelResult,
  ModeRecords,
  PlayMode,
  SaveData,
  SaveStats,
  StarCount,
} from '../types'

const VALID_LEVEL = /^w(?:[1-9]|10)-(?:[1-9]|[1-4]\d|50)$/
const VALID_ID = /^[a-z0-9-]{2,40}$/
const STAR_VALUES = new Set([0, 1, 2, 3])

export const DEFAULT_SETTINGS: GameplaySettings = {
  masterVolume: 0.85,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  muted: false,
  reducedMotion: false,
  reducedFlash: false,
  highContrast: false,
  controlScheme: 'glide',
  touchScale: 1,
  touchOpacity: 0.6,
  leftHanded: false,
  aimAssist: true,
  haptics: true,
}

const EMPTY_MODES: ModeRecords = {
  endlessBestHeight: 0,
  endlessBestScore: 0,
  daily: null,
  dailyCompletions: 0,
  speedrun: {},
  challenges: {},
  plays: {},
}

const EMPTY_STATS: SaveStats = {
  gems: 0,
  optionalGems: 0,
  shots: 0,
  shotsHit: 0,
  enemiesDefeated: 0,
  switchesActivated: 0,
  ricochets: 0,
  deaths: 0,
  noDamageClears: 0,
  bossesDefeated: 0,
  timePlayedMs: 0,
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    levels: {},
    settings: { ...DEFAULT_SETTINGS },
    achievements: [],
    stats: { ...EMPTY_STATS },
    modes: { ...EMPTY_MODES, speedrun: {}, challenges: {}, plays: {} },
    blasterSkin: 'classic',
    lastLevelId: 'w1-1',
  }
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function starCount(value: unknown): StarCount {
  return typeof value === 'number' && STAR_VALUES.has(value) ? (value as StarCount) : 0
}

function idList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && VALID_ID.test(entry)))]
    : []
}

function cleanSettings(value: unknown): GameplaySettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    masterVolume: num(raw.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
    musicVolume: num(raw.musicVolume, DEFAULT_SETTINGS.musicVolume, 0, 1),
    sfxVolume: num(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume, 0, 1),
    muted: bool(raw.muted, DEFAULT_SETTINGS.muted),
    reducedMotion: bool(raw.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    reducedFlash: bool(raw.reducedFlash, DEFAULT_SETTINGS.reducedFlash),
    highContrast: bool(raw.highContrast, DEFAULT_SETTINGS.highContrast),
    controlScheme: raw.controlScheme === 'buttons' ? 'buttons' : 'glide',
    touchScale: num(raw.touchScale, DEFAULT_SETTINGS.touchScale, 0.75, 1.35),
    touchOpacity: num(raw.touchOpacity, DEFAULT_SETTINGS.touchOpacity, 0.15, 1),
    leftHanded: bool(raw.leftHanded, DEFAULT_SETTINGS.leftHanded),
    aimAssist: bool(raw.aimAssist, DEFAULT_SETTINGS.aimAssist),
    haptics: bool(raw.haptics, DEFAULT_SETTINGS.haptics),
  }
}

function cleanLevelRecord(value: unknown): LevelRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.completed !== 'boolean') return null
  return {
    completed: raw.completed,
    stars: starCount(raw.stars),
    bestScore: Math.round(num(raw.bestScore, 0, 0, 2_000_000)),
    bestTimeMs: Math.round(num(raw.bestTimeMs, 0, 0, 3_600_000)),
    noDamage: bool(raw.noDamage, false),
    allGems: bool(raw.allGems, false),
  }
}

function cleanStats(value: unknown): SaveStats {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const out: SaveStats = { ...EMPTY_STATS }
  ;(Object.keys(EMPTY_STATS) as Array<keyof SaveStats>).forEach((key) => {
    out[key] = Math.round(num(raw[key], EMPTY_STATS[key], 0, 10_000_000))
  })
  return out
}

function cleanDaily(value: unknown): DailyRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null
  return {
    date: raw.date,
    score: Math.round(num(raw.score, 0, 0, 2_000_000)),
    stars: starCount(raw.stars),
    timeMs: Math.round(num(raw.timeMs, 0, 0, 3_600_000)),
  }
}

function cleanChallenges(value: unknown): Record<string, ChallengeRecord> {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const out: Record<string, ChallengeRecord> = {}
  Object.entries(raw).forEach(([id, entry]) => {
    if (!VALID_ID.test(id) || !entry || typeof entry !== 'object') return
    const record = entry as Record<string, unknown>
    out[id] = {
      completed: bool(record.completed, false),
      stars: starCount(record.stars),
      bestTimeMs: Math.round(num(record.bestTimeMs, 0, 0, 3_600_000)),
    }
  })
  return out
}

function cleanModes(value: unknown): ModeRecords {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const speedrunRaw = raw.speedrun && typeof raw.speedrun === 'object' ? (raw.speedrun as Record<string, unknown>) : {}
  const speedrun: Record<string, number> = {}
  Object.entries(speedrunRaw).forEach(([id, entry]) => {
    if (VALID_LEVEL.test(id) && typeof entry === 'number' && Number.isFinite(entry) && entry > 0) {
      speedrun[id] = Math.round(Math.min(3_600_000, entry))
    }
  })
  const playsRaw = raw.plays && typeof raw.plays === 'object' ? (raw.plays as Record<string, unknown>) : {}
  const plays: Partial<Record<PlayMode, number>> = {}
  ;(['journey', 'endless', 'speedrun', 'daily', 'challenge'] as PlayMode[]).forEach((mode) => {
    if (typeof playsRaw[mode] === 'number') plays[mode] = Math.round(num(playsRaw[mode], 0, 0, 1_000_000))
  })
  return {
    endlessBestHeight: Math.round(num(raw.endlessBestHeight, 0, 0, 1000)),
    endlessBestScore: Math.round(num(raw.endlessBestScore, 0, 0, 10_000_000)),
    daily: cleanDaily(raw.daily),
    dailyCompletions: Math.round(num(raw.dailyCompletions, 0, 0, 1_000_000)),
    speedrun,
    challenges: cleanChallenges(raw.challenges),
    plays,
  }
}

export function sanitizeSave(value: unknown): SaveData {
  const fallback = defaultSave()
  if (!value || typeof value !== 'object') return fallback
  const raw = value as Record<string, unknown>
  const levelsRaw = raw.levels && typeof raw.levels === 'object' ? (raw.levels as Record<string, unknown>) : {}
  const levels: Record<string, LevelRecord> = {}
  Object.entries(levelsRaw).forEach(([id, record]) => {
    if (!VALID_LEVEL.test(id)) return
    const clean = cleanLevelRecord(record)
    if (clean) levels[id] = clean
  })
  return {
    schemaVersion: SCHEMA_VERSION,
    levels,
    settings: cleanSettings(raw.settings),
    achievements: idList(raw.achievements),
    stats: cleanStats(raw.stats),
    modes: cleanModes(raw.modes),
    blasterSkin: typeof raw.blasterSkin === 'string' && VALID_ID.test(raw.blasterSkin) ? raw.blasterSkin : 'classic',
    lastLevelId: typeof raw.lastLevelId === 'string' && VALID_LEVEL.test(raw.lastLevelId) ? raw.lastLevelId : 'w1-1',
  }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeSave(JSON.parse(raw)) : defaultSave()
  } catch {
    return defaultSave()
  }
}

export function writeSave(save: SaveData): SaveData {
  const clean = sanitizeSave(save)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch {
    // A private window or full quota must not stop the game.
  }
  return clean
}

export function saveSettings(settings: GameplaySettings): SaveData {
  const save = loadSave()
  save.settings = cleanSettings(settings)
  return writeSave(save)
}

export function saveSkin(skin: string): SaveData {
  const save = loadSave()
  save.blasterSkin = VALID_ID.test(skin) ? skin : 'classic'
  return writeSave(save)
}

export function recordLevelResult(result: LevelResult): SaveData {
  const save = loadSave()
  const stats = save.stats

  stats.gems += Math.max(0, result.gems)
  stats.optionalGems += Math.max(0, result.optionalGems)
  stats.shots += Math.max(0, result.shots)
  stats.shotsHit += Math.max(0, result.hits)
  stats.ricochets += Math.max(0, result.ricochets)
  stats.enemiesDefeated += Math.max(0, result.enemies)
  stats.deaths += Math.max(0, result.deaths)
  stats.timePlayedMs += Math.max(0, result.timeMs)
  if (result.noDamage) stats.noDamageClears += 1

  if (result.mode === 'journey' || result.mode === 'speedrun' || result.mode === 'daily') {
    if (result.mode === 'journey') {
      const previous = save.levels[result.levelId]
      save.levels[result.levelId] = {
        completed: true,
        stars: Math.max(previous?.stars ?? 0, result.stars) as StarCount,
        bestScore: Math.max(previous?.bestScore ?? 0, result.score),
        bestTimeMs: previous?.bestTimeMs ? Math.min(previous.bestTimeMs, result.timeMs) : result.timeMs,
        noDamage: Boolean(previous?.noDamage || result.noDamage),
        allGems: Boolean(previous?.allGems || (result.requiredGems > 0 && result.gems >= result.requiredGems)),
      }
      save.lastLevelId = result.levelId
      if (result.levelId.endsWith('-50')) {
        stats.bossesDefeated = Object.keys(save.levels).filter((id) => /-50$/.test(id) && save.levels[id].completed).length
      }
    }
  }

  if (result.mode === 'speedrun') {
    const best = save.modes.speedrun[result.levelId] ?? Number.MAX_SAFE_INTEGER
    save.modes.speedrun[result.levelId] = Math.min(best, Math.max(1, result.timeMs))
  }

  if (result.mode === 'endless' && typeof result.endlessHeight === 'number') {
    save.modes.endlessBestHeight = Math.max(save.modes.endlessBestHeight, result.endlessHeight)
    save.modes.endlessBestScore = Math.max(save.modes.endlessBestScore, result.score)
  }

  if (result.mode === 'daily' && result.dailyDate) {
    const prior = save.modes.daily
    const sameDay = prior?.date === result.dailyDate
    save.modes.daily = {
      date: result.dailyDate,
      score: Math.max(sameDay ? prior.score : 0, result.score),
      stars: Math.max(sameDay ? prior.stars : 0, result.stars) as StarCount,
      timeMs: sameDay ? Math.min(prior.timeMs || result.timeMs, result.timeMs) : result.timeMs,
    }
    if (!sameDay) save.modes.dailyCompletions += 1
  }

  if (result.mode === 'challenge' && result.challengeId) {
    const prior = save.modes.challenges[result.challengeId]
    save.modes.challenges[result.challengeId] = {
      completed: true,
      stars: Math.max(prior?.stars ?? 0, result.stars) as StarCount,
      bestTimeMs: prior?.bestTimeMs ? Math.min(prior.bestTimeMs, result.timeMs) : result.timeMs,
    }
  }

  save.modes.plays[result.mode] = (save.modes.plays[result.mode] ?? 0) + 1
  return writeSave(save)
}
