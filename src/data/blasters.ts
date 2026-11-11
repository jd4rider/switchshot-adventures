import { BLASTER_COLORS } from '../config'
import type { BlasterMode } from '../types'

export interface BlasterDefinition {
  id: BlasterMode
  name: string
  short: string
  description: string
  glyph: string
  color: number
  css: string
  texture: string
  unlockWorld: number
}

export const BLASTERS: BlasterDefinition[] = [
  {
    id: 'pulse',
    name: 'Blue Pulse',
    short: 'PULSE',
    description: 'Opens switches, breaks crates and pops most machines.',
    glyph: '●',
    color: BLASTER_COLORS.pulse,
    css: '#59d6ff',
    texture: 'shot-pulse',
    unlockWorld: 0,
  },
  {
    id: 'volt',
    name: 'Yellow Volt',
    short: 'VOLT',
    description: 'Powers batteries and electrical circuits.',
    glyph: '⚡',
    color: BLASTER_COLORS.volt,
    css: '#ffe05a',
    texture: 'shot-volt',
    unlockWorld: 3,
  },
  {
    id: 'growth',
    name: 'Green Growth',
    short: 'GROW',
    description: 'Wakes seeds and grows temporary platforms.',
    glyph: '❧',
    color: BLASTER_COLORS.growth,
    css: '#6ff28a',
    texture: 'shot-growth',
    unlockWorld: 4,
  },
  {
    id: 'gravity',
    name: 'Purple Gravity',
    short: 'GRAV',
    description: 'Shoves loose crates toward the shot direction.',
    glyph: '◍',
    color: BLASTER_COLORS.gravity,
    css: '#b177ff',
    texture: 'shot-gravity',
    unlockWorld: 5,
  },
]

export const BLASTER_BY_ID = new Map(BLASTERS.map((blaster) => [blaster.id, blaster]))

export function blasterAt(index: number): BlasterDefinition {
  return BLASTERS[Math.max(0, Math.min(BLASTERS.length - 1, index))]
}

export const BLASTER_SKINS = [
  { id: 'classic', name: 'Classic Brass', description: 'The Switchshot as Pip built it.', tint: 0xffffff, unlockStars: 0 },
  { id: 'crystal', name: 'Crystal Cutter', description: 'A cool glass-blue trail.', tint: 0x9fe8ff, unlockStars: 15 },
  { id: 'golden', name: 'Golden Spark', description: 'A warm golden trail.', tint: 0xffd75e, unlockStars: 45 },
  { id: 'neon', name: 'Neon Dreamer', description: 'A bright arcade trail.', tint: 0xff6fe0, unlockStars: 90 },
  { id: 'cosmic', name: 'Cosmic Comet', description: 'A starry violet trail.', tint: 0xb79cff, unlockStars: 150 },
] as const

export type BlasterSkin = (typeof BLASTER_SKINS)[number]
