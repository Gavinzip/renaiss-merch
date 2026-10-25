import UIKit
import WebKit

@MainActor
final class MerchViewController: UIViewController {
    let webView: WKWebView
    let policy = MerchNavigationPolicy()
    let authentication = MerchAuthentication()
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var progressObservation: NSKeyValueObservation?
    private var fullscreenObservation: NSKeyValueObservation?
    private var errorView: MerchLoadErrorView?
    var loginStarted = false
    var selectingStore = false
    lazy var downloads = MerchDownloads(presenter: self)

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.applicationNameForUserAgent = "RenaissMerch/1.0 iOS"
        MerchNativeLayout.install(on: configuration)
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init()") }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        // The existing product is intentionally a light pink canvas. Keep
        // native text and dialogs legible on that same material.
        overrideUserInterfaceStyle = .light
        let canvas = UIColor(named: "Canvas")!
        view.backgroundColor = canvas
        webView.backgroundColor = canvas
        webView.underPageBackgroundColor = canvas
        webView.isOpaque = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        // Let WebKit follow each product page's viewport-fit declaration. The
        // guest binder uses contain; its canvas uses cover with scoped insets.
        // An explicit scroll-inset override prevents that mode adaptation.
        webView.scrollView.automaticallyAdjustsScrollIndicatorInsets = false
        // WebKit temporarily reparents this view for element fullscreen. Frame
        // autoresizing survives that handoff; constraints to this parent do not.
        webView.frame = view.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.tintColor = UIColor(red: 0.67, green: 0.46, blue: 0.62, alpha: 1)
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor)
        ])
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] _, _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.progress.progress = Float(self.webView.estimatedProgress)
                self.progress.isHidden = self.webView.estimatedProgress >= 1
            }
        }
        fullscreenObservation = webView.observe(\.fullscreenState, options: [.new]) { [weak self] _, _ in
            MainActor.assumeIsolated {
                self?.setNeedsStatusBarAppearanceUpdate()
                self?.view.setNeedsLayout()
            }
        }
        webView.load(URLRequest(url: MerchNavigationPolicy.origin))
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Do not resize WebKit's separate fullscreen window. Once it restores
        // the web view here, fit the current scene, including a Duo pose change.
        if webView.superview === view, webView.fullscreenState == .notInFullscreen {
            webView.frame = view.bounds
        }
    }

    func showLoadError() {
        guard errorView == nil else { return }
        let panel = MerchLoadErrorView { [weak self] in
            guard let self else { return }
            self.errorView?.removeFromSuperview()
            self.errorView = nil
            if self.webView.url == nil {
                self.webView.load(URLRequest(url: MerchNavigationPolicy.origin))
            } else {
                self.webView.reload()
            }
        }
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)
        NSLayoutConstraint.activate([
            panel.topAnchor.constraint(equalTo: view.topAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        errorView = panel
    }

    func showMessage(_ message: String) {
        let alert = UIAlertController(title: "Renaiss Merch", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default))
        present(alert, animated: true)
    }

    func stop() {
        authentication.cancel()
        downloads.cancelActive()
        webView.stopLoading()
    }

    func allowsDialog(from frame: WKFrameInfo) -> Bool {
        guard let url = frame.request.url else { return false }
        return policy.isMerch(url) || (selectingStore && policy.isStoreMap(url))
    }
}
