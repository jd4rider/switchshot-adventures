export const GAME_WIDTH = 720
export const GAME_HEIGHT = 1280
export const GAME_ID = 'switchshot-adventures'
export const STORAGE_KEY = 'switchshot-adventures-save-v1'
export const VERSION = '1.0.0'
export const SCHEMA_VERSION = 1

export const FONT = '"Avenir Next", "Trebuchet MS", "Segoe UI", system-ui, sans-serif'
export const DISPLAY_FONT = '"Avenir Next", "Trebuchet MS", "Segoe UI", system-ui, sans-serif'

export const CSS = {
  ink: '#171032',
  cream: '#fff6e2',
  muted: '#a99fc9',
  mint: '#6ff2c8',
  sky: '#77d7ff',
  gold: '#ffd75e',
  coral: '#ff7a6b',
  lilac: '#b79cff',
  rose: '#ff8fc7',
  white: '#ffffff',
  danger: '#ff5f7a',
} as const

export const COLORS = {
  ink: 0x171032,
  panel: 0x241a45,
  cream: 0xfff6e2,
  muted: 0xa99fc9,
  mint: 0x6ff2c8,
  sky: 0x77d7ff,
  gold: 0xffd75e,
  coral: 0xff7a6b,
  lilac: 0xb79cff,
  rose: 0xff8fc7,
  danger: 0xff5f7a,
  white: 0xffffff,
} as const

export const BLASTER_COLORS = {
  pulse: 0x59d6ff,
  volt: 0xffe05a,
  growth: 0x6ff28a,
  gravity: 0xb177ff,
} as const

/** Movement is tuned around a 60 px tile and a 136 px jump apex. */
export const TUNING = {
  gravity: 1500,
  runSpeed: 300,
  runAcceleration: 2600,
  airAcceleration: 1900,
  groundDrag: 3000,
  airDrag: 520,
  jumpVelocity: -640,
  jumpCutVelocity: -220,
  coyoteMs: 100,
  jumpBufferMs: 120,
  maxFallSpeed: 900,
  maxAimTiltSpeed: 420,
  invulnerableMs: 1200,
  hitKnockbackX: 230,
  hitKnockbackY: -300,
  respawnGraceMs: 1100,
  checkpointGraceMs: 700,
} as const

export const PLAYER = {
  width: 44,
  height: 62,
  maxHealth: 3,
} as const

export const SHOT = {
  speed: 780,
  cooldownMs: 260,
  lifetimeMs: 1500,
  maxBounces: 3,
  poolSize: 28,
  aimAssistScreenPx: 42,
  knockback: 34,
} as const

export const CAMERA = {
  lerpY: 0.11,
  lookAheadUp: 150,
  lookAheadDown: 120,
  viewCenter: 0.56,
} as const

export const LEVEL = {
  width: 720,
  chamberHeight: 420,
  floorHeight: 28,
  gapWidth: 200,
  topPad: 300,
  bottomPad: 120,
  exitClearance: 40,
} as const

export const HUD_HEIGHT = 104
export const SAFE_TOP = 34
export const SAFE_BOTTOM = 26
