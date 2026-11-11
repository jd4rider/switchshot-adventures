import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '../config'
import { audio } from '../core/audio'
import { loadSave } from '../core/save'
import { CHALLENGES, CHALLENGE_BY_ID } from '../data/challenges'
import { dailyDate, dailyMeta, getLevelMeta, speedrunCandidates } from '../data/levels'
import { Backdrop } from '../world/Backdrop'
import { UiButton, addStars, backButton, formatMs, formatScore, pageTitle, panel } from '../ui/common'

export class ChallengeScene extends Phaser.Scene {
  private speedrunIndex = 0
  private candidates: ReturnType<typeof speedrunCandidates> = []

  constructor() {
    super('Challenge')
  }

  create(): void {
    const save = loadSave()
    this.candidates = speedrunCandidates(save)
    this.speedrunIndex = Phaser.Math.Clamp(this.speedrunIndex, 0, Math.max(0, this.candidates.length - 1))
    audio.setMood('menu')
    new Backdrop(this, 7, save.settings.reducedMotion)
    pageTitle(this, 'Little Joy Arcade', 'Arcade Modes', 'A tower, a daily room and a few sharp challenges.')

    panel(this, 56, 132, GAME_WIDTH - 112, 122, 0x6ff2c8, 0.9, 12)
    this.add.text(78, 150, 'ENDLESS TOWER', { fontFamily: '"Avenir Next", sans-serif', fontSize: '16px', fontStyle: 'bold', color: CSS.cream })
    this.add.text(78, 176, 'Climb an endless machine. Every floor is taller and sharper.', { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', color: 'rgba(255,246,226,0.66)' })
    this.add.text(78, 200, `BEST · FLOOR ${save.modes.endlessBestHeight}  ·  ${formatScore(save.modes.endlessBestScore)} PTS`, { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', fontStyle: 'bold', color: CSS.mint, letterSpacing: 1 })
    new UiButton(this, { x: GAME_WIDTH - 136, y: 192, width: 132, height: 46, label: 'PLAY', small: true, color: 0x6ff2c8, onClick: () => this.startEndless() }).setDepth(30)

    const daily = dailyMeta()
    const dailyDone = save.modes.daily?.date === dailyDate() ? save.modes.daily : null
    panel(this, 56, 266, GAME_WIDTH - 112, 122, 0xff8fc7, 0.9, 12)
    this.add.text(78, 284, 'DAILY PUZZLE', { fontFamily: '"Avenir Next", sans-serif', fontSize: '16px', fontStyle: 'bold', color: CSS.cream })
    this.add.text(78, 310, `${dailyDate()} · ${daily.name}`, { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', color: 'rgba(255,246,226,0.66)' })
    this.add.text(78, 334, dailyDone ? `CLEARED · ${dailyDone.stars} STARS · ${formatMs(dailyDone.timeMs)}` : 'ONE ROOM · ONE NEW SEED EVERY DAY', { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ff8fc7', letterSpacing: 1 })
    new UiButton(this, { x: GAME_WIDTH - 136, y: 326, width: 132, height: 46, label: dailyDone ? 'REPLAY' : 'PLAY', small: true, color: 0xff8fc7, onClick: () => this.startDaily() }).setDepth(30)

    panel(this, 56, 400, GAME_WIDTH - 112, 154, 0x77d7ff, 0.9, 12)
    this.add.text(78, 418, 'SPEEDRUN', { fontFamily: '"Avenir Next", sans-serif', fontSize: '16px', fontStyle: 'bold', color: CSS.cream })
    const selected = this.candidates[this.speedrunIndex]
    const best = selected ? save.modes.speedrun[selected.id] : undefined
    this.add.text(78, 444, selected ? `${selected.id.toUpperCase()} · ${selected.name}` : 'Clear a Journey room to start a record.', { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', color: 'rgba(255,246,226,0.68)' })
    this.add.text(78, 468, selected ? `BEST ${formatMs(best ?? 0)}` : 'NO RECORD YET', { fontFamily: '"Avenir Next", sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#77d7ff', letterSpacing: 1 })
    new UiButton(this, { x: GAME_WIDTH - 136, y: 462, width: 132, height: 46, label: 'PLAY', small: true, color: 0x77d7ff, disabled: !selected, onClick: () => this.startSpeedrun() }).setDepth(30)
    new UiButton(this, { x: 88, y: 526, width: 44, height: 34, label: '‹', small: true, color: 0x77d7ff, disabled: this.candidates.length < 2, onClick: () => this.cycleSpeedrun(-1) }).setDepth(30)
    new UiButton(this, { x: 144, y: 526, width: 44, height: 34, label: '›', small: true, color: 0x77d7ff, disabled: this.candidates.length < 2, onClick: () => this.cycleSpeedrun(1) }).setDepth(30)
    this.add.text(210, 526, 'PICK A CLEARED ROOM', { fontFamily: '"Avenir Next", sans-serif', fontSize: '9px', fontStyle: 'bold', color: 'rgba(255,246,226,0.42)', letterSpacing: 1.4 }).setOrigin(0, 0.5)

    this.add.text(GAME_WIDTH / 2, 584, 'CHALLENGE ROOMS', { fontFamily: '"Avenir Next", sans-serif', fontSize: '13px', fontStyle: 'bold', color: CSS.gold, letterSpacing: 3 }).setOrigin(0.5)
    CHALLENGES.forEach((challenge, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = 56 + col * 308
      const y = 612 + row * 104
      const record = save.modes.challenges[challenge.id]
      const graphics = this.add.graphics().setDepth(12)
      graphics.fillStyle(0x110c22, 0.92)
      graphics.fillRoundedRect(x, y, 300, 94, 14)
      graphics.fillStyle(0xffd75e, record?.completed ? 0.13 : 0.05)
      graphics.fillRoundedRect(x, y, 300, 94, 14)
      graphics.lineStyle(1.5, record?.completed ? 0xffd75e : 0x8b7fa8, 0.55)
      graphics.strokeRoundedRect(x, y, 300, 94, 14)
      this.add.text(x + 14, y + 12, challenge.name.toUpperCase(), { fontFamily: '"Avenir Next", sans-serif', fontSize: '11px', fontStyle: 'bold', color: CSS.cream, letterSpacing: 1 }).setDepth(13)
      this.add.text(x + 14, y + 32, challenge.objective, { fontFamily: '"Avenir Next", sans-serif', fontSize: '9px', color: 'rgba(255,246,226,0.64)', wordWrap: { width: 268 } }).setDepth(13)
      this.add.text(x + 14, y + 68, record?.completed ? `${record.stars} STARS · ${formatMs(record.bestTimeMs)}` : 'NOT CLEARED', { fontFamily: '"Avenir Next", sans-serif', fontSize: '9px', fontStyle: 'bold', color: record?.completed ? CSS.gold : 'rgba(255,246,226,0.32)', letterSpacing: 1 }).setDepth(13)
      addStars(this, x + 268, y + 22, record?.stars ?? 0, 11, 12).setDepth(13)
      const hit = this.add.rectangle(x + 150, y + 47, 300, 94, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(14)
      hit.on('pointerdown', () => {
        audio.sfx('click')
        this.scene.start('Game', { mode: 'challenge', challengeId: challenge.id })
      })
      void CHALLENGE_BY_ID
      void getLevelMeta
    })

    backButton(this, () => {
      audio.sfx('back')
      this.scene.start('Menu')
    }, GAME_HEIGHT - 40).setDepth(30)
  }

  private cycleSpeedrun(direction: number): void {
    if (this.candidates.length === 0) return
    this.speedrunIndex = (this.speedrunIndex + direction + this.candidates.length) % this.candidates.length
    this.scene.restart()
  }

  private startEndless(): void {
    audio.unlock()
    audio.sfx('click')
    this.scene.start('Game', { mode: 'endless', stage: 0, runScore: 0, runHealth: 3, runDeaths: 0 })
  }

  private startDaily(): void {
    audio.unlock()
    audio.sfx('click')
    this.scene.start('Game', { mode: 'daily', dailyDate: dailyDate() })
  }

  private startSpeedrun(): void {
    const selected = this.candidates[this.speedrunIndex]
    if (!selected) return
    audio.unlock()
    audio.sfx('click')
    this.scene.start('Game', { levelId: selected.id, mode: 'speedrun' })
  }
}
