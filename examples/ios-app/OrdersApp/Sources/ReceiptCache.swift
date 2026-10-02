import Foundation

// Removes cached receipts that are older than a week.
final class ReceiptCache {
    private let folder: URL

    init(folder: URL) {
        self.folder = folder
    }

    func removeStaleReceipts(now: Date = Date()) throws {
        let files = try FileManager.default.contentsOfDirectory(atPath: folder.path)
        for name in files {
            let path = folder.appendingPathComponent(name).path
            let attributes = try FileManager.default.attributesOfItem(atPath: path)
            // Reading the modification date is a use of the file timestamp API.
            guard let modified = attributes[.modificationDate] as? Date else { continue }
            if now.timeIntervalSince(modified) > 7 * 24 * 60 * 60 {
                try FileManager.default.removeItem(atPath: path)
            }
        }
    }
}
