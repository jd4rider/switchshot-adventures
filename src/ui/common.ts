import Phaser from 'phaser'
import { COLORS, CSS, DISPLAY_FONT, FONT, GAME_WIDTH } from '../config'

export interface ButtonOptions {
  x: number
  y: number
  width: number
  height: number
  label: string
  sublabel?: string
  glyph?: string
  color?: number
  textColor?: string
  onClick: () => void
  disabled?: boolean
  align?: 'center' | 'left'
  small?: boolean
  /** Set false when a scene-level handler owns the tap (e.g. pause overlays). */
  interactive?: boolean
}

export class UiButton {
  readonly container: Phaser.GameObjects.Container
  private readonly background: Phaser.GameObjects.Graphics
  private readonly labelText: Phaser.GameObjects.Text
  private readonly subText?: Phaser.GameObjects.Text
  private readonly glyphText?: Phaser.GameObjects.Text
  private readonly hit: Phaser.GameObjects.Rectangle
  private readonly options: ButtonOptions
  private hovered = false
  private pressed = false

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    this.options = options
    const color = options.color ?? COLORS.mint
    this.background = scene.add.graphics()
    this.labelText = scene.add
      .text(0, 0, options.label, {
        fontFamily: DISPLAY_FONT,
        fontSize: options.small ? '14px' : '17px',
        fontStyle: 'bold',
        color: options.textColor ?? CSS.cream,
      })
      .setOrigin(options.align === 'left' ? 0 : 0.5, 0.5)
    const children: Phaser.GameObjects.GameObject[] = [this.background, this.labelText]
    if (options.sublabel) {
      this.subText = scene.add
        .text(0, 0, options.sublabel, {
          fontFamily: FONT,
          fontSize: options.small ? '10px' : '11px',
          color: 'rgba(255,246,226,0.66)',
          wordWrap: { width: options.width - 52 },
        })
        .setOrigin(options.align === 'left' ? 0 : 0.5, 0.5)
      children.push(this.subText)
    }
    if (options.glyph) {
      this.glyphText = scene.add
        .text(0, 0, options.glyph, {
          fontFamily: DISPLAY_FONT,
          fontSize: options.small ? '18px' : '22px',
          fontStyle: 'bold',
          color: CSS.white,
        })
        .setOrigin(0.5)
      children.push(this.glyphText)
    }
    this.hit = scene.add.rectangle(0, 0, options.width, options.height, 0xffffff, 0.001)
    if (options.interactive !== false) this.hit.setInteractive({ useHandCursor: true })
    children.push(this.hit)
    this.container = scene.add.container(options.x, options.y, children)
    this.container.setSize(options.width, options.height)
    this.paint(color)
    this.layout()
    this.hit.on('pointerover', () => {
      this.hovered = true
      this.paint(color)
    })
    this.hit.on('pointerout', () => {
      this.hovered = false
      this.pressed = false
      this.paint(color)
    })
    this.hit.on('pointerdown', () => {
      if (options.disabled) return
      this.pressed = true
      this.paint(color)
      this.hit.setScale(0.985)
      options.onClick()
    })
    this.hit.on('pointerup', () => {
      this.pressed = false
      this.hit.setScale(1)
      this.paint(color)
    })
    if (options.disabled) this.container.setAlpha(0.42)
  }

  private paint(color: number): void {
    const { width, height, align, small } = this.options
    const g = this.background
    const x = -width / 2
    const y = -height / 2
    g.clear()
    g.fillGradientStyle(
      color,
      color,
      0x1b1335,
      0x1b1335,
      this.pressed ? 0.34 : this.hovered ? 0.26 : 0.17,
      this.pressed ? 0.34 : this.hovered ? 0.26 : 0.17,
      0.86,
      0.86,
    )
    g.fillRoundedRect(x, y, width, height, small ? 11 : 14)
    g.lineStyle(1.5, color, this.hovered ? 0.9 : 0.52)
    g.strokeRoundedRect(x, y, width, height, small ? 11 : 14)
    g.lineStyle(1, 0xffffff, 0.1)
    g.beginPath()
    g.moveTo(x + 12, y + 8)
    g.lineTo(x + width - 12, y + 8)
    g.strokePath()
    if (align === 'left') {
      this.labelText.setPosition(-width / 2 + (this.glyphText ? 54 : 16), this.subText ? -9 : 0)
      this.subText?.setPosition(-width / 2 + (this.glyphText ? 54 : 16), 12)
      this.glyphText?.setPosition(-width / 2 + 28, 0)
    } else {
      this.labelText.setPosition(0, this.subText ? -8 : 0)
      this.subText?.setPosition(0, 15)
      this.glyphText?.setPosition(-width / 2 + 27, 0)
    }
  }

  private layout(): void {
    const { width, height, glyph, align } = this.options
    if (glyph && align === 'center') this.labelText.setX(0)
    this.labelText.setWordWrapWidth(width - (glyph ? 64 : 28))
    this.hit.setPosition(0, 0)
    this.hit.setSize(width, height)
    this.container.setSize(width, height)
  }

  setLabel(label: string): void {
    this.labelText.setText(label)
  }

  setEnabled(enabled: boolean): void {
    this.hit.input!.enabled = enabled
    this.container.setAlpha(enabled ? 1 : 0.42)
  }

  setDepth(depth: number): this {
    this.container.setDepth(depth)
    return this
  }
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number = COLORS.mint,
  alpha = 0.9,
  depth = 10,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth)
  g.fillStyle(0x0f0b22, alpha)
  g.fillRoundedRect(x, y, width, height, 18)
  g.fillGradientStyle(color, color, 0x1b1335, 0x1b1335, 0.07, 0.07, 0.2, 0.2)
  g.fillRoundedRect(x, y, width, height, 18)
  g.lineStyle(1.5, color, 0.42)
  g.strokeRoundedRect(x, y, width, height, 18)
  return g
}

