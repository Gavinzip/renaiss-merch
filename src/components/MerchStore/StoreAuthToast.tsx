import './StoreAuthToast.css';

type StoreAuthToastProps = {
  message: string;
  title: string;
};

export function StoreAuthToast({
  message,
  title
}: StoreAuthToastProps) {
  return (
    <aside
      aria-atomic="true"
      className="merch-store-auth-toast"
      role="alert"
    >
      <span aria-hidden="true" className="merch-store-auth-toast__icon">
        !
      </span>
      <span className="merch-store-auth-toast__copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </span>
    </aside>
  );
}
