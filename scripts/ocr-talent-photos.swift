// Local-only transcription aid. Source PNG files are never changed.
import Foundation
import Vision
import ImageIO

struct TextRow: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}
struct Page: Codable {
    let file: String
    let width: Int
    let height: Int
    let rows: [TextRow]
}
guard CommandLine.arguments.count == 3 else { fatalError("Usage: source-directory output-directory") }
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let files = (FileManager.default.enumerator(at: input, includingPropertiesForKeys: nil)?.allObjects as? [URL] ?? [])
    .filter { $0.pathExtension.lowercased() == "png" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
for (index, file) in files.enumerated() {
    try autoreleasepool {
        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw NSError(domain: "ReadImage", code: 1) }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hans", "en-US"]
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: image).perform([request])
        let rows = (request.results ?? []).compactMap { observation -> TextRow? in
            guard let text = observation.topCandidates(1).first else { return nil }
            let b = observation.boundingBox
            return TextRow(text: text.string, confidence: text.confidence, x: b.minX, y: 1 - b.maxY, width: b.width, height: b.height)
        }.sorted { abs($0.y - $1.y) > 0.009 ? $0.y < $1.y : $0.x < $1.x }
        let page = Page(file: file.path, width: image.width, height: image.height, rows: rows)
        try encoder.encode(page).write(to: output.appendingPathComponent(file.deletingPathExtension().lastPathComponent + ".json"), options: .atomic)
        print("\(index + 1)/\(files.count) \(file.lastPathComponent): \(rows.count) text rows")
        fflush(stdout)
    }
}
