import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH, SAFE_TOP } from '../config'
import type { GameplaySettings, Rect } from '../types'
import { formatMs } from './common'

export interface HudState {
  worldName: string
  levelName: string
  health: number
  maxHealth: number
  gems: number
  requiredGems: number
  modeLabel: string
  objective: string
  timeMs: number
  showTimer: boolean
  shots?: number
  shotLimit?: number
}

export interface HudCallbacks {
  onPause: () => void
  onMode: () => void
}

export class Hud {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly levelText: Phaser.GameObjects.Text
  private readonly worldText: Phaser.GameObjects.Text
  private readonly objectiveText: Phaser.GameObjects.Text
  private readonly gemText: Phaser.GameObjects.Text
  private readonly timerText: Phaser.GameObjects.Text
  private readonly hearts: Phaser.GameObjects.Image[] = []
  private readonly modeLabel: Phaser.GameObjects.Text
  private readonly toastText: Phaser.GameObjects.Text
  private readonly toastBackground: Phaser.GameObjects.Graphics
  private readonly pauseButton: Phaser.GameObjects.Container
  private readonly modeButton: Phaser.GameObjects.Container
  private readonly settings: GameplaySettings
  private toastTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene, callbacks: HudCallbacks, settings: GameplaySettings) {
    this.scene = scene
    this.settings = settings
    const bar = scene.add.graphics()
    bar.fillGradientStyle(0x0b0819, 0x0b0819, 0x0b0819, 0x0b0819, 0.86, 0.86, 0.2, 0.2)
    bar.fillRect(0, 0, GAME_WIDTH, 132)
    bar.lineStyle(1, 0xffffff, 0.08)
    bar.beginPath()
    bar.moveTo(0, 132)
    bar.lineTo(GAME_WIDTH, 132)
    bar.strokePath()

    this.worldText = scene.add.text(26, SAFE_TOP - 14, '', {
      fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: CSS.mint,
      letterSpacing: 3,
    })
    this.levelText = scene.add.text(26, SAFE_TOP + 2, '', {
      fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
      fontSize: '19px',
      fontStyle: 'bold',
      color: CSS.cream,
      wordWrap: { width: 430 },
    })
    this.objectiveText = scene.add.text(GAME_WIDTH / 2, 140, '', {
      fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
      fontSize: '11px',
      color: 'rgba(255,246,226,0.78)',
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5, 0)
    this.gemText = scene.add.text(56, 86, '0/0', {
      fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: CSS.cream,
    }).setOrigin(0, 0.5)
    const gemIcon = scene.add.image(34, 86, 'gem-0').setDisplaySize(22, 22)
    this.timerText = scene.add.text(GAME_WIDTH - 80, 128, '', {
      fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CSS.gold,
    }).setOrigin(1, 1)

    for (let index = 0; index < 3; index += 1) {
      const heart = scene.add.image(GAME_WIDTH - 170 + index * 34, 40, 'heart-full').setDisplaySize(26, 24)
      this.hearts.push(heart)
    }

    const pauseGraphics = scene.add.graphics()
    pauseGraphics.fillStyle(0x0d0920, 0.8)
    pauseGraphics.fillCircle(0, 0, 21)
    pauseGraphics.lineStyle(1.5, 0xffffff, 0.26)
    pauseGraphics.strokeCircle(0, 0, 21)
    pauseGraphics.fillStyle(0xffffff, 0.9)
    pauseGraphics.fillRoundedRect(-6, -8, 4, 16, 2)
    pauseGraphics.fillRoundedRect(2, -8, 4, 16, 2)
    const pauseHit = scene.add.circle(0, 0, 28, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
    pauseHit.on('pointerdown', callbacks.onPause)
    // HUD controls sit inside the safe width because tall phones crop the design.
    this.pauseButton = scene.add.container(GAME_WIDTH - 100, SAFE_TOP + 22, [pauseGraphics, pauseHit]).setSize(56, 56)

    const modeGraphics = scene.add.graphics()
    modeGraphics.fillStyle(0x0d0920, 0.82)
    modeGraphics.fillRoundedRect(-58, -18, 116, 36, 12)
    modeGraphics.lineStyle(1.5, 0x59d6ff, 0.55)
    modeGraphics.strokeRoundedRect(-58, -18, 116, 36, 12)
    this.modeLabel = scene.add.text(0, 0, 'PULSE', {
      fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: CSS.cream,
      letterSpacing: 1,
    }).setOrigin(0.5)
    const modeHit = scene.add.rectangle(0, 0, 120, 40, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
    modeHit.on('pointerdown', callbacks.onMode)
    this.modeButton = scene.add.container(GAME_WIDTH - 130, SAFE_TOP + 78, [modeGraphics, this.modeLabel, modeHit]).setSize(120, 40)

    this.toastBackground = scene.add.graphics().setAlpha(0)
    this.toastText = scene.add
      .text(GAME_WIDTH / 2, 232, '', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: CSS.cream,
        align: 'center',
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5)
      .setAlpha(0)

    this.root = scene.add
      .container(0, 0, [
        bar,
        this.worldText,
        this.levelText,
        this.objectiveText,
        gemIcon,
        this.gemText,
        this.timerText,
        ...this.hearts,
        this.pauseButton,
        this.modeButton,
        this.toastBackground,
        this.toastText,
      ])
      .setDepth(900)
      .setScrollFactor(0)
    void GAME_HEIGHT
  }

  update(state: HudState): void {
    this.worldText.setText(state.worldName.toUpperCase())
    this.levelText.setText(state.levelName)
    this.objectiveText.setText(state.objective)
    this.gemText.setText(`${state.gems}/${state.requiredGems}`)
    this.modeLabel.setText(state.modeLabel)
    this.timerText.setText(state.showTimer ? formatMs(state.timeMs) : '')
    this.hearts.forEach((heart, index) => {
      heart.setTexture(index < state.health ? 'heart-full' : 'heart-empty')
      heart.setScale(index < state.health ? 1 : 0.9)
    })
    if (typeof state.shotLimit === 'number' && typeof state.shots === 'number') {
      this.timerText.setText(`${Math.max(0, state.shotLimit - state.shots)} SHOTS LEFT`)
    }
  }

  toast(message: string, color = 0x6ff2c8): void {
    this.toastText.setText(message).setColor(`#${color.toString(16).padStart(6, '0')}`)
    this.toastBackground.clear()
    const width = Math.min(640, this.toastText.width + 40)
    this.toastBackground.fillStyle(0x0b0819, 0.86)
    this.toastBackground.fillRoundedRect(GAME_WIDTH / 2 - width / 2, 210, width, Math.max(34, this.toastText.height + 20), 12)
    this.toastBackground.lineStyle(1, color, 0.4)
    this.toastBackground.strokeRoundedRect(GAME_WIDTH / 2 - width / 2, 210, width, Math.max(34, this.toastText.height + 20), 12)
    this.toastBackground.setAlpha(1)
    this.toastText.setY(226)
    this.toastText.setAlpha(1)
    this.toastTween?.stop()
    this.toastTween = this.scene.tweens.add({
      targets: [this.toastText, this.toastBackground],
      alpha: 0,
      delay: 1900,
      duration: 420,
      ease: 'Quad.easeIn',
    })
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible)
  }

  /** Screen-space rectangles that must never fire a shot. */
  blockedRects(): Rect[] {
    return [
      { x: GAME_WIDTH - 128, y: SAFE_TOP - 8, width: 60, height: 60 },
      { x: GAME_WIDTH - 190, y: SAFE_TOP + 58, width: 126, height: 44 },
    ]
  }

  setMode(label: string, color: number): void {
    this.modeLabel.setText(label)
    this.modeLabel.setColor(`#${color.toString(16).padStart(6, '0')}`)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
