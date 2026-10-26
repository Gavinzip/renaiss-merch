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
    private var boundsObservation: NSKeyValueObservation?
    private var errorView: MerchLoadErrorView?
    private let binderPresentation = MerchBinderPresentation()
    private var preparingPresentation: UUID?
    private var publishedViewport = CGSize.zero
    private var publishedPreparing = false
    private var viewportTransition: (id: UUID, target: CGSize, completed: Bool)?
    var loginStarted = false
    var selectingStore = false
    lazy var downloads = MerchDownloads(presenter: self)

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(binderPresentation, name: "merchBinderState")
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.applicationNameForUserAgent = "RenaissMerch/1.0 iOS"
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init()") }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        binderPresentation.onFailure = { [weak self] in self?.showLoadError() }
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
        publishViewport(webView.bounds.size)
        boundsObservation = webView.observe(\.bounds, options: [.new]) { [weak self] webView, _ in
            MainActor.assumeIsolated {
                self?.observeViewport(webView.bounds.size)
            }
        }
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
                guard let self else { return }
                if self.webView.fullscreenState != .notInFullscreen {
                    self.viewportTransition = nil
                    if self.preparingPresentation != nil { self.publishedViewport = .zero }
                    self.binderPresentation.cancel()
                    self.preparingPresentation = nil
                    self.webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                }
                self.setNeedsStatusBarAppearanceUpdate()
                self.view.setNeedsLayout()
            }
        }
        webView.load(URLRequest(url: MerchNavigationPolicy.origin))
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Do not resize WebKit's separate fullscreen window. Once it restores
        // the web view here, fit the current scene, including a Duo pose change.
        if webView.superview === view, webView.fullscreenState == .notInFullscreen {
            webView.frame = CGRect(origin: .zero, size: viewportTransition?.target ?? view.bounds.size)
        }
        observeViewport(webView.bounds.size)
    }

    override func viewWillTransition(to size: CGSize, with coordinator: any UIViewControllerTransitionCoordinator) {
        // Send the target before WebKit begins independently updating its
        // viewport APIs. Fullscreen's reparented view is owned by its window;
        // its actual bounds observation supplies the geometry instead.
        if webView.superview === view, webView.fullscreenState == .notInFullscreen {
            binderPresentation.cancel()
            preparingPresentation = nil
            if publishedViewport.width < 760, size.width >= 760,
               policy.isMerch(webView.url ?? MerchNavigationPolicy.origin),
               webView.url?.fragment == "binder", !webView.isLoading, errorView == nil,
               binderPresentation.binderMounted, binderPresentation.coverVisible || !binderPresentation.hasCover {
                do { preparingPresentation = try binderPresentation.begin(webView: webView, host: view, size: size) }
                catch {
                    showLoadError()
                    super.viewWillTransition(to: size, with: coordinator)
                    return
                }
            } else if publishedViewport.width >= 760, size.width < 760,
                      webView.url?.fragment == "binder", !webView.isLoading, errorView == nil, binderPresentation.binderMounted {
                do { preparingPresentation = try binderPresentation.begin(webView: webView, host: view, size: size) }
                catch {
                    showLoadError()
                    super.viewWillTransition(to: size, with: coordinator)
                    return
                }
            }
            let id = UUID()
            viewportTransition = (id, size, false)
            // Prepare WebKit's backing view before UIKit presents the new
            // display. Otherwise its first surface still has the old bounds.
            webView.autoresizingMask = []
            webView.frame = CGRect(origin: .zero, size: size)
            webView.layoutIfNeeded()
            publishViewport(size)
            coordinator.animate(alongsideTransition: nil) { [weak self] context in
                guard let self, self.viewportTransition?.id == id else { return }
                if context.isCancelled {
                    self.viewportTransition = nil
                    self.binderPresentation.cancel()
                    self.preparingPresentation = nil
                    self.webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                    if self.webView.superview === self.view,
                       self.webView.fullscreenState == .notInFullscreen {
                        self.webView.frame = self.view.bounds
                    }
                } else {
                    self.viewportTransition?.completed = true
                }
                self.observeViewport(self.webView.bounds.size)
            }
        }
        super.viewWillTransition(to: size, with: coordinator)
    }

    private func observeViewport(_ size: CGSize) {
        if webView.superview !== view {
            // WebKit's fullscreen host now owns the view. The old controller's
            // transition target must never constrain that host's actual bounds.
            viewportTransition = nil
            if preparingPresentation != nil { publishedViewport = .zero }
            binderPresentation.cancel()
            preparingPresentation = nil
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        }
        if webView.superview === view, size != view.bounds.size { return }
        // Layout can still describe the previous display after the transition
        // has announced its target. Do not publish that obsolete geometry back
        // into a new pose; wait for the matching native bounds and completion.
        if let transition = viewportTransition {
            guard size == transition.target else { return }
            if transition.completed {
                viewportTransition = nil
                webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            }
        }
        publishViewport(size)
    }

    private func publishViewport(_ size: CGSize) {
        if !binderPresentation.isPreparing { preparingPresentation = nil }
        let preparing = preparingPresentation != nil
        guard size.width > 0, size.height > 0,
              size != publishedViewport || preparing != publishedPreparing else { return }
        publishedViewport = size
        publishedPreparing = preparing
        MerchNativeLayout.install(on: webView.configuration, size: size)
        // Exact-origin geometry only; cover-readiness messages carry no credentials.
        webView.evaluateJavaScript(MerchNativeLayout.viewportSource(size, preparing: preparing), completionHandler: nil)
        if let id = preparingPresentation {
            binderPresentation.reveal(webView: webView, size: size, id: id) { [weak self] error in
                guard let self, self.preparingPresentation == id else { return }
                self.preparingPresentation = nil
                self.publishedPreparing = false
                if error != nil { self.showLoadError() }
            }
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
        binderPresentation.resetDocument()
        authentication.cancel()
        downloads.cancelActive()
        webView.stopLoading()
    }

    func beginDocumentNavigation() {
        binderPresentation.resetDocument(preservingCover: true)
        preparingPresentation = nil
    }

    func finishDocumentNavigation() {
        binderPresentation.bindDocument(webView)
    }

    func allowsDialog(from frame: WKFrameInfo) -> Bool {
        guard let url = frame.request.url else { return false }
        return policy.isMerch(url) || (selectingStore && policy.isStoreMap(url))
    }
}
