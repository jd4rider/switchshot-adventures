import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH, VERSION } from '../config'
import { audio } from '../core/audio'
import { reconcileProgress } from '../core/progress'
import { loadSave } from '../core/save'
import { completedLevels, firstIncompleteLevel, getLevelMeta, totalStars } from '../data/levels'
import { arcadeSnapshot, openTipJar } from '../platform/arcade'
import { PipView } from '../player/PipView'
import { Backdrop } from '../world/Backdrop'
import { addStars, iconButton, UiButton } from '../ui/common'

export class MenuScene extends Phaser.Scene {
  private pip!: PipView
  private clock = 0
  private helpLayer?: Phaser.GameObjects.Container
  private helpOpen = false

  constructor() {
    super('Menu')
  }

  create(): void {
    const progress = reconcileProgress()
    const save = progress.save
    audio.setMood('menu')
    new Backdrop(this, save.lastLevelId.startsWith('w10') ? 9 : 0, save.settings.reducedMotion)

    const completed = completedLevels(save)
    const next = firstIncompleteLevel(save)
    const nextMeta = getLevelMeta(next)?.name ?? next
    const arcade = arcadeSnapshot()

    this.add
      .text(GAME_WIDTH / 2, 52, 'LITTLE JOY ARCADE', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: CSS.mint,
        letterSpacing: 5,
      })
      .setOrigin(0.5)

