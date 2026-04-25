import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

guard CommandLine.arguments.count == 4 else {
    fail("Uso: macos-ocr-preprocess.swift <input> <output> <profile>")
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let profile = CommandLine.arguments[3]
let context = CIContext(options: nil)

guard let image = CIImage(contentsOf: inputURL) else {
    fail("No se pudo leer la imagen.")
}

let filtered: CIImage
switch profile {
case "contrast":
    filtered = image
        .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0,
            kCIInputContrastKey: 1.35,
            kCIInputBrightnessKey: 0.03
        ])
case "sharpen":
    filtered = image
        .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0,
            kCIInputContrastKey: 1.2
        ])
        .applyingFilter("CISharpenLuminance", parameters: [
            kCIInputSharpnessKey: 0.6
        ])
default:
    fail("Perfil no soportado: \(profile)")
}

try FileManager.default.createDirectory(
    at: outputURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
)

guard let cgImage = context.createCGImage(filtered, from: filtered.extent),
      let destination = CGImageDestinationCreateWithURL(
        outputURL as CFURL,
        UTType.jpeg.identifier as CFString,
        1,
        nil
      ) else {
    fail("No se pudo preparar la exportacion JPEG.")
}

let properties = [
    kCGImageDestinationLossyCompressionQuality: 0.94
] as CFDictionary
CGImageDestinationAddImage(destination, cgImage, properties)

if !CGImageDestinationFinalize(destination) {
    fail("No se pudo exportar la imagen.")
}
