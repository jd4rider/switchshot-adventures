import type { WorldTheme } from '../types'

export const WORLDS: WorldTheme[] = [
  {
    index: 0,
    id: 'sparkle-meadows',
    name: 'Sparkle Meadows',
    tagline: 'Where every adventure begins.',
    feature: 'Movement · jumping · first switches',
    palette: {
      skyTop: '#8fe6ff', skyBottom: '#c8f6d8', horizon: '#6dbf8e', platform: '#3f8f5e',
      platformTop: '#7fe08b', accent: '#ffd75e', accentTwo: '#ff8fc7', glow: '#fff2a8',
      hazard: '#ff7a6b', ink: '#173a2c',
    },
    music: { root: 261.63, scale: [0, 2, 4, 7, 9], tempo: 94, wave: 'triangle' },
    ambient: 'birds',
  },
  {
    index: 1,
    id: 'clockwork-canyon',
    name: 'Clockwork Canyon',
    tagline: 'Brass, belts and very busy gears.',
    feature: 'Timed gates · moving lifts · conveyor ledges',
    palette: {
      skyTop: '#ffcf8a', skyBottom: '#e0895a', horizon: '#8a4a2f', platform: '#8c5a2c',
      platformTop: '#d79a4c', accent: '#ffe066', accentTwo: '#ff9f68', glow: '#ffd28a',
      hazard: '#ff6b57', ink: '#3a2116',
    },
    music: { root: 220, scale: [0, 2, 3, 7, 9], tempo: 100, wave: 'square' },
    ambient: 'machine',
  },
  {
    index: 2,
    id: 'crystal-caverns',
    name: 'Crystal Caverns',
    tagline: 'Bounce a bolt around the dark.',
    feature: 'Ricochet mirrors · secret crystal pockets',
    palette: {
      skyTop: '#2a2350', skyBottom: '#4b3a7a', horizon: '#201a3c', platform: '#4c3d78',
      platformTop: '#8b74d6', accent: '#8ff5ff', accentTwo: '#d7a8ff', glow: '#a9f0ff',
      hazard: '#ff6f9c', ink: '#120d26',
    },
    music: { root: 174.61, scale: [0, 3, 5, 7, 10], tempo: 84, wave: 'sine' },
    ambient: 'cave',
  },
  {
    index: 3,
    id: 'voltage-city',
    name: 'Voltage City',
    tagline: 'Power the city one spark at a time.',
    feature: 'Volt batteries · circuits · electric gates',
    palette: {
      skyTop: '#1d2f63', skyBottom: '#2b6fa8', horizon: '#14203f', platform: '#2c3d6e',
      platformTop: '#5f8ed6', accent: '#ffe05a', accentTwo: '#66f0ff', glow: '#fff7a8',
      hazard: '#ff5f7a', ink: '#0d1428',
    },
    music: { root: 246.94, scale: [0, 2, 4, 7, 11], tempo: 108, wave: 'sawtooth' },
    ambient: 'electric',
  },
  {
    index: 4,
    id: 'floating-gardens',
    name: 'Floating Gardens',
    tagline: 'Grow a path where there is none.',
    feature: 'Growth seeds · vine bridges · blossom lifts',
    palette: {
      skyTop: '#a8e6ff', skyBottom: '#ffd9ec', horizon: '#5f9e7d', platform: '#3f8a63',
      platformTop: '#84e8a1', accent: '#ff9ed2', accentTwo: '#ffe066', glow: '#d9fff0',
      hazard: '#ff7a9b', ink: '#1c3a2c',
    },
    music: { root: 293.66, scale: [0, 2, 4, 7, 9], tempo: 90, wave: 'sine' },
    ambient: 'garden',
  },
  {
    index: 5,
    id: 'gravity-workshop',
    name: 'Gravity Workshop',
    tagline: 'Push, pull and ponder.',
    feature: 'Gravity crates · pressure plates · magnet rails',
    palette: {
      skyTop: '#3a2d63', skyBottom: '#6d4a8a', horizon: '#241c42', platform: '#4b3d6e',
      platformTop: '#9b7fd6', accent: '#b177ff', accentTwo: '#7fe0ff', glow: '#dcc4ff',
      hazard: '#ff6b8a', ink: '#140f28',
    },
    music: { root: 196, scale: [0, 2, 3, 6, 7], tempo: 96, wave: 'triangle' },
    ambient: 'lab',
  },
  {
    index: 6,
    id: 'frostbound-towers',
    name: 'Frostbound Towers',
    tagline: 'Mind the slippery bits.',
    feature: 'Ice ledges · frozen gates · snow drift',
    palette: {
      skyTop: '#bde6ff', skyBottom: '#e8f4ff', horizon: '#7fa6c9', platform: '#6f8fb3',
      platformTop: '#c6e6ff', accent: '#8ff5ff', accentTwo: '#ffffff', glow: '#e8fbff',
      hazard: '#5f8fff', ink: '#20334a',
    },
    music: { root: 329.63, scale: [0, 2, 4, 7, 9], tempo: 88, wave: 'sine' },
    ambient: 'snow',
  },
  {
    index: 7,
    id: 'neon-dreamscape',
    name: 'Neon Dreamscape',
    tagline: 'Every switch is a light show.',
    feature: 'Sequence circuits · hologram ledges',
    palette: {
      skyTop: '#1a1040', skyBottom: '#3c1263', horizon: '#120a2c', platform: '#33205c',
      platformTop: '#7a4fd6', accent: '#ff5fe0', accentTwo: '#5fffe0', glow: '#ff9ef2',
      hazard: '#ff4f8a', ink: '#0b0620',
    },
    music: { root: 220, scale: [0, 2, 5, 7, 10], tempo: 116, wave: 'square' },
    ambient: 'neon',
  },
  {
    index: 8,
    id: 'starlight-citadel',
    name: 'Starlight Citadel',
    tagline: 'Climb above the clouds.',
    feature: 'Every blaster · long vertical climbs',
    palette: {
      skyTop: '#141a4a', skyBottom: '#2f2a6e', horizon: '#0d1030', platform: '#2a2f60',
      platformTop: '#6f7fe0', accent: '#ffe066', accentTwo: '#9fb4ff', glow: '#dfe8ff',
      hazard: '#ff6f9c', ink: '#080a1e',
    },
    music: { root: 261.63, scale: [0, 2, 4, 7, 11], tempo: 98, wave: 'sine' },
    ambient: 'space',
  },
  {
    index: 9,
    id: 'grand-switchworks',
    name: 'The Grand Switchworks',
    tagline: 'The machine that runs the world.',
    feature: 'Masterwork puzzles · the final guardian',
    palette: {
      skyTop: '#3d1f5c', skyBottom: '#7a3f7f', horizon: '#25123a', platform: '#5c3a6e',
      platformTop: '#c08ae0', accent: '#ffe066', accentTwo: '#6ff2c8', glow: '#ffe8c4',
      hazard: '#ff5f7a', ink: '#140a20',
    },
    music: { root: 196, scale: [0, 2, 4, 7, 9], tempo: 104, wave: 'triangle' },
    ambient: 'grand',
  },
]

export const WORLD_COUNT = WORLDS.length

export function worldAt(index: number): WorldTheme {
  return WORLDS[Math.max(0, Math.min(WORLDS.length - 1, index))]
}

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16)
}
