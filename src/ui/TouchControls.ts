import Phaser from 'phaser'
import { CSS, GAME_HEIGHT, GAME_WIDTH } from '../config'
import type { GameplaySettings, PlayerIntent, Rect } from '../types'
import { inputAxis } from '../player/movement'

export interface TouchOptions {
  onShoot: (screenX: number, screenY: number) => void
  blockedRects: () => Rect[]
}

interface MovePointer {
  id: number
  startX: number
  startY: number
  x: number
  y: number
  armed: boolean
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Thumb Glide is the default: a drag anywhere in the lower-left pad steers,
 * and a deliberate upward flick jumps. A second finger anywhere else fires.
 * The gesture never steals the movement pointer.
 */
export class TouchControls {
  private readonly scene: Phaser.Scene
  private readonly settings: GameplaySettings
  private readonly options: TouchOptions
  private readonly root: Phaser.GameObjects.Container
  private readonly zone: Phaser.GameObjects.Arc
  private readonly hint: Phaser.GameObjects.Text
  private readonly buttonLeft?: Phaser.GameObjects.Arc
  private readonly buttonRight?: Phaser.GameObjects.Arc
  private readonly buttonJump?: Phaser.GameObjects.Arc
  private readonly zoneCenter: { x: number; y: number }
  private readonly moveRect: Rect
  private movePointer: MovePointer | null = null
  private heldLeft = false
  private heldRight = false
  private heldJump = false
  private jumpPressedFlag = false
  private visible = true
  private axisValue = 0

