import Foundation

struct MerchAuthorization {
    let url: URL
    let callbackPath: String
    let state: String
}

/// Trust for main-frame navigation, kept separate from CDN subresource delivery.
struct MerchNavigationPolicy {
    static let origin = URL(string: "https://merch.renaisscltb.com")!
    static let callbackPath = "/auth/callback"
    static let mapStartPath = "/api/merch-7-eleven/map"

    private func isHTTPS(_ url: URL, host: String) -> Bool {
        url.scheme == "https" && url.host == host
            && (url.port == nil || url.port == 443)
            && url.user == nil && url.password == nil
    }

    func isMerch(_ url: URL) -> Bool { isHTTPS(url, host: Self.origin.host!) }

    private func authorizationCallbackPath(_ url: URL) -> String? {
        if isHTTPS(url, host: "www.renaiss.xyz"), url.path == "/api/auth/oauth2/authorize" {
            return Self.callbackPath
        } else if isHTTPS(url, host: "x.com"), url.path == "/i/oauth2/authorize" {
            return "/auth/x/callback"
        } else if isHTTPS(url, host: "discord.com"), url.path == "/oauth2/authorize" {
            return "/auth/discord/callback"
        }
        return nil
    }

    func isAuthorizationEndpoint(_ url: URL) -> Bool {
        authorizationCallbackPath(url) != nil
    }

    func authorization(_ url: URL) -> MerchAuthorization? {
        guard let callback = authorizationCallbackPath(url), url.fragment == nil,
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              items.filter({ $0.name == "state" }).count == 1,
              items.filter({ $0.name == "redirect_uri" }).count == 1,
              let state = items.first(where: { $0.name == "state" })?.value, !state.isEmpty,
              let redirect = items.first(where: { $0.name == "redirect_uri" })?.value,
              let target = URL(string: redirect), isMerch(target), target.path == callback,
              target.query == nil, target.fragment == nil else { return nil }
        return MerchAuthorization(url: url, callbackPath: callback, state: state)
    }

    func isCallback(_ url: URL, authorization: MerchAuthorization) -> Bool {
        guard isMerch(url), url.path == authorization.callbackPath, url.fragment == nil,
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              items.filter({ $0.name == "state" }).count == 1 else { return false }
        return items.first(where: { $0.name == "state" })?.value == authorization.state
    }

    func isStoreMap(_ url: URL) -> Bool {
        isHTTPS(url, host: "logistics.ecpay.com.tw") || isHTTPS(url, host: "logistics-stage.ecpay.com.tw")
    }

    func isExternalLink(_ url: URL) -> Bool {
        ["https", "http", "mailto", "tel"].contains(url.scheme ?? "")
            && url.user == nil && url.password == nil
    }

    func isDownload(_ url: URL, from source: URL) -> Bool {
        guard isMerch(source) else { return false }
        if url.scheme == "https" { return url.user == nil && url.password == nil }
        if url.scheme == "blob", let owner = URL(string: String(url.absoluteString.dropFirst(5))) {
            return isMerch(owner)
        }
        return url.absoluteString.lowercased().hasPrefix("data:text/csv;")
    }
}
