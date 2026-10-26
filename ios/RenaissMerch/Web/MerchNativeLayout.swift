import WebKit

/// App-only layout integration. Safari's document gutter must not shrink the
/// native canvas; individual product surfaces still protect their controls.
enum MerchNativeLayout {
    private static let scriptMarker = "// Renaiss native layout\n"

    /// One native geometry owns both page size and responsive book state.
    /// WebKit's viewport units, media queries and innerWidth can lag separately
    /// during a Duo display handoff, so none of them can arbitrate this in App.
    static func viewportSource(_ size: CGSize) -> String {
        precondition(size.width.isFinite && size.height.isFinite && size.width > 0 && size.height > 0)
        return scriptMarker + """
        if (location.origin === "https://merch.renaisscltb.com") {
            const root = document.documentElement;
            root.dataset.merchNative = "true";
            root.dataset.merchNativeWidth = "\(size.width)";
            root.dataset.merchNativeHeight = "\(size.height)";
            root.dataset.merchNativeViewport = "\(size.width >= 760 ? "wide" : "narrow")";
            root.style.setProperty("--merch-native-width", "\(size.width)px");
            root.style.setProperty("--merch-native-height", "\(size.height)px");
            window.dispatchEvent(new Event("merch-native-viewport"));
        }
        """
    }

    /// Refresh the document-start seed as well as the current document: a full
    /// navigation or auth return must start with the latest scene dimensions.
    static func install(on configuration: WKWebViewConfiguration, size: CGSize) {
        let controller = configuration.userContentController
        let otherScripts = controller.userScripts.filter { !$0.source.hasPrefix(scriptMarker) }
        controller.removeAllUserScripts()
        otherScripts.forEach(controller.addUserScript)
        controller.addUserScript(WKUserScript(
            source: viewportSource(size), injectionTime: .atDocumentStart, forMainFrameOnly: true
        ))
        guard let resource = Bundle.main.url(forResource: "MerchNativeLayout", withExtension: "css"),
              let css = try? String(contentsOf: resource, encoding: .utf8),
              let data = try? JSONSerialization.data(withJSONObject: [css]),
              let literal = String(data: data, encoding: .utf8) else {
            preconditionFailure("Required native layout resource is missing or invalid")
        }
        let source = scriptMarker + """
        if (location.origin === "https://merch.renaisscltb.com") {
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
        controller.addUserScript(WKUserScript(
            source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true
        ))
    }
}
