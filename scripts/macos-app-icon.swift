import AppKit
import Foundation

guard CommandLine.arguments.count >= 2 else {
  fputs("Uso: swift macos-app-icon.swift /ruta/salida.png\n", stderr)
  exit(1)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let canvasSize = NSSize(width: 1024, height: 1024)
let image = NSImage(size: canvasSize)

image.lockFocus()

let canvas = NSRect(origin: .zero, size: canvasSize)
let bgRect = canvas.insetBy(dx: 74, dy: 74)
let bgPath = NSBezierPath(roundedRect: bgRect, xRadius: 230, yRadius: 230)
let bgGradient = NSGradient(
  colors: [
    NSColor(calibratedRed: 0.93, green: 0.70, blue: 0.32, alpha: 1),
    NSColor(calibratedRed: 0.79, green: 0.43, blue: 0.17, alpha: 1)
  ]
)!
bgGradient.draw(in: bgPath, angle: -90)

NSColor(calibratedWhite: 1, alpha: 0.18).setStroke()
bgPath.lineWidth = 8
bgPath.stroke()

let shadow = NSShadow()
shadow.shadowBlurRadius = 28
shadow.shadowOffset = NSSize(width: 0, height: -10)
shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.18)
shadow.set()

let leftPage = NSBezierPath()
leftPage.move(to: NSPoint(x: 280, y: 240))
leftPage.curve(to: NSPoint(x: 510, y: 820), controlPoint1: NSPoint(x: 290, y: 430), controlPoint2: NSPoint(x: 370, y: 760))
leftPage.line(to: NSPoint(x: 510, y: 280))
leftPage.curve(to: NSPoint(x: 280, y: 240), controlPoint1: NSPoint(x: 430, y: 250), controlPoint2: NSPoint(x: 330, y: 230))
leftPage.close()

let rightPage = NSBezierPath()
rightPage.move(to: NSPoint(x: 744, y: 240))
rightPage.curve(to: NSPoint(x: 514, y: 820), controlPoint1: NSPoint(x: 734, y: 430), controlPoint2: NSPoint(x: 654, y: 760))
rightPage.line(to: NSPoint(x: 514, y: 280))
rightPage.curve(to: NSPoint(x: 744, y: 240), controlPoint1: NSPoint(x: 594, y: 250), controlPoint2: NSPoint(x: 694, y: 230))
rightPage.close()

NSColor(calibratedRed: 0.99, green: 0.95, blue: 0.88, alpha: 1).setFill()
leftPage.fill()
rightPage.fill()

NSColor(calibratedRed: 0.61, green: 0.32, blue: 0.13, alpha: 0.18).setStroke()
leftPage.lineWidth = 5
rightPage.lineWidth = 5
leftPage.stroke()
rightPage.stroke()

let spine = NSBezierPath()
spine.move(to: NSPoint(x: 512, y: 262))
spine.curve(to: NSPoint(x: 512, y: 804), controlPoint1: NSPoint(x: 530, y: 400), controlPoint2: NSPoint(x: 530, y: 690))
NSColor(calibratedRed: 0.58, green: 0.29, blue: 0.11, alpha: 0.55).setStroke()
spine.lineWidth = 12
spine.lineCapStyle = .round
spine.stroke()

func drawTextLines(on leftSide: Bool) {
  let baseX: CGFloat = leftSide ? 332 : 548
  let inset: CGFloat = leftSide ? 0 : 6
  for index in 0..<6 {
    let y = 694 - CGFloat(index) * 84
    let width = index == 0 ? 126 : 146 - CGFloat(index % 2) * 18
    let line = NSBezierPath(roundedRect: NSRect(x: baseX + inset, y: y, width: width, height: 18), xRadius: 9, yRadius: 9)
    NSColor(calibratedRed: 0.77, green: 0.52, blue: 0.26, alpha: 0.45).setFill()
    line.fill()
  }
}

drawTextLines(on: true)
drawTextLines(on: false)

let bookmark = NSBezierPath()
bookmark.move(to: NSPoint(x: 660, y: 770))
bookmark.line(to: NSPoint(x: 732, y: 770))
bookmark.line(to: NSPoint(x: 732, y: 592))
bookmark.line(to: NSPoint(x: 696, y: 628))
bookmark.line(to: NSPoint(x: 660, y: 592))
bookmark.close()
NSColor(calibratedRed: 0.86, green: 0.33, blue: 0.22, alpha: 1).setFill()
bookmark.fill()

image.unlockFocus()

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
  fputs("No se pudo generar el PNG del icono.\n", stderr)
  exit(1)
}

try pngData.write(to: outputURL)
