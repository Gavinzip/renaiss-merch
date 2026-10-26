import UIKit
import WebKit

extension MerchViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        beginDocumentNavigation()
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload, let source = action.sourceFrame.request.url,
           policy.isDownload(url, from: source) {
            decisionHandler(.download)
            return
        }
        guard action.targetFrame?.isMainFrame != false else {
            decisionHandler(.allow)
            return
        }
        if policy.isMerch(url) {
            if url.path == "/api/auth/renaiss/start" { loginStarted = true }
            if url.path == MerchNavigationPolicy.mapStartPath && action.request.httpMethod == "POST" {
                selectingStore = true
            }
            decisionHandler(.allow)
        } else if policy.isAuthorizationEndpoint(url) {
            decisionHandler(.cancel)
            // During the server's 302, webView.url already points at the
            // pending provider URL. The initiating frame remains our origin.
            guard let authorization = policy.authorization(url),
                  let source = action.sourceFrame.request.url, policy.isMerch(source),
                  authorization.callbackPath != MerchNavigationPolicy.callbackPath || loginStarted else {
                loginStarted = false
                showMessage("登入請求無法驗證，請回到 Merch 重新登入。")
                return
            }
            loginStarted = false
            authentication.start(authorization: authorization, webView: webView) { [weak self] in self?.showMessage($0) }
        } else if selectingStore && policy.isStoreMap(url) {
            // Keep WebKit's original request, including the map form's POST body
            // and the eventual POST callback. Opening this URL externally loses it.
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated && policy.isExternalLink(url) {
                UIApplication.shared.open(url)
            } else if selectingStore {
                showMessage("選店頁面無法開啟，請返回 Merch 重新選擇門市。")
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void) {
        if response.isForMainFrame, !response.canShowMIMEType,
           let url = response.response.url, policy.isMerch(url),
           let http = response.response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
            decisionHandler(.download)
        } else { decisionHandler(.allow) }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        downloads.receive(download)
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        downloads.receive(download)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finishDocumentNavigation()
        loginStarted = false
        if let url = webView.url, policy.isMerch(url), url.path != MerchNavigationPolicy.mapStartPath {
            selectingStore = false
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        handleNavigationFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavigationFailure(error)
    }

    private func handleNavigationFailure(_ error: Error) {
        let failure = error as NSError
        // WebKit reports policy-intercepted redirects with legacy error 102.
        // These include our system-auth handoff, external links and downloads;
        // presenting a network-error panel here interrupts that intended flow.
        if (failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled) ||
           (failure.domain == "WebKitErrorDomain" && failure.code == 102) {
            // A policy handoff/cancel can leave the committed Merch document
            // alive without another didFinish. Bind that actual context again.
            finishDocumentNavigation()
            return
        }
        loginStarted = false
        showLoadError()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showLoadError() }
}