  constructor(scene: Phaser.Scene, settings: GameplaySettings, options: TouchOptions) {
    this.scene = scene
    this.settings = settings
    this.options = options
    const scale = settings.touchScale
    const mirrored = settings.leftHanded
    this.zoneCenter = { x: mirrored ? GAME_WIDTH - 158 : 158, y: GAME_HEIGHT - 172 }
    const radius = 96 * scale
    this.moveRect = {
      x: this.zoneCenter.x - 150 * scale,
      y: GAME_HEIGHT - 360,
      width: 300 * scale,
      height: 320,
    }

    this.zone = scene.add
      .circle(this.zoneCenter.x, this.zoneCenter.y, radius, 0xffffff, 0.02)
      .setStrokeStyle(2, 0xffffff, 0.13 * Math.max(0.4, settings.touchOpacity))
      .setScrollFactor(0)
      .setDepth(800)
    const inner = scene.add
      .circle(this.zoneCenter.x, this.zoneCenter.y, radius * 0.34, 0xffffff, 0.05)
      .setStrokeStyle(1, 0xffffff, 0.16)
      .setScrollFactor(0)
      .setDepth(800)
    const arrows = scene.add
      .text(this.zoneCenter.x, this.zoneCenter.y, '‹  ›', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '22px',
        color: 'rgba(255,246,226,0.34)',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801)
    this.hint = scene.add
      .text(this.zoneCenter.x, this.zoneCenter.y + radius + 16, 'DRAG TO MOVE · FLICK ↑ TO JUMP', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.42)',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801)

    const shootHint = scene.add
      .text(mirrored ? 150 : GAME_WIDTH - 150, GAME_HEIGHT - 112, 'TAP TO SHOOT', {
        fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: 'rgba(255,246,226,0.4)',
        letterSpacing: 1.6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(801)
    const crosshair = scene.add
      .circle(mirrored ? 150 : GAME_WIDTH - 150, GAME_HEIGHT - 150, 26)
      .setStrokeStyle(1.5, 0x6ff2c8, 0.25)
      .setScrollFactor(0)
      .setDepth(800)

    const children: Phaser.GameObjects.GameObject[] = [this.zone, inner, arrows, this.hint, shootHint, crosshair]

    if (settings.controlScheme === 'buttons') {
      const leftX = mirrored ? GAME_WIDTH - 300 : 100
      const rightX = mirrored ? GAME_WIDTH - 176 : 224
      const jumpX = mirrored ? 104 : GAME_WIDTH - 104
      this.buttonLeft = scene.add.circle(leftX, GAME_HEIGHT - 146, 42, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.22)
      this.buttonRight = scene.add.circle(rightX, GAME_HEIGHT - 146, 42, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.22)
      this.buttonJump = scene.add.circle(jumpX, GAME_HEIGHT - 152, 52, 0x6ff2c8, 0.1).setStrokeStyle(2, 0x6ff2c8, 0.42)
      const leftGlyph = scene.add.text(leftX, GAME_HEIGHT - 146, '‹', { fontFamily: 'sans-serif', fontSize: '34px', color: CSS.cream }).setOrigin(0.5)
      const rightGlyph = scene.add.text(rightX, GAME_HEIGHT - 146, '›', { fontFamily: 'sans-serif', fontSize: '34px', color: CSS.cream }).setOrigin(0.5)
      const jumpGlyph = scene.add.text(jumpX, GAME_HEIGHT - 152, 'JUMP', { fontFamily: '"Avenir Next", sans-serif', fontSize: '12px', fontStyle: 'bold', color: CSS.cream }).setOrigin(0.5)
      children.push(this.buttonLeft, this.buttonRight, this.buttonJump, leftGlyph, rightGlyph, jumpGlyph)
      this.zone.setAlpha(0)
      inner.setAlpha(0)
      arrows.setAlpha(0)
      this.hint.setText('TAP THE ROOM TO SHOOT').setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 234)
    }

    this.root = scene.add.container(0, 0, children).setScrollFactor(0).setDepth(800)
    this.bind()
  }

  private blocked(x: number, y: number): boolean {
    return this.options.blockedRects().some(
      (rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
    )
  }

  private buttonHit(x: number, y: number): 'left' | 'right' | 'jump' | null {
    if (!this.buttonLeft || !this.buttonRight || !this.buttonJump) return null
    const within = (circle: Phaser.GameObjects.Arc, radius: number): boolean => Math.hypot(x - circle.x, y - circle.y) <= radius
    if (within(this.buttonLeft, 56)) return 'left'
    if (within(this.buttonRight, 56)) return 'right'
    if (within(this.buttonJump, 64)) return 'jump'
    return null
  }

  private bind(): void {
    this.scene.input.on('pointerdown', this.onDown, this)
    this.scene.input.on('pointermove', this.onMove, this)
    this.scene.input.on('pointerup', this.onUp, this)
    this.scene.input.on('pointerupoutside', this.onUp, this)
    this.scene.input.on('gameout', this.onUp, this)
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!this.visible) return
    const x = pointer.x
    const y = pointer.y
    if (this.blocked(x, y)) return
    const touch = pointer.wasTouch

    if (this.settings.controlScheme === 'buttons') {
      const hit = this.buttonHit(x, y)
      if (hit === 'left') this.heldLeft = true
      else if (hit === 'right') this.heldRight = true
      else if (hit === 'jump') {
        this.heldJump = true
        this.jumpPressedFlag = true
      } else {
        this.options.onShoot(x, y)
      }
      return
    }

    if (touch && !this.movePointer) {
      const inZone =
        x >= this.moveRect.x && x <= this.moveRect.x + this.moveRect.width && y >= this.moveRect.y && y <= GAME_HEIGHT
      if (inZone) {
        this.movePointer = { id: pointer.id, startX: x, startY: y, x, y, armed: true }
        this.axisValue = 0
        this.zone.setStrokeStyle(2, 0x6ff2c8, 0.36)
        return
      }
    }
    this.options.onShoot(x, y)
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.movePointer || pointer.id !== this.movePointer.id) return
    const move = this.movePointer
    move.x = pointer.x
    move.y = pointer.y
    const range = 92 * this.settings.touchScale
    this.axisValue = inputAxis((move.x - move.startX) / range, 0.1)
    const lift = move.startY - move.y
    if (lift > 52 * this.settings.touchScale && move.armed) {
      move.armed = false
      this.jumpPressedFlag = true
    } else if (lift < 16 && !move.armed) {
      move.armed = true
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (this.movePointer && pointer.id === this.movePointer.id) {
      this.movePointer = null
      this.axisValue = 0
      if (this.settings.controlScheme === 'glide') this.zone.setStrokeStyle(2, 0xffffff, 0.13)
    }
    if (this.settings.controlScheme === 'buttons') {
      this.heldLeft = false
      this.heldRight = false
      this.heldJump = false
    }
  }

  intent(): PlayerIntent {
    const keyboardAxis = 0
    const axis = this.settings.controlScheme === 'buttons'
      ? (this.heldRight ? 1 : 0) - (this.heldLeft ? 1 : 0)
      : this.axisValue
    return {
      axis: axis !== 0 ? axis : keyboardAxis,
      jumpPressed: this.consumeJump(),
      jumpHeld: this.settings.controlScheme === 'buttons' ? this.heldJump : Boolean(this.movePointer && this.movePointer.armed === false),
      down: false,
    }
  }

  consumeJump(): boolean {
    const pressed = this.jumpPressedFlag
    this.jumpPressedFlag = false
    return pressed
  }

  get moveAxis(): number {
    return this.settings.controlScheme === 'buttons'
      ? (this.heldRight ? 1 : 0) - (this.heldLeft ? 1 : 0)
      : this.axisValue
  }

  get jumpHeld(): boolean {
    return this.settings.controlScheme === 'buttons'
      ? this.heldJump
      : Boolean(this.movePointer && this.movePointer.armed === false)
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.root.setVisible(visible)
    if (!visible) {
      this.movePointer = null
      this.axisValue = 0
      this.heldLeft = false
      this.heldRight = false
      this.heldJump = false
      this.jumpPressedFlag = false
    }
  }

  setHint(text: string): void {
    this.hint.setText(text)
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this)
    this.scene.input.off('pointermove', this.onMove, this)
    this.scene.input.off('pointerup', this.onUp, this)
    this.scene.input.off('pointerupoutside', this.onUp, this)
    this.scene.input.off('gameout', this.onUp, this)
    this.root.destroy(true)
  }
}
