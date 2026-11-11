import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '../config'
import { audio } from '../core/audio'
import { loadSave } from '../core/save'
import {
  LEVELS_PER_WORLD,
  currentWorld,
  firstIncompleteLevel,
  levelUnlocked,
  levelsForWorld,
  totalStars,
  worldCompleted,
  worldStars,
  worldUnlocked,
} from '../data/levels'
import { WORLD_COUNT, worldAt } from '../data/worlds'
import { Backdrop } from '../world/Backdrop'
import { UiButton, addStars, backButton, formatScore } from '../ui/common'

interface JourneyData {
  worldIndex?: number
}

export class JourneyScene extends Phaser.Scene {
  private worldIndex = 0

  constructor() {
    super('Journey')
  }

  init(data: JourneyData): void {
    const save = loadSave()
    this.worldIndex = Phaser.Math.Clamp(data.worldIndex ?? currentWorld(save), 0, WORLD_COUNT - 1)
  }

  create(): void {
    const save = loadSave()
    const world = worldAt(this.worldIndex)
    const unlocked = worldUnlocked(save, this.worldIndex)
    audio.setMood('menu', world)
    new Backdrop(this, this.worldIndex, save.settings.reducedMotion)

    this.add
      .text(GAME_WIDTH / 2, 40, 'THE JOURNEY', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: CSS.mint,
        letterSpacing: 5,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 74, world.name.toUpperCase(), {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#fff6e2',
        stroke: '#171032',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 110, unlocked ? world.tagline : 'Complete the previous world guardian to unlock this tower.', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '11px',
        color: 'rgba(255,246,226,0.68)',
        align: 'center',
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_WIDTH / 2, 140, `${worldCompleted(save, this.worldIndex)}/${LEVELS_PER_WORLD} CLEARED  ·  ${worldStars(save, this.worldIndex)}/150 STARS  ·  ${formatScore(totalStars(save))} TOTAL`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: CSS.gold,
        letterSpacing: 1,
      })
      .setOrigin(0.5)
    addStars(this, GAME_WIDTH / 2, 166, Math.min(3, Math.floor(worldStars(save, this.worldIndex) / 50)), 15, 19)

    new UiButton(this, {
      x: 60,
      y: 202,
      width: 52,
      height: 38,
      label: '‹',
      small: true,
      color: 0x77d7ff,
      disabled: this.worldIndex <= 0,
      onClick: () => this.changeWorld(-1),
    })
    this.add
      .text(GAME_WIDTH / 2, 202, `WORLD ${String(this.worldIndex + 1).padStart(2, '0')} / 10`, {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.7)',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
    new UiButton(this, {
      x: GAME_WIDTH - 60,
      y: 202,
      width: 52,
      height: 38,
      label: '›',
      small: true,
      color: 0x77d7ff,
      disabled: this.worldIndex >= WORLD_COUNT - 1,
      onClick: () => this.changeWorld(1),
    })

    this.drawLevelGrid(save, unlocked)

    const continueId = firstIncompleteLevel(save, this.worldIndex)
    new UiButton(this, {
      x: GAME_WIDTH / 2,
      y: 928,
      width: 470,
      height: 54,
      label: 'CONTINUE',
      sublabel: unlocked ? `${continueId.toUpperCase()} · ${levelsForWorld(this.worldIndex).find((level) => level.id === continueId)?.name ?? ''}` : 'World locked',
      glyph: '▶',
      color: 0x6ff2c8,
      align: 'left',
      disabled: !unlocked,
      onClick: () => this.startLevel(continueId),
    }).setDepth(30)

    this.add
      .text(GAME_WIDTH / 2, 982, 'TAP ANY UNLOCKED ROOM TO REPLAY IT', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.4)',
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)

    backButton(this, () => {
      audio.sfx('back')
      this.scene.start('Menu')
    }, GAME_HEIGHT - 44).setDepth(30)

    this.input.keyboard?.on('keydown-LEFT', () => this.changeWorld(-1))
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeWorld(1))
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('Menu'))
    this.input.keyboard?.on('keydown-ENTER', () => unlocked && this.startLevel(continueId))
  }

  private drawLevelGrid(save: ReturnType<typeof loadSave>, unlockedWorld: boolean): void {
    const levels = levelsForWorld(this.worldIndex)
    const cols = 5
    const cellW = 110
    const cellH = 52
    const gapX = 10
    const gapY = 8
    const startX = (GAME_WIDTH - (cols * cellW + (cols - 1) * gapX)) / 2
    const startY = 240
    const path = this.add.graphics().setDepth(2)
    path.lineStyle(2, 0xffffff, 0.08)
    levels.forEach((level, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const x = startX + col * (cellW + gapX)
      const y = startY + row * (cellH + gapY)
      if (col < cols - 1) {
        path.beginPath()
        path.moveTo(x + cellW, y + cellH / 2)
        path.lineTo(x + cellW + gapX, y + cellH / 2)
        path.strokePath()
      }
      const nextRow = levels[index + cols]
      if (nextRow) {
        path.beginPath()
        path.moveTo(x + cellW / 2, y + cellH)
        path.lineTo(startX + ((index + cols) % cols) * (cellW + gapX) + cellW / 2, startY + (row + 1) * (cellH + gapY))
        path.strokePath()
      }
      const record = save.levels[level.id]
      const unlocked = unlockedWorld && levelUnlocked(save, level.id)
      const color = level.boss ? 0xffd75e : record?.completed ? 0x6ff2c8 : unlocked ? 0x77d7ff : 0x7b6f99
      const graphics = this.add.graphics().setDepth(6)
      graphics.fillStyle(0x110c22, unlocked ? 0.92 : 0.62)
      graphics.fillRoundedRect(x, y, cellW, cellH, 10)
      graphics.fillStyle(color, unlocked ? 0.12 : 0.04)
      graphics.fillRoundedRect(x, y, cellW, cellH, 10)
      graphics.lineStyle(1.5, color, unlocked ? 0.58 : 0.18)
      graphics.strokeRoundedRect(x, y, cellW, cellH, 10)
      const label = level.boss ? 'BOSS' : String(level.levelNumber)
      this.add
        .text(x + 10, y + 8, label, {
          fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
          fontSize: level.boss ? '12px' : '15px',
          fontStyle: 'bold',
          color: unlocked ? (level.boss ? '#ffd75e' : '#fff6e2') : 'rgba(255,246,226,0.32)',
          letterSpacing: level.boss ? 1.5 : 0,
        })
        .setDepth(7)
      if (record?.completed) {
        this.add
          .text(x + cellW - 9, y + 10, '★'.repeat(record.stars), {
            fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
            fontSize: '10px',
            color: '#ffd75e',
          })
          .setOrigin(1, 0)
          .setDepth(7)
      } else if (!unlocked) {
        this.add.image(x + cellW - 16, y + 16, 'lock').setDisplaySize(14, 16).setAlpha(0.5).setDepth(7)
      }
      if (!level.boss) {
        this.add
          .text(x + cellW - 9, y + cellH - 9, level.name.split(' ').slice(-1)[0], {
            fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
            fontSize: '8px',
            color: 'rgba(255,246,226,0.4)',
          })
          .setOrigin(1, 1)
          .setDepth(7)
      }
      const hit = this.add.rectangle(x + cellW / 2, y + cellH / 2, cellW, cellH, 0xffffff, 0.001)
      hit.setInteractive({ useHandCursor: unlocked })
      hit.on('pointerdown', () => {
        if (!unlocked) {
          audio.sfx('empty')
          return
        }
        this.startLevel(level.id)
      })
      hit.setDepth(8)
    })
  }

  private changeWorld(direction: number): void {
    const next = Phaser.Math.Clamp(this.worldIndex + direction, 0, WORLD_COUNT - 1)
    if (next === this.worldIndex) return
    audio.sfx('click')
    this.scene.restart({ worldIndex: next })
  }

  private startLevel(levelId: string): void {
    audio.unlock()
    audio.sfx('click')
    this.scene.start('Game', { levelId, mode: 'journey' })
  }
}
