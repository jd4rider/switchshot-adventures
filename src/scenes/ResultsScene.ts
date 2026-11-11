import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '../config'
import { audio } from '../core/audio'
import { loadSave } from '../core/save'
import { ACHIEVEMENT_BY_ID } from '../data/achievements'
import { getLevelMeta, totalStars } from '../data/levels'
import { worldAt } from '../data/worlds'
import { openTipJar, arcadeSnapshot } from '../platform/arcade'
import type { ResultsData } from '../types'
import { Backdrop } from '../world/Backdrop'
import { UiButton, addStars, formatMs, formatScore, panel } from '../ui/common'

export class ResultsScene extends Phaser.Scene {
  private results!: ResultsData

  constructor() {
    super('Results')
  }

  init(data: ResultsData): void {
    this.results = data
  }

  create(): void {
    const save = loadSave()
    const data = this.results
    const world = worldAt(data.worldIndex)
    new Backdrop(this, data.worldIndex, save.settings.reducedMotion)
    audio.setMood('results', world)
    audio.setSettings(save.settings)
    if (data.success) audio.sfx('victory')

    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08060f, 0.42)
    void shade
    const cardColor = data.success ? 0x6ff2c8 : 0xff5f7a
    panel(this, 64, 146, GAME_WIDTH - 128, 900, cardColor, 0.95, 20)

