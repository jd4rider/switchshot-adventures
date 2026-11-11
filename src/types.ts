export type PlayMode = 'journey' | 'endless' | 'speedrun' | 'daily' | 'challenge'
export type BlasterMode = 'pulse' | 'volt' | 'growth' | 'gravity'
export type StarCount = 0 | 1 | 2 | 3
export type ControlScheme = 'glide' | 'buttons'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type PlatformKind = 'solid' | 'oneway' | 'bounce'

export interface PlatformSpec extends Rect {
  kind: PlatformKind
  role?: 'floor' | 'stair' | 'prop'
}

export interface MovingPlatformSpec extends Rect {
  axis: 'x' | 'y'
  distance: number
  speed: number
  phase: number
}

export type PuzzleKind = 'switch' | 'timed' | 'sequence' | 'mirror' | 'circuit' | 'growth' | 'gravity'

export interface SwitchSpec {
  id: string
  x: number
  y: number
  requiredMode: BlasterMode
  order?: number
  accent: number
}

export interface HatchSpec extends Rect {
  id: string
  switchIds: string[]
  puzzle: PuzzleKind
  timedMs: number
}

export interface MirrorSpec {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** '/' reflects an upward shot to the right; '\\' reflects it to the left. */
  orientation: '/' | '\\'
}

export interface CrateSpec {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface PlateSpec {
  id: string
  x: number
  y: number
  width: number
  height: number
  hatchId: string
}

export interface SeedSpec {
  id: string
  x: number
  y: number
  /** The platform that appears once the growth shot lands. */
  platform: Rect
}

export type EnemyKind = 'wobblebot' | 'hopper' | 'shieldbug' | 'drone'

export interface EnemySpec {
  x: number
  y: number
  kind: EnemyKind
  range: number
  speed: number
  variant: number
}

export interface GemSpec {
  x: number
  y: number
  variant: number
  optional: boolean
}

export interface CheckpointSpec {
  x: number
  y: number
  label: string
}

export interface BossWeakPoint {
  id: string
  x: number
  y: number
  order: number
}

export interface BossSpec {
  x: number
  y: number
  name: string
  weakPoints: BossWeakPoint[]
  shotIntervalMs: number
  color: number
}

export interface LevelData {
  id: string
  worldIndex: number
  levelNumber: number
  name: string
  seed: number
  width: number
  height: number
  chambers: number
  start: { x: number; y: number }
  exit: { x: number; y: number }
  platforms: PlatformSpec[]
  movingPlatforms: MovingPlatformSpec[]
  hatches: HatchSpec[]
  switches: SwitchSpec[]
  mirrors: MirrorSpec[]
  crates: CrateSpec[]
  plates: PlateSpec[]
  seeds: SeedSpec[]
  gems: GemSpec[]
  enemies: EnemySpec[]
  checkpoints: CheckpointSpec[]
  puzzles: PuzzleKind[]
  requiredGems: number
  availableModes: BlasterMode[]
  boss: BossSpec | null
}

export interface WorldPalette {
  skyTop: string
  skyBottom: string
  horizon: string
  platform: string
  platformTop: string
  accent: string
  accentTwo: string
  glow: string
  hazard: string
  ink: string
}

export interface WorldTheme {
  index: number
  id: string
  name: string
  tagline: string
  feature: string
  palette: WorldPalette
  music: { root: number; scale: number[]; tempo: number; wave: OscillatorType }
  ambient: 'birds' | 'machine' | 'cave' | 'electric' | 'garden' | 'lab' | 'snow' | 'neon' | 'space' | 'grand'
}

export interface GameplaySettings {
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  muted: boolean
  reducedMotion: boolean
  reducedFlash: boolean
  highContrast: boolean
  controlScheme: ControlScheme
  touchScale: number
  touchOpacity: number
  leftHanded: boolean
  aimAssist: boolean
  haptics: boolean
}

export interface LevelRecord {
  completed: boolean
  stars: StarCount
  bestScore: number
  bestTimeMs: number
  noDamage: boolean
  allGems: boolean
}

export interface DailyRecord {
  date: string
  score: number
  stars: StarCount
  timeMs: number
}

export interface ChallengeRecord {
  completed: boolean
  stars: StarCount
  bestTimeMs: number
}

export interface ModeRecords {
  endlessBestHeight: number
  endlessBestScore: number
  daily: DailyRecord | null
  dailyCompletions: number
  speedrun: Record<string, number>
  challenges: Record<string, ChallengeRecord>
  plays: Partial<Record<PlayMode, number>>
}

export interface SaveStats {
  gems: number
  optionalGems: number
  shots: number
  shotsHit: number
  enemiesDefeated: number
  switchesActivated: number
  ricochets: number
  deaths: number
  noDamageClears: number
  bossesDefeated: number
  timePlayedMs: number
}

export interface SaveData {
  schemaVersion: number
  levels: Record<string, LevelRecord>
  settings: GameplaySettings
  achievements: string[]
  stats: SaveStats
  modes: ModeRecords
  blasterSkin: string
  lastLevelId: string
}

export interface LevelResult {
  levelId: string
  mode: PlayMode
  score: number
  stars: StarCount
  timeMs: number
  gems: number
  optionalGems: number
  requiredGems: number
  noDamage: boolean
  shots: number
  hits: number
  ricochets: number
  enemies: number
  deaths: number
  worldIndex: number
  challengeId?: string
  endlessHeight?: number
  dailyDate?: string
}

export interface ResultsData {
  success: boolean
  mode: PlayMode
  levelId: string
  levelName: string
  worldIndex: number
  result: LevelResult
  nextLevelId?: string | null
  newAchievements: string[]
  bossName?: string
}

export interface ChallengeDefinition {
  id: string
  name: string
  description: string
  objective: string
  worldIndex: number
  levelNumber: number
  limitShots?: number
  limitMs?: number
  noDamage?: boolean
  scoreStar2: number
}

export interface PlayerIntent {
  axis: number
  jumpPressed: boolean
  jumpHeld: boolean
  down: boolean
}

export interface ArcadeSnapshot {
  configured: boolean
  signedIn: boolean
  label: string
}
