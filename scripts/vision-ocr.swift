import Foundation
import ImageIO
import Vision

struct PageInfo: Codable {
    let width: Double
    let height: Double
}

struct OCRLine: Codable {
    let text: String
    let left: Double
    let top: Double
    let width: Double
    let height: Double
    let confidence: Double
}

struct OCRResult: Codable {
    let engine: String
    let language: String
    let page: PageInfo
    let lines: [OCRLine]
}

struct OCRError: Codable {
    let error: String
}

func fail(_ message: String) -> Never {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try! encoder.encode(OCRError(error: message))
    FileHandle.standardError.write(data)
    FileHandle.standardError.write(Data("\n".utf8))
    exit(1)
}

func languageCodes(for input: String) -> [String] {
    switch input.lowercased() {
    case "es", "es-es", "spa", "spanish":
        return ["es-ES", "es"]
    case "en", "en-us", "en-gb", "eng", "english":
        return ["en-US", "en"]
    default:
        return [input]
    }
}

func imagePageInfo(for url: URL) -> PageInfo {
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    else {
        fail("No se pudo leer la imagen.")
    }

    let width = properties[kCGImagePropertyPixelWidth] as? Double
        ?? Double(properties[kCGImagePropertyPixelWidth] as? Int ?? 0)
    let height = properties[kCGImagePropertyPixelHeight] as? Double
        ?? Double(properties[kCGImagePropertyPixelHeight] as? Int ?? 0)

    if width <= 0 || height <= 0 {
        fail("La imagen no tiene dimensiones validas.")
    }

    return PageInfo(width: width, height: height)
}

func configure(_ request: VNRecognizeTextRequest, language: String) {
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = languageCodes(for: language)
    request.minimumTextHeight = 0.006

    if #available(macOS 13.0, *) {
        request.automaticallyDetectsLanguage = true
    }
}

let arguments = CommandLine.arguments
guard arguments.count >= 2 else {
    fail("Uso: vision-ocr.swift <imagen> [idioma]")
}

let imageURL = URL(fileURLWithPath: arguments[1])
let language = arguments.count >= 3 ? arguments[2] : "es"
let page = imagePageInfo(for: imageURL)

let request = VNRecognizeTextRequest()
configure(request, language: language)

do {
    let handler = VNImageRequestHandler(url: imageURL, options: [:])
    try handler.perform([request])
} catch {
    fail(error.localizedDescription)
}

let observations = request.results ?? []
let lines = observations.compactMap { observation -> OCRLine? in
    guard let candidate = observation.topCandidates(1).first else {
        return nil
    }

    let box = observation.boundingBox
    let left = box.origin.x * page.width
    let top = (1.0 - box.origin.y - box.height) * page.height
    let width = box.width * page.width
    let height = box.height * page.height

    return OCRLine(
        text: candidate.string,
        left: left,
        top: top,
        width: width,
        height: height,
        confidence: Double(candidate.confidence) * 100.0
    )
}

let result = OCRResult(
    engine: "apple-vision",
    language: languageCodes(for: language).first ?? language,
    page: page,
    lines: lines.sorted { first, second in
        if abs(first.top - second.top) > max(first.height, second.height) * 0.5 {
            return first.top < second.top
        }
        return first.left < second.left
    }
)

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(result)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
