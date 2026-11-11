import Phaser from 'phaser'
import { BLASTER_COLORS } from '../config'
import { WORLD_COUNT, worldAt } from '../data/worlds'
import { mulberry32, range } from '../core/rng'

function css(color: number, alpha = 1): string {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): void {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, width, height)
  if (!texture) return
  const ctx = texture.context
  ctx.clearRect(0, 0, width, height)
  draw(ctx, width, height)
  texture.refresh()
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function starPath(ctx: CanvasRenderingContext2D, radius: number, inner: number, points = 5): void {
  ctx.beginPath()
  for (let index = 0; index < points * 2; index += 1) {
    const angle = (Math.PI * index) / points - Math.PI / 2
    const r = index % 2 === 0 ? radius : inner
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawPipParts(scene: Phaser.Scene): void {
  makeCanvas(scene, 'pip-body', 66, 68, (ctx) => {
    ctx.translate(33, 34)
    ctx.fillStyle = '#ffffff'
    rounded(ctx, -26, -26, 52, 58, 20)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    rounded(ctx, -26, 6, 52, 26, 14)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    rounded(ctx, -18, -20, 16, 30, 8)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    rounded(ctx, -6, -6, 12, 10, 4)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-head', 78, 66, (ctx) => {
    ctx.translate(39, 33)
    ctx.fillStyle = '#ffe6c7'
    ctx.beginPath()
    ctx.arc(0, 2, 25, 0, Math.PI * 2)
    ctx.fill()
    // hood
    ctx.fillStyle = '#3fc4a8'
    ctx.beginPath()
    ctx.arc(0, -2, 27, Math.PI * 0.98, Math.PI * 2.02)
    ctx.fill()
    ctx.fillStyle = '#2da58d'
    rounded(ctx, -27, -12, 9, 24, 4)
    ctx.fill()
    rounded(ctx, 18, -12, 9, 24, 4)
    ctx.fill()
    // goggles
    ctx.strokeStyle = '#ff9f45'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-26, -6)
    ctx.lineTo(26, -6)
    ctx.stroke()
    ctx.fillStyle = '#8ff0ff'
    rounded(ctx, -21, -10, 17, 13, 5)
    ctx.fill()
    rounded(ctx, 4, -10, 17, 13, 5)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    rounded(ctx, -21, -10, 17, 13, 5)
    ctx.stroke()
    rounded(ctx, 4, -10, 17, 13, 5)
    ctx.stroke()
    // eyes + smile
    ctx.fillStyle = '#24303b'
    ctx.beginPath()
    ctx.arc(-8, 8, 3, 0, Math.PI * 2)
    ctx.arc(10, 8, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#b9603f'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(1, 11, 7, 0.2, Math.PI - 0.2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,122,107,0.35)'
    ctx.beginPath()
    ctx.arc(-16, 12, 5, 0, Math.PI * 2)
    ctx.arc(18, 12, 5, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-scarf', 74, 32, (ctx) => {
    ctx.translate(37, 16)
    ctx.fillStyle = '#ff8f52'
    rounded(ctx, -24, -8, 48, 16, 8)
    ctx.fill()
    ctx.fillStyle = '#e2723a'
    ctx.beginPath()
    ctx.moveTo(14, 0)
    ctx.lineTo(34, 12)
    ctx.lineTo(24, 14)
    ctx.lineTo(10, 5)
    ctx.closePath()
    ctx.fill()
  })
  makeCanvas(scene, 'pip-arm', 26, 40, (ctx) => {
    ctx.translate(13, 20)
    ctx.fillStyle = '#ffffff'
    rounded(ctx, -9, -18, 18, 36, 8)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    rounded(ctx, -9, 6, 18, 12, 6)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-blaster', 54, 30, (ctx) => {
    ctx.translate(27, 15)
    ctx.fillStyle = '#b9793f'
    rounded(ctx, -20, -9, 38, 18, 8)
    ctx.fill()
    ctx.fillStyle = '#f0b96b'
    rounded(ctx, -14, -7, 26, 6, 3)
    ctx.fill()
    ctx.fillStyle = '#6b4630'
    rounded(ctx, -8, 4, 12, 12, 5)
    ctx.fill()
    ctx.fillStyle = '#59d6ff'
    rounded(ctx, 14, -6, 10, 12, 4)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    rounded(ctx, 16, -3, 5, 6, 2)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-leg', 22, 38, (ctx) => {
    ctx.translate(11, 19)
    ctx.fillStyle = '#3b6ea8'
    rounded(ctx, -8, -17, 16, 34, 7)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-boot', 36, 20, (ctx) => {
    ctx.translate(18, 10)
    ctx.fillStyle = '#8a5b35'
    rounded(ctx, -15, -6, 30, 14, 6)
    ctx.fill()
    ctx.fillStyle = '#f0b96b'
    rounded(ctx, -15, 2, 30, 6, 3)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-shadow', 90, 26, (ctx) => {
    const gradient = ctx.createRadialGradient(45, 13, 0, 45, 13, 44)
    gradient.addColorStop(0, 'rgba(10,12,30,0.42)')
    gradient.addColorStop(1, 'rgba(10,12,30,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(45, 13, 44, 12, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'pip-blink', 44, 12, (ctx) => {
    ctx.fillStyle = '#24303b'
    rounded(ctx, 0, 4, 18, 4, 2)
    ctx.fill()
    rounded(ctx, 26, 4, 18, 4, 2)
    ctx.fill()
  })
}

function drawEnemies(scene: Phaser.Scene): void {
  makeCanvas(scene, 'enemy-wobblebot', 76, 76, (ctx) => {
    ctx.translate(38, 40)
    ctx.fillStyle = 'rgba(10,12,30,0.25)'
    ctx.beginPath()
    ctx.ellipse(0, 30, 24, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#8b6a4b'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-12, 14)
    ctx.lineTo(-16, 28)
    ctx.moveTo(12, 14)
    ctx.lineTo(16, 28)
    ctx.stroke()
    ctx.fillStyle = '#ffb454'
    rounded(ctx, -24, -18, 48, 38, 15)
    ctx.fill()
    ctx.fillStyle = '#e08a2f'
    rounded(ctx, -18, 2, 36, 16, 8)
    ctx.fill()
    ctx.fillStyle = '#fff6e2'
    ctx.beginPath()
    ctx.arc(-9, -6, 8, 0, Math.PI * 2)
    ctx.arc(9, -6, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#24303b'
    ctx.beginPath()
    ctx.arc(-7, -5, 3.5, 0, Math.PI * 2)
    ctx.arc(11, -5, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#b9532f'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(1, 5, 7, 0.2, Math.PI - 0.2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, -18, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ff7a6b'
    ctx.beginPath()
    ctx.arc(0, -28, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'enemy-hopper', 74, 80, (ctx) => {
    ctx.translate(37, 40)
    ctx.fillStyle = 'rgba(10,12,30,0.25)'
    ctx.beginPath()
    ctx.ellipse(0, 33, 22, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#6f5bd6'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    for (let index = -1; index <= 1; index += 1) {
      ctx.beginPath()
      ctx.moveTo(index * 10, 16)
      ctx.quadraticCurveTo(index * 22, 26, index * 18, 33)
      ctx.stroke()
    }
    ctx.fillStyle = '#8ff0a6'
    rounded(ctx, -23, -20, 46, 38, 16)
    ctx.fill()
    ctx.fillStyle = '#5cc47a'
    rounded(ctx, -23, 4, 46, 14, 7)
    ctx.fill()
    ctx.fillStyle = '#fff6e2'
    ctx.beginPath()
    ctx.arc(-9, -6, 8, 0, Math.PI * 2)
    ctx.arc(9, -6, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#24303b'
    ctx.beginPath()
    ctx.arc(-7, -5, 3.5, 0, Math.PI * 2)
    ctx.arc(11, -5, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.arc(-13, -16, 5, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'enemy-shieldbug', 88, 76, (ctx) => {
    ctx.translate(44, 40)
    ctx.fillStyle = 'rgba(10,12,30,0.25)'
    ctx.beginPath()
    ctx.ellipse(0, 29, 27, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#59c6ff'
    rounded(ctx, -26, -16, 52, 40, 18)
    ctx.fill()
    ctx.fillStyle = '#2e93c9'
    rounded(ctx, -20, 4, 40, 16, 8)
    ctx.fill()
    ctx.fillStyle = '#fff6e2'
    ctx.beginPath()
    ctx.arc(-9, -4, 7, 0, Math.PI * 2)
    ctx.arc(9, -4, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#24303b'
    ctx.beginPath()
    ctx.arc(-7, -3, 3, 0, Math.PI * 2)
    ctx.arc(11, -3, 3, 0, Math.PI * 2)
    ctx.fill()
    // directional shell shield
    ctx.fillStyle = 'rgba(255,224,90,0.92)'
    ctx.beginPath()
    ctx.moveTo(22, -26)
    ctx.quadraticCurveTo(44, -8, 30, 20)
    ctx.quadraticCurveTo(24, -2, 22, -26)
    ctx.fill()
    ctx.strokeStyle = '#fff6e2'
    ctx.lineWidth = 2
    ctx.stroke()
  })
  makeCanvas(scene, 'enemy-drone', 84, 66, (ctx) => {
    ctx.translate(42, 33)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-26, -10)
    ctx.lineTo(-8, -2)
    ctx.moveTo(26, -10)
    ctx.lineTo(8, -2)
    ctx.stroke()
    ctx.fillStyle = '#b79cff'
    rounded(ctx, -24, -12, 48, 30, 13)
    ctx.fill()
    ctx.fillStyle = '#593fa8'
    rounded(ctx, -16, 10, 32, 12, 6)
    ctx.fill()
    ctx.fillStyle = '#fff6e2'
    ctx.beginPath()
    ctx.arc(-9, 0, 7, 0, Math.PI * 2)
    ctx.arc(9, 0, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff5f7a'
    ctx.beginPath()
    ctx.arc(-9, 0, 3.5, 0, Math.PI * 2)
    ctx.arc(9, 0, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.arc(-6, -18, 5, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawItems(scene: Phaser.Scene): void {
  const gemColors = [
    ['#59d6ff', '#1d73a8'],
    ['#ff8fc7', '#b1407a'],
    ['#ffe05a', '#b58a1d'],
  ]
  gemColors.forEach(([bright, dark], variant) => {
    makeCanvas(scene, `gem-${variant}`, 44, 44, (ctx) => {
      glow(ctx, 22, 22, 21, css(Number.parseInt(bright.slice(1), 16), 0.5))
      ctx.translate(22, 22)
      ctx.fillStyle = dark
      ctx.beginPath()
      ctx.moveTo(0, -17)
      ctx.lineTo(15, -3)
      ctx.lineTo(9, 16)
      ctx.lineTo(-9, 16)
      ctx.lineTo(-15, -3)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = bright
      ctx.beginPath()
      ctx.moveTo(0, -13)
      ctx.lineTo(11, -2)
      ctx.lineTo(5, 12)
      ctx.lineTo(-5, 12)
      ctx.lineTo(-11, -2)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.beginPath()
      ctx.moveTo(-2, -10)
      ctx.lineTo(5, -3)
      ctx.lineTo(-3, 4)
      ctx.lineTo(-6, -2)
      ctx.closePath()
      ctx.fill()
    })
  })
  makeCanvas(scene, 'gem-optional', 48, 48, (ctx) => {
    glow(ctx, 24, 24, 23, 'rgba(255,255,255,0.55)')
    ctx.translate(24, 24)
    ctx.fillStyle = '#b79cff'
    starPath(ctx, 19, 8)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-5, -5, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'heart-full', 38, 34, (ctx) => {
    ctx.translate(19, 17)
    glow(ctx, 0, 0, 17, 'rgba(255,95,122,0.35)')
    ctx.fillStyle = '#ff5f7a'
    ctx.beginPath()
    ctx.moveTo(0, 13)
    ctx.bezierCurveTo(-20, 0, -17, -13, -7, -13)
    ctx.bezierCurveTo(-2, -13, 0, -9, 0, -6)
    ctx.bezierCurveTo(0, -9, 2, -13, 7, -13)
    ctx.bezierCurveTo(17, -13, 20, 0, 0, 13)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.beginPath()
    ctx.ellipse(-6, -6, 4, 3, -0.5, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'heart-empty', 38, 34, (ctx) => {
    ctx.translate(19, 17)
    ctx.strokeStyle = 'rgba(255,246,226,0.34)'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(0, 13)
    ctx.bezierCurveTo(-20, 0, -17, -13, -7, -13)
    ctx.bezierCurveTo(-2, -13, 0, -9, 0, -6)
    ctx.bezierCurveTo(0, -9, 2, -13, 7, -13)
    ctx.bezierCurveTo(17, -13, 20, 0, 0, 13)
    ctx.stroke()
  })
  makeCanvas(scene, 'switch-base', 58, 58, (ctx) => {
    ctx.translate(29, 29)
    ctx.fillStyle = '#2b2144'
    rounded(ctx, -23, -23, 46, 46, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    rounded(ctx, -23, -23, 46, 46, 14)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    rounded(ctx, -16, -16, 32, 32, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.38)'
    ctx.lineWidth = 2
    for (let angle = 0; angle < 4; angle += 1) {
      ctx.save()
      ctx.rotate((angle * Math.PI) / 2)
      ctx.beginPath()
      ctx.moveTo(0, -27)
      ctx.lineTo(0, -19)
      ctx.stroke()
      ctx.restore()
    }
  })
  makeCanvas(scene, 'switch-core', 34, 34, (ctx) => {
    glow(ctx, 17, 17, 16, 'rgba(255,255,255,0.85)')
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(17, 17, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(17, 17, 13, 0, Math.PI * 2)
    ctx.stroke()
  })
  makeCanvas(scene, 'mirror-a', 52, 52, (ctx) => {
    ctx.translate(26, 26)
    glow(ctx, 0, 0, 24, 'rgba(143,245,255,0.45)')
    ctx.save()
    ctx.rotate(-Math.PI / 4)
    ctx.fillStyle = '#d8fbff'
    rounded(ctx, -20, -5, 40, 10, 5)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    rounded(ctx, -20, -5, 40, 4, 2)
    ctx.fill()
    ctx.strokeStyle = '#5ec8e8'
    ctx.lineWidth = 2
    rounded(ctx, -20, -5, 40, 10, 5)
    ctx.stroke()
    ctx.restore()
  })
  makeCanvas(scene, 'mirror-b', 52, 52, (ctx) => {
    ctx.translate(26, 26)
    glow(ctx, 0, 0, 24, 'rgba(143,245,255,0.45)')
    ctx.save()
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = '#d8fbff'
    rounded(ctx, -20, -5, 40, 10, 5)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    rounded(ctx, -20, -5, 40, 4, 2)
    ctx.fill()
    ctx.strokeStyle = '#5ec8e8'
    ctx.lineWidth = 2
    rounded(ctx, -20, -5, 40, 10, 5)
    ctx.stroke()
    ctx.restore()
  })
  makeCanvas(scene, 'crate', 56, 56, (ctx) => {
    ctx.translate(28, 28)
    ctx.fillStyle = '#a86f3c'
    rounded(ctx, -24, -24, 48, 48, 7)
    ctx.fill()
    ctx.strokeStyle = '#6d4423'
    ctx.lineWidth = 4
    rounded(ctx, -20, -20, 40, 40, 5)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-16, -16)
    ctx.lineTo(16, 16)
    ctx.moveTo(16, -16)
    ctx.lineTo(-16, 16)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,224,160,0.55)'
    rounded(ctx, -18, -18, 12, 6, 3)
    ctx.fill()
    ctx.fillStyle = '#b177ff'
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'seed', 46, 54, (ctx) => {
    ctx.translate(23, 27)
    glow(ctx, 0, 0, 22, 'rgba(111,242,138,0.45)')
    ctx.fillStyle = '#3f8a63'
    ctx.beginPath()
    ctx.ellipse(0, 6, 13, 17, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6ff28a'
    ctx.beginPath()
    ctx.ellipse(-3, 3, 7, 10, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#8fe6a0'
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.quadraticCurveTo(20, -22, 12, -27)
    ctx.quadraticCurveTo(4, -20, 0, -8)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.beginPath()
    ctx.arc(-5, 1, 3, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'portal', 150, 200, (ctx) => {
    ctx.translate(75, 100)
    glow(ctx, 0, 0, 74, 'rgba(111,242,200,0.4)')
    for (let ring = 0; ring < 4; ring += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + ring * 0.08})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(0, 0, 44 - ring * 7, 74 - ring * 10, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    const gradient = ctx.createLinearGradient(0, -70, 0, 70)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.5, 'rgba(111,242,200,0.7)')
    gradient.addColorStop(1, 'rgba(89,214,255,0.15)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(0, 0, 36, 66, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.arc(0, -8, 7, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'boss', 300, 300, (ctx) => {
    ctx.translate(150, 150)
    glow(ctx, 0, 0, 140, 'rgba(255,255,255,0.16)')
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 4
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath()
      ctx.arc(0, 0, 76 + ring * 22, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = '#2a2144'
    rounded(ctx, -74, -56, 148, 118, 32)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 4
    rounded(ctx, -74, -56, 148, 118, 32)
    ctx.stroke()
    ctx.fillStyle = '#4b3d6e'
    rounded(ctx, -52, -34, 104, 72, 24)
    ctx.fill()
    ctx.fillStyle = '#ffd75e'
    ctx.beginPath()
    ctx.arc(-24, 0, 15, 0, Math.PI * 2)
    ctx.arc(24, 0, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#24303b'
    ctx.beginPath()
    ctx.arc(-22, -2, 5, 0, Math.PI * 2)
    ctx.arc(26, -2, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 74, 46, 0.2, Math.PI - 0.2)
    ctx.stroke()
    ctx.fillStyle = '#ffd75e'
    for (let index = 0; index < 8; index += 1) {
      ctx.save()
      ctx.rotate((index / 8) * Math.PI * 2)
      rounded(ctx, 84, -7, 26, 14, 6)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = '#ffd75e'
    ctx.beginPath()
    ctx.arc(0, -74, 8, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawParticles(scene: Phaser.Scene): void {
  makeCanvas(scene, 'fx-dot', 10, 10, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(5, 5, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'fx-spark', 18, 18, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(9, 0)
    ctx.lineTo(11, 7)
    ctx.lineTo(18, 9)
    ctx.lineTo(11, 11)
    ctx.lineTo(9, 18)
    ctx.lineTo(7, 11)
    ctx.lineTo(0, 9)
    ctx.lineTo(7, 7)
    ctx.closePath()
    ctx.fill()
  })
  makeCanvas(scene, 'fx-petal', 16, 16, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(8, 8, 7, 4, -0.6, 0, Math.PI * 2)
    ctx.fill()
  })
  makeCanvas(scene, 'fx-star', 26, 26, (ctx) => {
    ctx.translate(13, 13)
    ctx.fillStyle = '#ffffff'
    starPath(ctx, 12, 5)
    ctx.fill()
  })
}

function drawBackdrop(scene: Phaser.Scene, worldIndex: number): void {
  makeCanvas(scene, `bg-${worldIndex}`, 360, 640, (ctx, width, height) => {
    const world = worldAt(worldIndex)
    const palette = world.palette
    const random = mulberry32(4200 + worldIndex * 733)
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, palette.skyTop)
    gradient.addColorStop(0.58, palette.skyBottom)
    gradient.addColorStop(1, palette.ink)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    glow(ctx, width * 0.74, height * 0.16, width * 0.3, 'rgba(255,255,255,0.18)')

    // distant towers / plant silhouettes
    for (let layer = 0; layer < 3; layer += 1) {
      const base = height * (0.42 + layer * 0.08)
      ctx.fillStyle = layer === 0 ? css(Number.parseInt(palette.horizon.slice(1), 16), 0.55) : css(Number.parseInt(palette.platform.slice(1), 16), 0.22 + layer * 0.14)
      for (let index = 0; index < 10 + layer * 4; index += 1) {
        const w = range(random, 16, 56)
        const h = range(random, 40, 160) * (1 + layer * 0.2)
        const x = range(random, -16, width + 16)
        ctx.fillRect(x, base - h, w, h + 100)
      }
    }

    // world-specific furniture
    if (worldIndex === 1 || worldIndex === 3 || worldIndex === 9) {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 3
      for (let index = 0; index < 6; index += 1) {
        const x = range(random, 20, width - 20)
        const y = range(random, 40, height * 0.7)
        const r = range(random, 18, 52)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.stroke()
        for (let tooth = 0; tooth < 8; tooth += 1) {
          const angle = (tooth / 8) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r)
          ctx.lineTo(x + Math.cos(angle) * (r + 7), y + Math.sin(angle) * (r + 7))
          ctx.stroke()
        }
      }
    }
    if (worldIndex === 2 || worldIndex === 7) {
      for (let index = 0; index < 16; index += 1) {
        const x = range(random, 0, width)
        const y = range(random, 0, height)
        const size = range(random, 6, 20)
        ctx.fillStyle = css(Number.parseInt(index % 2 === 0 ? palette.accent : palette.accentTwo, 16), 0.35)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(random() * Math.PI)
        ctx.beginPath()
        ctx.moveTo(0, -size)
        ctx.lineTo(size * 0.5, 0)
        ctx.lineTo(0, size)
        ctx.lineTo(-size * 0.5, 0)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
    }
    if (worldIndex === 4) {
      for (let index = 0; index < 10; index += 1) {
        const x = range(random, 0, width)
        const y = range(random, 20, height * 0.75)
        ctx.strokeStyle = css(Number.parseInt(palette.accent, 16), 0.28)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x + 18, y + 26, x + 4, y + 52)
        ctx.stroke()
        ctx.fillStyle = css(Number.parseInt(palette.accentTwo, 16), 0.35)
        ctx.beginPath()
        ctx.arc(x + 4, y + 54, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (worldIndex === 8) {
      for (let index = 0; index < 120; index += 1) {
        ctx.fillStyle = css(0xffffff, range(random, 0.15, 0.7))
        ctx.beginPath()
        ctx.arc(range(random, 0, width), range(random, 0, height * 0.8), range(random, 0.6, 1.9), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // soft foreground mist
    const mist = ctx.createLinearGradient(0, height * 0.5, 0, height)
    mist.addColorStop(0, 'rgba(0,0,0,0)')
    mist.addColorStop(1, css(Number.parseInt(palette.ink.slice(1), 16), 0.72))
    ctx.fillStyle = mist
    ctx.fillRect(0, height * 0.45, width, height * 0.55)

    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1)
  })
}

export function ensureCoreTextures(scene: Phaser.Scene): void {
  drawPipParts(scene)
  drawEnemies(scene)
  drawItems(scene)
  drawParticles(scene)
  for (let world = 0; world < WORLD_COUNT; world += 1) drawBackdrop(scene, world)
  for (const [mode, color] of Object.entries(BLASTER_COLORS)) {
    makeCanvas(scene, `shot-${mode}`, 34, 34, (ctx) => {
      ctx.translate(17, 17)
      glow(ctx, 0, 0, 16, css(color, 0.75))
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, 0, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = css(color, 0.95)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 11, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = css(color, 0.9)
      ctx.beginPath()
      ctx.ellipse(-8, 0, 6, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  makeCanvas(scene, 'star-full', 40, 40, (ctx) => {
    ctx.translate(20, 20)
    ctx.fillStyle = '#ffd75e'
    starPath(ctx, 17, 7)
    ctx.fill()
    ctx.strokeStyle = '#fff6e2'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })
  makeCanvas(scene, 'star-empty', 40, 40, (ctx) => {
    ctx.translate(20, 20)
    ctx.strokeStyle = 'rgba(255,246,226,0.36)'
    ctx.lineWidth = 2
    starPath(ctx, 17, 7)
    ctx.stroke()
  })
  makeCanvas(scene, 'lock', 30, 34, (ctx) => {
    ctx.translate(15, 17)
    ctx.strokeStyle = 'rgba(255,246,226,0.5)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, -6, 8, Math.PI, 0)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,246,226,0.5)'
    rounded(ctx, -10, -3, 20, 16, 4)
    ctx.fill()
  })
}
