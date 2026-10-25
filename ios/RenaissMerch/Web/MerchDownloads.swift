import OSLog
import UIKit
import WebKit

/// Owns one user-requested download through transfer, queued presentation and sharing.
@MainActor
final class MerchDownloads: NSObject, WKDownloadDelegate {
    private struct Transfer {
        let download: WKDownload
        var location: MerchDownloadLocation?
    }
    private weak var presenter: MerchViewController?
    private var transfer: Transfer?
    private var pending: MerchDownloadLocation?
    private var presented: MerchDownloadLocation?
    private weak var shareSheet: UIActivityViewController?
    private var presentationTask: Task<Void, Never>?
    private let logger = Logger(subsystem: "com.renaiss.merch", category: "Downloads")

    init(presenter: MerchViewController) { self.presenter = presenter }

    func receive(_ download: WKDownload) {
        guard transfer == nil, pending == nil, presented == nil else {
            download.cancel { _ in }
            presenter?.showMessage("請先完成目前的下載，再下載其他檔案。")
            return
        }
        transfer = Transfer(download: download)
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping @MainActor @Sendable (URL?) -> Void) {
        guard transfer?.download === download else { completionHandler(nil); return }
        do {
            let location = try MerchDownloadLocation(suggestedFilename: suggestedFilename)
            try FileManager.default.createDirectory(at: location.directory, withIntermediateDirectories: false,
                attributes: [.protectionKey: FileProtectionType.complete])
            transfer?.location = location
            completionHandler(location.file)
        } catch {
            completionHandler(nil)
            presenter?.showMessage("無法建立下載檔案，請確認檔名及裝置儲存空間後重試。")
        }
    }

    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest,
                  decisionHandler: @escaping @MainActor @Sendable (WKDownload.RedirectPolicy) -> Void) {
        guard let url = request.url, url.scheme == "https", url.user == nil, url.password == nil else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard transfer?.download === download, let location = transfer?.location else { return }
        transfer = nil
        pending = location
        presentationTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self, let location = self.pending else { return }
                guard let presenter = self.presenter, presenter.viewIfLoaded?.window != nil else {
                    self.remove(location)
                    self.pending = nil
                    return
                }
                if presenter.presentedViewController == nil, !presenter.isBeingDismissed,
                   !presenter.authentication.isActive,
                   presenter.view.window?.windowScene?.activationState == .foregroundActive {
                    self.present(location, from: presenter)
                    return
                }
                // A website confirm, login sheet or file picker may still be
                // active. Preserve it and wait before presenting the export.
                do { try await Task.sleep(for: .milliseconds(150)) } catch { return }
            }
        }
    }

    private func present(_ location: MerchDownloadLocation, from presenter: MerchViewController) {
        pending = nil
        presented = location
        let sheet = UIActivityViewController(activityItems: [location.file], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = presenter.view
        sheet.popoverPresentationController?.sourceRect = CGRect(
            x: presenter.view.bounds.midX, y: presenter.view.bounds.maxY - 48, width: 0, height: 0)
        shareSheet = sheet
        sheet.completionWithItemsHandler = { [weak self] _, _, _, _ in
            Task { @MainActor in
                guard let self, self.presented?.directory == location.directory else { return }
                self.remove(location)
                self.presented = nil
                self.shareSheet = nil
            }
        }
        presenter.present(sheet, animated: true) { [weak self, weak sheet] in
            guard let self, sheet?.presentingViewController == nil,
                  self.presented?.directory == location.directory else { return }
            self.remove(location)
            self.presented = nil
            self.shareSheet = nil
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        guard transfer?.download === download else { return }
        if let location = transfer?.location { remove(location) }
        transfer = nil
        if (error as NSError).code != NSURLErrorCancelled {
            presenter?.showMessage("檔案下載失敗，請重試。")
        }
    }

    func cancelActive() {
        presentationTask?.cancel()
        presentationTask = nil
        transfer?.download.cancel { _ in }
        if let location = transfer?.location { remove(location) }
        if let location = pending { remove(location) }
        shareSheet?.dismiss(animated: false)
        if let location = presented { remove(location) }
        transfer = nil
        pending = nil
        presented = nil
        shareSheet = nil
    }

    private func remove(_ location: MerchDownloadLocation) {
        do { try FileManager.default.removeItem(at: location.directory) }
        catch { logger.error("Could not remove an app-owned download directory") }
    }
}
