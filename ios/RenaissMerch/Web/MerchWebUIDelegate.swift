import UIKit
import WebKit

extension MerchViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard action.targetFrame == nil, let url = action.request.url else { return nil }
        if policy.isMerch(url) { webView.load(action.request) }
        else if let page = webView.url, policy.isMerch(page), policy.isExternalLink(url) {
            // WebKit's automatic JavaScript windows are disabled. This delegate
            // handles a user-activated window.open as well as target="_blank".
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
        guard allowsDialog(from: frame) else {
            completionHandler(); return
        }
        let alert = UIAlertController(title: "Renaiss Merch", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        guard allowsDialog(from: frame) else { completionHandler(false); return }
        let alert = UIAlertController(title: "Renaiss Merch", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "確定", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