export function pageTitle(scene: Phaser.Scene, eyebrow: string, title: string, subtitle?: string): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(20)
  const eyebrowText = scene.add
    .text(GAME_WIDTH / 2, 42, eyebrow.toUpperCase(), {
      fontFamily: FONT,
      fontSize: '10px',
      fontStyle: 'bold',
      color: CSS.mint,
      letterSpacing: 4,
    })
    .setOrigin(0.5)
  const titleText = scene.add
    .text(GAME_WIDTH / 2, 62, title, {
      fontFamily: DISPLAY_FONT,
      fontSize: '30px',
      fontStyle: 'bold',
      color: CSS.cream,
    })
    .setOrigin(0.5)
  container.add([eyebrowText, titleText])
  if (subtitle) {
    container.add(
      scene.add
        .text(GAME_WIDTH / 2, 98, subtitle, {
          fontFamily: FONT,
          fontSize: '11px',
          color: 'rgba(255,246,226,0.62)',
          align: 'center',
          wordWrap: { width: 520 },
        })
        .setOrigin(0.5, 0),
    )
  }
  return container
}

export function addStars(scene: Phaser.Scene, x: number, y: number, stars: number, size = 20, gap = 23): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  for (let index = 0; index < 3; index += 1) {
    const image = scene.add.image((index - 1) * gap, 0, index < stars ? 'star-full' : 'star-empty').setDisplaySize(size, size)
    container.add(image)
  }
  return container
}

export function iconButton(scene: Phaser.Scene, x: number, y: number, glyph: string, onClick: () => void, label = ''): Phaser.GameObjects.Container {
  const g = scene.add.graphics()
  g.fillStyle(0x0d0920, 0.84)
  g.fillCircle(0, 0, 20)
  g.lineStyle(1.5, COLORS.mint, 0.4)
  g.strokeCircle(0, 0, 20)
  const text = scene.add.text(0, 0, glyph, { fontFamily: DISPLAY_FONT, fontSize: '18px', color: CSS.cream }).setOrigin(0.5)
  const hit = scene.add.circle(0, 0, 25, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
  hit.on('pointerdown', onClick)
  const container = scene.add.container(x, y, [g, text, hit])
  container.setSize(50, 50)
  if (label) container.setName(label)
  return container
}

export function backButton(scene: Phaser.Scene, onClick: () => void, y = 1210): UiButton {
  return new UiButton(scene, {
    x: 92,
    y,
    width: 88,
    height: 40,
    label: 'BACK',
    small: true,
    glyph: '‹',
    color: COLORS.muted,
    onClick,
  })
}

export function formatMs(ms: number): string {
  if (!ms) return '—'
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
}

export function formatScore(score: number): string {
  return score.toLocaleString('en-GB')
}