    this.add
      .text(GAME_WIDTH / 2, 190, data.success ? 'ROOM CLEARED' : 'TRY AGAIN', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: data.success ? CSS.mint : CSS.danger,
        letterSpacing: 4,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 222, data.levelName.toUpperCase(), {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: CSS.cream,
        align: 'center',
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 252, `${world.name.toUpperCase()}  ·  ${data.mode.toUpperCase()}`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.55)',
        letterSpacing: 2,
      })
      .setOrigin(0.5)

    const stars = addStars(this, GAME_WIDTH / 2, 306, data.result.stars, 44, 56).setDepth(21)
    stars.setAlpha(0)
    this.tweens.add({ targets: stars, alpha: 1, duration: 260, delay: 120 })
    if (data.success) {
      for (let index = 0; index < Math.max(1, data.result.stars); index += 1) {
        this.tweens.add({ targets: stars.getAt(index), scale: { from: 1.5, to: 1 }, angle: { from: -12, to: 0 }, duration: 340, delay: 150 + index * 110, ease: 'Back.easeOut' })
      }
    }

    this.add
      .text(GAME_WIDTH / 2, 352, formatScore(data.result.score), {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '38px',
        fontStyle: 'bold',
        color: CSS.gold,
        stroke: '#171032',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 382, 'POINTS', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.5)',
        letterSpacing: 3,
      })
      .setOrigin(0.5)

    const rows: Array<[string, string]> = [
      ['GEMS', `${data.result.gems}/${data.result.requiredGems}`],
      ['TIME', formatMs(data.result.timeMs)],
      ['SHOTS', `${data.result.hits}/${data.result.shots || 0} HIT`],
      ['RICOCHETS', `${data.result.ricochets}`],
      ['NO DAMAGE', data.result.noDamage ? 'YES' : 'NO'],
      ['SECRET GEMS', `${data.result.optionalGems}`],
    ]
    rows.forEach(([label, value], index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = 130 + col * 250
      const y = 424 + row * 46
      this.add.text(x, y, label, { fontFamily: '"Avenir Next", sans-serif', fontSize: '9px', fontStyle: 'bold', color: 'rgba(255,246,226,0.45)', letterSpacing: 1.5 })
      this.add.text(x, y + 13, value, { fontFamily: '"Avenir Next", sans-serif', fontSize: '14px', fontStyle: 'bold', color: CSS.cream })
    })

    if (data.mode === 'journey') {
      this.add
        .text(GAME_WIDTH / 2, 584, `STAR GOALS · ALL GEMS  ·  NO DAMAGE  ·  ${totalStars(loadSave())} TOTAL STARS`, {
          fontFamily: '"Avenir Next", sans-serif',
          fontSize: '9px',
          fontStyle: 'bold',
          color: 'rgba(255,246,226,0.5)',
          letterSpacing: 1.2,
        })
        .setOrigin(0.5)
    } else if (data.mode === 'endless') {
      this.add
        .text(GAME_WIDTH / 2, 584, `FLOOR ${data.result.endlessHeight ?? 1}  ·  BEST ${loadSave().modes.endlessBestHeight}`, {
          fontFamily: '"Avenir Next", sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: CSS.mint,
          letterSpacing: 2,
        })
        .setOrigin(0.5)
    }

    if (data.newAchievements.length > 0) {
      const names = data.newAchievements.map((id) => ACHIEVEMENT_BY_ID.get(id)?.name ?? id).join('  ·  ')
      this.add
        .text(GAME_WIDTH / 2, 616, `TROPHY UNLOCKED\n${names}`, {
          fontFamily: '"Avenir Next", sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: CSS.gold,
          align: 'center',
          lineSpacing: 4,
          wordWrap: { width: 460 },
        })
        .setOrigin(0.5)
    }

    const nextMeta = data.nextLevelId ? getLevelMeta(data.nextLevelId) : null
    const topButtonY = 730
    if (data.success) {
      if (data.nextLevelId) {
        new UiButton(this, {
          x: GAME_WIDTH / 2,
          y: topButtonY,
          width: 430,
          height: 56,
          label: 'NEXT ROOM',
          sublabel: `${data.nextLevelId.toUpperCase()} · ${nextMeta?.name ?? ''}`,
          glyph: '▶',
          color: 0x6ff2c8,
          align: 'left',
          onClick: () => this.next(data.nextLevelId as string),
        }).setDepth(30)
      } else {
        new UiButton(this, {
          x: GAME_WIDTH / 2,
          y: topButtonY,
          width: 430,
          height: 56,
          label: data.mode === 'challenge' ? 'BACK TO ARCADE' : 'THE JOURNEY CONTINUES',
          small: true,
          glyph: '★',
          color: 0xffd75e,
          onClick: () => this.scene.start(data.mode === 'challenge' ? 'Challenge' : 'Journey'),
        }).setDepth(30)
      }
    } else {
      new UiButton(this, {
        x: GAME_WIDTH / 2,
        y: topButtonY,
        width: 430,
        height: 56,
        label: 'TRY AGAIN',
        glyph: '↻',
        color: 0xff8fc7,
        onClick: () => this.retry(),
      }).setDepth(30)
    }

    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 800,
      width: 430,
      height: 46,
      label: 'REPLAY ROOM',
      small: true,
      glyph: '↻',
      color: 0x77d7ff,
      onClick: () => this.retry(),
    }).setDepth(30)
    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 856,
      width: 430,
      height: 46,
      label: data.mode === 'challenge' ? 'ARCADE MODES' : 'WORLD MAP',
      small: true,
      glyph: '✺',
      color: 0xb79cff,
      onClick: () => this.scene.start(data.mode === 'challenge' ? 'Challenge' : 'Journey', { worldIndex: data.worldIndex }),
    }).setDepth(30)

    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 926,
      width: 300,
      height: 38,
      label: '☕ BUY ME A COFFEE',
      small: true,
      color: 0xffd75e,
      onClick: () => openTipJar(),
    }).setDepth(30)

    const arcade = arcadeSnapshot()
    this.add
      .text(GAME_WIDTH / 2, 976, arcade.signedIn ? `☁ ${arcade.label}` : 'PROGRESS SAVED ON THIS DEVICE', {
        fontFamily: '"Avenir Next", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.4)',
        letterSpacing: 1.2,
      })
      .setOrigin(0.5)
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (data.success && data.nextLevelId) this.next(data.nextLevelId)
      else this.retry()
    })
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Journey', { worldIndex: data.worldIndex }))
    document.body.dataset.switchshotResult = data.success ? 'success' : 'failure'
  }

  private next(levelId: string): void {
    audio.sfx('click')
    this.scene.start('Game', { levelId, mode: this.results.mode === 'speedrun' ? 'speedrun' : 'journey' })
  }

  private retry(): void {
    audio.sfx('click')
    if (this.results.mode === 'endless') {
      this.scene.start('Game', { mode: 'endless', stage: 0, runScore: 0, runHealth: 3, runDeaths: 0 })
      return
    }
    if (this.results.mode === 'daily') {
      this.scene.start('Game', { mode: 'daily', dailyDate: this.results.result.dailyDate })
      return
    }
    if (this.results.mode === 'challenge') {
      this.scene.start('Game', { mode: 'challenge', challengeId: this.results.result.challengeId })
      return
    }
    this.scene.start('Game', { levelId: this.results.levelId, mode: this.results.mode })
  }
}
