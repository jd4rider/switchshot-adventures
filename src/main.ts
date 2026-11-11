import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, TUNING, VERSION } from './config'
import { audio } from './core/audio'
import { AchievementScene } from './scenes/AchievementScene'
import { BootScene } from './scenes/BootScene'
import { ChallengeScene } from './scenes/ChallengeScene'
import { GameScene } from './scenes/GameScene'
import { JourneyScene } from './scenes/JourneyScene'
import { MenuScene } from './scenes/MenuScene'
import { ResultsScene } from './scenes/ResultsScene'
import { SettingsScene } from './scenes/SettingsScene'

declare global {
  interface Window {
    __SWITCHSHOT__?: {
      game: Phaser.Game
      active: () => string | null
      state: () => unknown
      launch: (levelId: string, mode?: string) => void
      fireAt: (x: number, y: number) => void
      collectGems: () => void
      teleportToExit: () => void
      defeatBoss: () => void
      damage: () => void
      finish: () => void
      standOnStair: () => void
    }
  }
}

const designAspect = GAME_WIDTH / GAME_HEIGHT
const scaleModeForViewport = (): Phaser.Scale.ScaleModeType =>
  window.innerWidth / Math.max(1, window.innerHeight) <= designAspect + 0.015 ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT
let activeScaleMode = scaleModeForViewport()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#100b1f',
  scale: {
    mode: activeScaleMode,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false,
    powerPreference: 'high-performance',
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: TUNING.gravity }, debug: false, fps: 60 },
  },
  input: { activePointers: 5, gamepad: true },
  fps: { target: 60, smoothStep: false },
  scene: [BootScene, MenuScene, JourneyScene, ChallengeScene, GameScene, ResultsScene, SettingsScene, AchievementScene],
}

const game = new Phaser.Game(config)

const activeScene = (): Phaser.Scene | null => game.scene.getScenes(true)[0] ?? null

const state = (): unknown => {
  const scene = activeScene()
  if (scene instanceof GameScene) return scene.testState()
  return { scene: scene?.scene.key ?? null }
}

window.__SWITCHSHOT__ = {
  game,
  active: () => activeScene()?.scene.key ?? null,
  state,
  launch: (levelId, mode = 'journey') => {
    game.scene.getScenes(true).forEach((scene) => game.scene.stop(scene.scene.key))
    game.scene.start('Game', { levelId, mode })
  },
  fireAt: (x, y) => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugFireAt(x, y)
  },
  collectGems: () => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugCollectGems()
  },
  teleportToExit: () => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugTeleportToExit()
  },
  defeatBoss: () => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugDefeatBoss()
  },
  damage: () => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugDamage()
  },
  finish: () => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugFinish()
  },
  standOnStair: () => {
    const scene = activeScene()
    if (scene instanceof GameScene) scene.debugStandOnTopStair()
  },
}

document.documentElement.dataset.game = 'switchshot-adventures'
document.documentElement.dataset.version = VERSION
document.body.dataset.switchshot = 'ready'

document.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true })
document.addEventListener('keydown', () => audio.unlock(), { once: true, capture: true })
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') audio.suspend()
  else audio.resume()
})

const preventCanvasScroll = (event: TouchEvent): void => {
  if (event.touches.length > 1) return
  const target = event.target as HTMLElement | null
  if (target?.tagName === 'CANVAS') event.preventDefault()
}
document.addEventListener('touchmove', preventCanvasScroll, { passive: false })

window.addEventListener('resize', () => {
  const next = scaleModeForViewport()
  if (next !== activeScaleMode) {
    activeScaleMode = next
    game.scale.scaleMode = next
  }
  game.scale.refresh()
})
window.addEventListener('load', () => game.scale.refresh())
window.setTimeout(() => game.scale.refresh(), 120)

window.addEventListener('error', (event) => {
  if (!event.error) document.getElementById('boot-fail')?.classList.add('visible')
})
window.addEventListener('unhandledrejection', () => {
  document.getElementById('boot-fail')?.classList.add('visible')
})
