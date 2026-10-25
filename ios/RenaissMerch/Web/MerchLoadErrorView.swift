import UIKit

final class MerchLoadErrorView: UIView {
    init(retry: @escaping () -> Void) {
        super.init(frame: .zero)
        backgroundColor = UIColor(named: "Canvas")
        let symbol = UIImageView(image: UIImage(systemName: "wifi.exclamationmark"))
        symbol.tintColor = .secondaryLabel
        symbol.contentMode = .scaleAspectFit
        symbol.heightAnchor.constraint(equalToConstant: 40).isActive = true
        let title = UILabel()
        title.text = "目前無法連上 Renaiss"
        title.font = .preferredFont(forTextStyle: .headline)
        title.adjustsFontForContentSizeCategory = true
        title.textAlignment = .center
        let detail = UILabel()
        detail.text = "請確認網路連線後重試。你的收藏仍保存在原本的帳號。"
        detail.font = .preferredFont(forTextStyle: .body)
        detail.adjustsFontForContentSizeCategory = true
        detail.textAlignment = .center
        detail.numberOfLines = 0
        let button = UIButton(configuration: .filled(), primaryAction: UIAction(title: "重新載入") { _ in retry() })
        let stack = UIStackView(arrangedSubviews: [symbol, title, detail, button])
        stack.axis = .vertical
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: safeAreaLayoutGuide.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: safeAreaLayoutGuide.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 360),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: safeAreaLayoutGuide.trailingAnchor, constant: -24)
        ])
    }

    required init?(coder: NSCoder) { fatalError("Use init(retry:)") }
}
