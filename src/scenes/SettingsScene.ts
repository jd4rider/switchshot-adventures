import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '../config'
import { audio } from '../core/audio'
import { loadSave, saveSettings } from '../core/save'
import type { GameplaySettings } from '../types'
import { Backdrop } from '../world/Backdrop'
import { UiButton, backButton, pageTitle } from '../ui/common'

interface SettingsData {
  returnTo?: string
  gameData?: unknown
}

export class SettingsScene extends Phaser.Scene {
  private settings!: GameplaySettings
  private returnTo = 'Menu'
  private gameData: unknown
  private labels = new Map<string, Phaser.GameObjects.Text>()

  constructor() {
    super('Settings')
  }

  init(data: SettingsData): void {
    this.returnTo = data.returnTo ?? 'Menu'
    this.gameData = data.gameData
    this.settings = loadSave().settings
  }

  create(): void {
    audio.setMood('menu')
    new Backdrop(this, 8, this.settings.reducedMotion)
    pageTitle(this, 'Switchshot Adventures', 'Settings', this.returnTo === 'Game' ? 'Changes restart the room from its checkpoint.' : 'Sound, controls and comfort.')

    const rows: Array<[string, string, () => void]> = [
      ['CONTROL SCHEME', this.settings.controlScheme === 'glide' ? 'THUMB GLIDE' : 'CLASSIC BUTTONS', () => this.toggleScheme()],
      ['LEFT-HANDED PAD', this.settings.leftHanded ? 'ON' : 'OFF', () => this.toggle('leftHanded')],
      ['AIM ASSIST', this.settings.aimAssist ? 'ON' : 'OFF', () => this.toggle('aimAssist')],
      ['REDUCED MOTION', this.settings.reducedMotion ? 'ON' : 'OFF', () => this.toggle('reducedMotion')],
      ['REDUCED FLASH', this.settings.reducedFlash ? 'ON' : 'OFF', () => this.toggle('reducedFlash')],
      ['HIGH CONTRAST UI', this.settings.highContrast ? 'ON' : 'OFF', () => this.toggle('highContrast')],
      ['HAPTICS', this.settings.haptics ? 'ON' : 'OFF', () => this.toggle('haptics')],
    ]

    rows.forEach(([label, value, action], index) => {
      const y = 170 + index * 62
      this.add.text(64, y, label, { fontFamily: '"Avenir Next", sans-serif', fontSize: '11px', fontStyle: 'bold', color: 'rgba(255,246,226,0.84)', letterSpacing: 1 })
      const button = new UiButton(this, {
        x: GAME_WIDTH - 160,
        y: y + 4,
        width: 200,
        height: 40,
        label: value,
        small: true,
        color: 0x6ff2c8,
        onClick: action,
      }).setDepth(30)
      this.labels.set(label, button.container.getAt(1) as Phaser.GameObjects.Text)
    })

    const audioRows: Array<[string, 'masterVolume' | 'musicVolume' | 'sfxVolume']> = [
      ['MASTER VOLUME', 'masterVolume'],
      ['MUSIC VOLUME', 'musicVolume'],
      ['EFFECTS VOLUME', 'sfxVolume'],
    ]
    audioRows.forEach(([label, key], index) => {
      const y = 626 + index * 62
      this.add.text(64, y, label, { fontFamily: '"Avenir Next", sans-serif', fontSize: '11px', fontStyle: 'bold', color: 'rgba(255,246,226,0.84)', letterSpacing: 1 })
      this.add.text(GAME_WIDTH - 160, y, this.volumeText(key), { fontFamily: '"Avenir Next", sans-serif', fontSize: '12px', fontStyle: 'bold', color: CSS.mint })
      new UiButton(this, {
        x: GAME_WIDTH - 280,
        y: y + 4,
        width: 46,
        height: 38,
        label: '−',
        small: true,
        color: 0x77d7ff,
        onClick: () => this.changeVolume(key, -0.1, label),
      }).setDepth(30)
      new UiButton(this, {
        x: GAME_WIDTH - 228,
        y: y + 4,
        width: 46,
        height: 38,
        label: '+',
        small: true,
        color: 0x77d7ff,
        onClick: () => this.changeVolume(key, 0.1, label),
      }).setDepth(30)
    })

    this.add
      .text(GAME_WIDTH / 2, 834, `TOUCH SCALE · ${Math.round(this.settings.touchScale * 100)}%`, {
        fontFamily: '"Avenir Next", sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.6)',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
    new UiButton(this, {
      x: GAME_WIDTH / 2 - 100,
      y: 876,
      width: 80,
      height: 40,
      label: 'SMALLER',
      small: true,
      color: 0x6ff2c8,
      onClick: () => this.changeScale(-0.1),
    }).setDepth(30)
    new UiButton(this, {
      x: GAME_WIDTH / 2 + 100,
      y: 876,
      width: 80,
      height: 40,
      label: 'LARGER',
      small: true,
      color: 0x6ff2c8,
      onClick: () => this.changeScale(0.1),
    }).setDepth(30)

    this.add
      .text(GAME_WIDTH / 2, 940, 'Aim assist snaps taps within 42 screen pixels of a switch or mirror.\nShots still travel through the world and can be blocked by walls.', {
        fontFamily: '"Avenir Next", sans-serif',
        fontSize: '9px',
        color: 'rgba(255,246,226,0.45)',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)

    backButton(this, () => this.goBack(), GAME_HEIGHT - 48).setDepth(30)
    this.input.keyboard?.on('keydown-ESC', () => this.goBack())
  }

  private toggle(key: 'leftHanded' | 'aimAssist' | 'reducedMotion' | 'reducedFlash' | 'highContrast' | 'haptics'): void {
    this.settings = { ...this.settings, [key]: !this.settings[key] }
    this.persist()
    this.scene.restart({ returnTo: this.returnTo, gameData: this.gameData })
  }

  private toggleScheme(): void {
    this.settings = { ...this.settings, controlScheme: this.settings.controlScheme === 'glide' ? 'buttons' : 'glide' }
    this.persist()
    this.scene.restart({ returnTo: this.returnTo, gameData: this.gameData })
  }

  private changeVolume(key: 'masterVolume' | 'musicVolume' | 'sfxVolume', delta: number, label: string): void {
    const next = Phaser.Math.Clamp(this.settings[key] + delta, 0, 1)
    this.settings = { ...this.settings, [key]: Math.round(next * 10) / 10 }
    this.persist()
    const text = this.labels.get(label)
    text?.setText(this.volumeText(key))
    audio.sfx('click')
  }

  private changeScale(delta: number): void {
    this.settings = { ...this.settings, touchScale: Phaser.Math.Clamp(Math.round((this.settings.touchScale + delta) * 10) / 10, 0.75, 1.35) }
    this.persist()
    this.scene.restart({ returnTo: this.returnTo, gameData: this.gameData })
  }

  private volumeText(key: 'masterVolume' | 'musicVolume' | 'sfxVolume'): string {
    return `${Math.round(this.settings[key] * 100)}%`
  }

  private persist(): void {
    saveSettings(this.settings)
    audio.setSettings(this.settings)
  }

  private goBack(): void {
    audio.sfx('back')
    if (this.returnTo === 'Game' && this.gameData) {
      this.scene.start('Game', this.gameData as { levelId?: string; mode?: string })
      return
    }
    this.scene.start('Menu')
  }
}
