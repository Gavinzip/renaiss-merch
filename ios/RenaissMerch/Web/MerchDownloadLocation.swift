import Foundation

/// The cleanup owner is the UUID directory, never a path derived from a filename.
struct MerchDownloadLocation {
    let directory: URL
    let file: URL

    init(suggestedFilename: String) throws {
        let name = (suggestedFilename as NSString).lastPathComponent
        guard !name.isEmpty, name != ".", name != "..",
              !name.contains("/"), !name.contains("\\"),
              name.rangeOfCharacter(from: .controlCharacters) == nil else {
            throw CocoaError(.fileWriteInvalidFileName)
        }
        let root = FileManager.default.temporaryDirectory.standardizedFileURL
        let directory = root.appendingPathComponent("RenaissDownload-" + UUID().uuidString, isDirectory: true)
        let file = directory.appendingPathComponent(name, isDirectory: false)
        guard file.deletingLastPathComponent().standardizedFileURL == directory.standardizedFileURL else {
            throw CocoaError(.fileWriteInvalidFileName)
        }
        self.directory = directory
        self.file = file
    }
}
