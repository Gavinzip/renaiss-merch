import WebKit

/// App-only layout integration. Safari's document gutter must not shrink the
/// native canvas; individual product surfaces still protect their controls.
enum MerchNativeLayout {
    static func install(on configuration: WKWebViewConfiguration) {
        guard let resource = Bundle.main.url(forResource: "MerchNativeLayout", withExtension: "css"),
              let css = try? String(contentsOf: resource, encoding: .utf8),
              let data = try? JSONSerialization.data(withJSONObject: [css]),
              let literal = String(data: data, encoding: .utf8) else {
            preconditionFailure("Required native layout resource is missing or invalid")
        }
        let source = """
        if (location.origin === "https://merch.renaisscltb.com") {
            document.documentElement.dataset.merchNative = "true";
            // Separate archive/draw documents do not share Community's viewport
            // declaration. Their App backgrounds also belong to the full scene.
            if (!document.documentElement.hasAttribute("data-community-app")) {
                const viewport = document.querySelector('meta[name="viewport"]');
                if (viewport) viewport.content += ", viewport-fit=cover";
            }
            const style = document.createElement("style");
            style.id = "merch-native-layout";
            style.textContent = \(literal)[0];
            document.head.appendChild(style);
        }
        """
        configuration.userContentController.addUserScript(WKUserScript(
            source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true
        ))
    }
}