    const title = this.add
      .text(GAME_WIDTH / 2, 96, 'SWITCHSHOT', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '50px',
        fontStyle: 'bold',
        color: '#fff6e2',
        stroke: '#171032',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 148, 'ADVENTURES', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ffd75e',
        stroke: '#171032',
        strokeThickness: 8,
        letterSpacing: 2,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 190, 'Every shot opens a new adventure.', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '13px',
        color: 'rgba(255,246,226,0.74)',
      })
      .setOrigin(0.5)
    if (!save.settings.reducedMotion) {
      this.tweens.add({ targets: title, y: 92, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }

    this.pip = new PipView(this, 22)
    this.pip.update(
      {
        x: GAME_WIDTH / 2,
        y: 330,
        velocityX: 0,
        velocityY: 0,
        onGround: false,
        facing: 1,
        aimX: GAME_WIDTH / 2 + 60,
        aimY: 300,
        firing: false,
        invulnerable: false,
        reducedMotion: save.settings.reducedMotion,
      },
      16,
    )
    const platformGlow = this.add.graphics().setDepth(19)
    platformGlow.fillStyle(0x6ff2c8, 0.16)
    platformGlow.fillEllipse(GAME_WIDTH / 2, 356, 220, 26)
    const platform = this.add.graphics().setDepth(21)
    platform.fillStyle(0x2a7a63, 1)
    platform.fillRoundedRect(GAME_WIDTH / 2 - 100, 348, 200, 12, 6)
    platform.fillStyle(0x6ff2c8, 1)
    platform.fillRoundedRect(GAME_WIDTH / 2 - 100, 348, 200, 5, 3)

    this.add
      .text(GAME_WIDTH / 2, 386, 'PIP  ·  SWITCHSHOT ADVENTURER', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.45)',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(22)

    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 470,
      width: 470,
      height: 62,
      label: completed >= 500 ? 'REPLAY THE JOURNEY' : 'CONTINUE JOURNEY',
      sublabel: completed >= 500 ? 'All 500 levels cleared' : `${next.toUpperCase()} · ${nextMeta}`,
      glyph: '▶',
      color: 0x6ff2c8,
      align: 'left',
      onClick: () => this.startLevel(next),
    }).setDepth(30)
    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 542,
      width: 470,
      height: 54,
      label: 'WORLD MAP',
      sublabel: `${completed}/500 levels · ${totalStars(save)} stars`,
      glyph: '✺',
      color: 0x77d7ff,
      align: 'left',
      onClick: () => this.open('Journey'),
    }).setDepth(30)
    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 606,
      width: 470,
      height: 54,
      label: 'ARCADE MODES',
      sublabel: 'Endless Tower · Daily · Speedrun · Challenge Rooms',
      glyph: '◈',
      color: 0xff8fc7,
      align: 'left',
      onClick: () => this.open('Challenge'),
    }).setDepth(30)
    new UiButton(this, {
      x: 192,
      y: 688,
      width: 210,
      height: 54,
      label: 'TROPHIES',
      small: true,
      glyph: '♛',
      color: 0xffd75e,
      onClick: () => this.open('Achievements'),
    }).setDepth(30)
    new UiButton(this, {
      x: 528,
      y: 688,
      width: 210,
      height: 54,
      label: 'SETTINGS',
      small: true,
      glyph: '⚙',
      color: 0x9fe8ff,
      onClick: () => this.open('Settings'),
    }).setDepth(30)
    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 762,
      width: 470,
      height: 46,
      label: 'HOW TO PLAY',
      small: true,
      glyph: '?',
      color: 0xb79cff,
      onClick: () => this.showHelp(),
    }).setDepth(30)

    const stars = addStars(this, GAME_WIDTH / 2, 840, Math.min(3, Math.floor(totalStars(save) / 150)), 16, 20)
    stars.setDepth(30)
    this.add
      .text(GAME_WIDTH / 2, 866, `${totalStars(save)} / 1,500 STARS`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.5)',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(30)

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 64, arcade.signedIn ? `☁ ${arcade.label}` : 'PROGRESS SAVES ON THIS DEVICE', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.45)',
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)
      .setDepth(30)
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, `A LITTLE JOY ARCADE GAME  ·  v${VERSION}`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.32)',
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)
      .setDepth(30)

    iconButton(this, GAME_WIDTH - 48, 46, '☕', () => openTipJar(), 'Support').setDepth(40)
    iconButton(this, 48, 46, '?', () => this.showHelp(), 'How to play').setDepth(40)

    this.spawnFloatingSparks(save.settings.reducedMotion)
    this.input.keyboard?.on('keydown-ENTER', () => this.startLevel(next))
    this.input.keyboard?.on('keydown-SPACE', () => this.startLevel(next))
    this.input.keyboard?.on('keydown-H', () => this.showHelp())
  }

  private spawnFloatingSparks(reduced: boolean): void {
    for (let index = 0; index < 12; index += 1) {
      const spark = this.add
        .image(40 + ((index * 109) % 630), 430 + ((index * 71) % 360), index % 4 === 0 ? 'gem-optional' : `gem-${index % 3}`)
        .setDisplaySize(15 + (index % 3) * 4, 15 + (index % 3) * 4)
        .setAlpha(0.34)
        .setDepth(5)
      if (!reduced) {
        this.tweens.add({
          targets: spark,
          y: spark.y - 24 - (index % 3) * 8,
          alpha: 0.58,
          duration: 1900 + index * 160,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: index * 120,
        })
      }
    }
  }

  private startLevel(levelId: string): void {
    if (this.helpOpen) return
    audio.unlock()
    audio.sfx('click')
    this.scene.start('Game', { levelId, mode: 'journey' })
  }

  private open(key: string): void {
    if (this.helpOpen) return
    audio.unlock()
    audio.sfx('click')
    this.scene.start(key)
  }

  private showHelp(): void {
    if (this.helpOpen) return
    this.helpOpen = true
    audio.sfx('click')
    const layer = this.add.container(0, 0).setDepth(5000)
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08060f, 0.85).setInteractive()
    const card = this.add.graphics()
    card.fillStyle(0x18112e, 1)
    card.fillRoundedRect(56, 150, GAME_WIDTH - 112, 660, 22)
    card.lineStyle(1.5, 0x6ff2c8, 0.5)
    card.strokeRoundedRect(56, 150, GAME_WIDTH - 112, 660, 22)
    const title = this.add
      .text(GAME_WIDTH / 2, 190, 'HOW TO SWITCHSHOT', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#fff6e2',
      })
      .setOrigin(0.5)
    const lines: Array<[string, string]> = [
      ['MOVE', 'Drag in the lower-left pad. Or use A / D and the arrow keys.'],
      ['JUMP', 'Flick up in the pad, press Space, or turn on Classic Buttons.'],
      ['SHOOT', 'Tap anywhere in the room. Pip fires at that exact spot.'],
      ['POWER', 'Yellow Volt charges circuits. Green Growth wakes seeds. Purple Gravity shoves crates.'],
      ['CHANGE MODE', 'Tap the blaster pill in the HUD or press 1–4.'],
      ['PUZZLE', 'Open each hatch above you, climb the ledges, reach the exit portal.'],
      ['STARS', 'Clear the room, collect every gem, and avoid all damage for three stars.'],
      ['PAUSE', 'Esc or the pause button. R restarts from the last checkpoint.'],
    ]
    layer.add([shade, card, title])
    lines.forEach(([label, copy], index) => {
      const y = 236 + index * 68
      layer.add(
        this.add.text(84, y, label, {
          fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#6ff2c8',
          letterSpacing: 1,
        }),
      )
      layer.add(
        this.add.text(84, y + 17, copy, {
          fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
          fontSize: '11px',
          color: 'rgba(255,246,226,0.76)',
          wordWrap: { width: 520 },
        }),
      )
    })
    const close = new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 760,
      width: 210,
      height: 46,
      label: 'GOT IT',
      small: true,
      color: 0x6ff2c8,
      onClick: () => this.hideHelp(),
    })
    layer.add(close.container)
    shade.on('pointerdown', () => this.hideHelp())
    this.helpLayer = layer
  }

  private hideHelp(): void {
    this.helpOpen = false
    this.helpLayer?.destroy(true)
    this.helpLayer = undefined
  }

  update(_time: number, delta: number): void {
    this.clock += delta
    this.pip.update(
      {
        x: GAME_WIDTH / 2 + Math.sin(this.clock * 0.0008) * 12,
        y: 330 + Math.sin(this.clock * 0.002) * 5,
        velocityX: Math.sin(this.clock * 0.0012) * 18,
        velocityY: 0,
        onGround: true,
        facing: 1,
        aimX: GAME_WIDTH / 2 + 70 + Math.sin(this.clock * 0.0015) * 30,
        aimY: 290,
        firing: false,
        invulnerable: false,
        reducedMotion: loadSave().settings.reducedMotion,
      },
      delta,
    )
  }
}
