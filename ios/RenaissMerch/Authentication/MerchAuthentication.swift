import AuthenticationServices
import WebKit

@MainActor
final class MerchAuthentication: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?
    private var window: UIWindow?
    private let policy = MerchNavigationPolicy()

    var isActive: Bool { session != nil }

    func start(authorization: MerchAuthorization, webView: WKWebView, onError: @escaping (String) -> Void) {
        guard session == nil, let window = webView.window else {
            onError("登入請求無法驗證，請回到 Merch 重新登入。")
            return
        }
        self.window = window
        // The initial /api/auth/renaiss/start navigation already set the
        // HttpOnly PKCE challenge cookie in this WKWebsiteDataStore. Intercept
        // the HTTPS return before it reaches the server in the browser session,
        // then complete it in the same web view that started the challenge.
        let session = ASWebAuthenticationSession(
            url: authorization.url,
            callback: .https(host: MerchNavigationPolicy.origin.host!, path: authorization.callbackPath)
        ) { [weak self, weak webView] callback, error in
            Task { @MainActor in
                guard let self else { return }
                self.session = nil
                self.window = nil
                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin { return }
                guard error == nil, let callback,
                      self.policy.isCallback(callback, authorization: authorization), let webView else {
                    onError("無法完成帳號授權。請確認 App 的網域關聯設定後重試。")
                    return
                }
                webView.load(URLRequest(url: callback))
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        self.session = session
        if !session.start() {
            self.session = nil
            self.window = nil
            onError("無法開啟安全登入視窗，請重試。")
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        window!
    }

    func cancel() {
        session?.cancel()
        session = nil
        window = nil
    }
}
