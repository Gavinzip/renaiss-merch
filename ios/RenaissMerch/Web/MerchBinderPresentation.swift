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
    var isPreparing: Bool { generation != nil }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https",
              origin.host == "merch.renaisscltb.com", [0, 443].contains(origin.port),
              let state = message.body as? [String: Any],
              let document = state["document"] as? String, document == documentID,
              let closed = state["closed"] as? Bool else { return }
        coverVisible = closed
        binderMounted = state["mounted"] as? Bool == true
        if state["mounted"] as? Bool == false {
            captureID = UUID()
            cancel()
            cachedCover = nil; cachedBackground = nil
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

    func resetDocument() {
        navigationID = UUID()
        captureID = UUID()
        documentID = nil
        coverVisible = false
        binderMounted = false
        cachedCover = nil; cachedBackground = nil
        cancel()
    }

    func bindDocument(_ webView: WKWebView) {
        let navigation = navigationID
        webView.evaluateJavaScript("""
          location.origin === 'https://merch.renaisscltb.com' ? {
            document: document.documentElement.dataset.merchNativeDocument,
            mounted: Boolean(document.querySelector('.book')),
            closed: Boolean(document.querySelector('.book.at-front .leaf--cover-front:not(.dragging)'))
          } : null
          """) { [weak self] result, _ in
            guard let self, self.navigationID == navigation,
                  let state = result as? [String: Any],
                  let document = state["document"] as? String else { return }
            self.documentID = document
            self.binderMounted = state["mounted"] as? Bool == true
            self.coverVisible = state["closed"] as? Bool == true
            if self.coverVisible { self.cacheClosedCover(webView) }
        }
    }

    func begin(host: UIView, size: CGSize) throws -> UUID {
        cancel()
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
        let navigation = navigationID, size = webView.bounds.size
        let capture = UUID()
        captureID = capture
        let configuration = WKSnapshotConfiguration()
        configuration.afterScreenUpdates = true
        webView.takeSnapshot(with: configuration) { [weak self, weak webView] image, _ in
            guard let self, let webView, self.navigationID == navigation, self.captureID == capture,
                  self.binderMounted,
                  self.coverVisible, self.overlay == nil, webView.bounds.size == size,
                  let image else { return }
            self.cache(image: image, size: size)
        }
    }

    private func cache(image: UIImage, size: CGSize) {
        captureID = UUID()
        guard let pixels = image.cgImage else { return }
        let scale = CGFloat(pixels.width) / size.width
        let width = size.width < 760 ? size.width - 16 : (size.width - 16) / 2
        let coverRect = CGRect(x: (size.width - width) / 2, y: 4, width: width, height: size.height - 8)
        let backgroundRect = CGRect(x: 0, y: 0, width: 4, height: size.height)
        guard let cover = pixels.cropping(to: coverRect.applying(CGAffineTransform(scaleX: scale, y: scale))),
              let background = pixels.cropping(to: backgroundRect.applying(CGAffineTransform(scaleX: scale, y: scale))) else { return }
        cachedCover = UIImageView(image: UIImage(cgImage: cover))
        cachedBackground = UIImageView(image: UIImage(cgImage: background))
    }

    func reveal(webView: WKWebView, size: CGSize, id: UUID,
                completion: @escaping (Error?) -> Void) {
        // The native size and closed pose must both be laid out before asking
        // WebKit to flush its pending paint. A timer cannot establish this.
        webView.callAsyncJavaScript("""
          if (location.origin !== 'https://merch.renaisscltb.com') return false;
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
                if size.width < 760, let image { self.cache(image: image, size: size) }
                webView.evaluateJavaScript(MerchNativeLayout.viewportSource(size)) { [weak self] _, error in
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
