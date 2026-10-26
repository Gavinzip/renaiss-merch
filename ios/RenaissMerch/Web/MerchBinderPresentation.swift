import UIKit
import WebKit

/// Coordinate a real cover snapshot with WebKit's first paint on Duo's inner
/// display. No artwork or collection data is recreated by the native layer.
@MainActor
final class MerchBinderPresentation: NSObject, WKScriptMessageHandler {
    private(set) var coverVisible = false
    private(set) var binderMounted = false
    private var overlay: UIView?
    private var generation: UUID?
    private var documentID: String?
    private var navigationID = UUID()
    private var cachedCover: UIView?
    private var cachedBackground: UIView?
    private var captureID = UUID()
    private var instanceID: String?
    private var cachedDocumentID: String?
    private var cachedInstanceID: String?
    private var cachedReady = false
    private var bindID = UUID()
    private var stateRevision = 0
    var isPreparing: Bool { generation != nil }
    var hasCover: Bool { cachedCover != nil && cachedBackground != nil }
    var onFailure: (() -> Void)?

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https",
              origin.host == "merch.renaisscltb.com", [0, 443].contains(origin.port),
              let state = message.body as? [String: Any],
              let document = state["document"] as? String, UUID(uuidString: document) != nil else { return }
        // Register at document start, before React can finish decoding art.
        // A later asynchronous DOM read must not lose that first ready report.
        if state["registered"] as? Bool == true {
            guard documentID == nil else { return }
            documentID = document
            stateRevision += 1
            if cachedDocumentID != document {
                cachedCover = nil; cachedBackground = nil; cachedReady = false
            }
            return
        }
        guard document == documentID,
              let instance = state["instance"] as? String, UUID(uuidString: instance) != nil,
              let closed = state["closed"] as? Bool else { return }
        if state["mounted"] as? Bool == false, instance != instanceID { return }
        stateRevision += 1
        if instance != instanceID {
            let wasPreparing = isPreparing
            cancel()
            captureID = UUID()
            cachedCover = nil; cachedBackground = nil; cachedReady = false
            instanceID = instance
            if wasPreparing {
                message.webView?.evaluateJavaScript("""
                  if (location.origin === 'https://merch.renaisscltb.com') {
                    document.documentElement.dataset.merchNativePreparing = 'false';
                    window.dispatchEvent(new Event('merch-native-viewport'));
                  }
                  """, completionHandler: nil)
            }
        }
        coverVisible = closed
        binderMounted = state["mounted"] as? Bool == true
        if state["failed"] as? Bool == true {
            cancel(); cachedCover = nil; cachedBackground = nil; cachedReady = false
            onFailure?()
            return
        }
        if state["mounted"] as? Bool == false {
            captureID = UUID()
            cancel()
            cachedCover = nil; cachedBackground = nil; cachedReady = false
            message.webView?.evaluateJavaScript("""
              if (location.origin === 'https://merch.renaisscltb.com') {
                document.documentElement.dataset.merchNativePreparing = 'false';
                window.dispatchEvent(new Event('merch-native-viewport'));
              }
              """, completionHandler: nil)
        } else if closed, overlay == nil, let webView = message.webView {
            cacheClosedCover(webView)
        }
    }

    func resetDocument(preservingCover: Bool = false) {
        navigationID = UUID()
        bindID = UUID()
        stateRevision += 1
        captureID = UUID()
        documentID = nil
        instanceID = nil
        coverVisible = false
        binderMounted = false
        if !preservingCover {
            cachedCover = nil; cachedBackground = nil; cachedReady = false
            cachedDocumentID = nil; cachedInstanceID = nil
        }
        cancel()
    }

    func bindDocument(_ webView: WKWebView) {
        let navigation = navigationID
        let binding = UUID(), revision = stateRevision
        bindID = binding
        webView.evaluateJavaScript("""
          location.origin === 'https://merch.renaisscltb.com' ? {
            document: document.documentElement.dataset.merchNativeDocument,
            mounted: Boolean(document.querySelector('.book')),
            instance: document.querySelector('.book')?.dataset.nativeCoverInstance,
            closed: Boolean(document.querySelector('.book.at-front[data-native-cover-ready="true"] .leaf--cover-front:not(.dragging)'))
          } : null
          """) { [weak self] result, _ in
            guard let self, self.navigationID == navigation, self.bindID == binding,
                  self.stateRevision == revision,
                  let state = result as? [String: Any],
                  let document = state["document"] as? String, UUID(uuidString: document) != nil else { return }
            self.documentID = document
            let instance = state["instance"] as? String
            self.instanceID = instance.flatMap { UUID(uuidString: $0) == nil ? nil : $0 }
            if self.cachedDocumentID != document || self.cachedInstanceID != self.instanceID {
                self.cachedCover = nil; self.cachedBackground = nil; self.cachedReady = false
            }
            self.binderMounted = state["mounted"] as? Bool == true && self.instanceID != nil
            self.coverVisible = state["closed"] as? Bool == true
            if self.coverVisible { self.cacheClosedCover(webView) }
        }
    }

    func begin(webView: WKWebView, host: UIView, size: CGSize) throws -> UUID {
        cancel()
        // The first display handoff can beat background prewarming. The web
        // client still holds the real closed cover until this buffer is ready.
        if !hasCover {
            guard let current = captureView(webView, size: webView.bounds.size),
                  cache(image: current, size: webView.bounds.size, ready: false) else {
                throw PresentationError.snapshotUnavailable
            }
        }
        guard let cover = cachedCover, let background = cachedBackground else {
            throw PresentationError.snapshotUnavailable
        }
        return stage(cover: cover, background: background, host: host, size: size)
    }

    private func stage(cover: UIView, background: UIView, host: UIView, size: CGSize) -> UUID {
        let panel = UIView(frame: CGRect(origin: .zero, size: size))
        panel.clipsToBounds = true
        panel.accessibilityElementsHidden = true
        background.frame = panel.bounds
        panel.addSubview(background)
        let pageWidth = size.width < 760 ? size.width - 16 : (size.width - 16) / 2
        cover.frame = CGRect(x: (size.width - pageWidth) / 2, y: 4,
                             width: pageWidth, height: size.height - 8)
        panel.addSubview(cover)
        host.addSubview(panel)
        let id = UUID()
        generation = id
        overlay = panel
        return id
    }

    private func cacheClosedCover(_ webView: WKWebView) {
        guard webView.window?.windowScene?.activationState == .foregroundActive else { return }
        guard let instance = instanceID else { return }
        let navigation = navigationID, size = webView.bounds.size
        let capture = UUID()
        captureID = capture
        let configuration = WKSnapshotConfiguration()
        configuration.afterScreenUpdates = true
        webView.takeSnapshot(with: configuration) { [weak self, weak webView] image, _ in
            guard let self, let webView, self.navigationID == navigation, self.captureID == capture,
                  self.binderMounted, self.instanceID == instance,
                  webView.window?.windowScene?.activationState == .foregroundActive,
                  self.coverVisible, self.overlay == nil, webView.bounds.size == size else { return }
            guard image != nil, let rendered = self.captureView(webView, size: size),
                  self.cache(image: rendered, size: size) else { self.onFailure?(); return }
            self.notifyCached(webView, instance: instance)
        }
    }

    private func notifyCached(_ webView: WKWebView, instance: String) {
        webView.evaluateJavaScript(cachedSource(instance), completionHandler: nil)
    }

    private func cachedSource(_ instance: String) -> String {
        """
          if (location.origin === 'https://merch.renaisscltb.com') {
            window.dispatchEvent(new CustomEvent('merch-native-cover-cached', {detail: '\(instance)'}));
          }
          """
    }

    private func captureView(_ webView: WKWebView, size: CGSize) -> UIImage? {
        guard let window = webView.window else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = window.screen.scale
        var complete = false
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            complete = webView.drawHierarchy(in: CGRect(origin: .zero, size: size), afterScreenUpdates: true)
        }
        return complete ? image : nil
    }

    @discardableResult private func cache(image: UIImage, size: CGSize, ready: Bool = true) -> Bool {
        captureID = UUID()
        cachedCover = nil; cachedBackground = nil; cachedReady = false
        guard let pixels = image.cgImage else { return false }
        let scale = CGFloat(pixels.width) / size.width
        let width = size.width < 760 ? size.width - 16 : (size.width - 16) / 2
        let coverRect = CGRect(x: (size.width - width) / 2, y: 4, width: width, height: size.height - 8)
        let backgroundRect = CGRect(x: 0, y: 0, width: 4, height: size.height)
        guard let cover = pixels.cropping(to: coverRect.applying(CGAffineTransform(scaleX: scale, y: scale))),
              let background = pixels.cropping(to: backgroundRect.applying(CGAffineTransform(scaleX: scale, y: scale))) else { return false }
        cachedCover = UIImageView(image: UIImage(cgImage: cover))
        cachedBackground = UIImageView(image: UIImage(cgImage: background))
        cachedDocumentID = documentID
        cachedInstanceID = instanceID
        cachedReady = ready
        return true
    }

    func reveal(webView: WKWebView, size: CGSize, id: UUID,
                completion: @escaping (Error?) -> Void) {
        // The native size and closed pose must both be laid out before asking
        // WebKit to flush its pending paint. A timer cannot establish this.
        webView.callAsyncJavaScript("""
          if (location.origin !== 'https://merch.renaisscltb.com') return false;
          const images = Array.from(document.querySelectorAll('.book .face--profile img, .book .leaf--p1 > .face--front img'));
          await Promise.all(images.map(image => image.decode()));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const canvas = document.querySelector('.member-binder')?.getBoundingClientRect();
          return Boolean(canvas && Math.abs(canvas.width - \(size.width)) < 0.5 &&
            Math.abs(canvas.height - \(size.height)) < 0.5 && document.querySelector('.book.at-front'));
          """, arguments: [:], in: nil, in: .page) { [weak self, weak webView] result in
            guard let self, let webView, self.generation == id else { return }
            guard case .success(let ready) = result, ready as? Bool == true else {
                self.cancel(); completion(PresentationError.layoutNotReady); return
            }
            let configuration = WKSnapshotConfiguration()
            configuration.afterScreenUpdates = true
            webView.takeSnapshot(with: configuration) { [weak self, weak webView] image, error in
                guard let self, let webView, self.generation == id else { return }
                guard image != nil, error == nil else {
                    self.cancel(); completion(error ?? PresentationError.snapshotUnavailable); return
                }
                if size.width < 760 || !self.cachedReady {
                    guard let rendered = self.captureView(webView, size: size), self.cache(image: rendered, size: size) else {
                        self.cancel(); completion(PresentationError.snapshotUnavailable); return
                    }
                }
                guard let instance = self.instanceID else {
                    self.cancel(); completion(PresentationError.layoutNotReady); return
                }
                let cue = self.cachedSource(instance)
                // One JS transaction settles geometry, releases a queued first
                // turn and starts the original animation before lifting pixels.
                webView.evaluateJavaScript(MerchNativeLayout.viewportSource(size) + "\n" + cue) { [weak self] _, error in
                    guard let self, self.generation == id else { return }
                    self.cancel()
                    completion(error)
                }
            }
        }
    }

    func cancel() {
        generation = nil
        overlay?.removeFromSuperview()
        overlay = nil
    }

    enum PresentationError: LocalizedError {
        case snapshotUnavailable, layoutNotReady
        var errorDescription: String? { "收藏冊過場未能完成，請重新收合後再展開。" }
    }
}
