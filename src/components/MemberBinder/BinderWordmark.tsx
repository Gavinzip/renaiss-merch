import { binderAssetUrl } from "./binderAssets";
export function BinderWordmark() {
  return (
    <img
      className="binder-wordmark"
      src={binderAssetUrl("wordmark")}
      width="154"
      height="45"
      alt="Renaiss"
    />
  );
}
