import { hubPreviewWordmarkUrl } from "./hubPreviewAssets";
import "./HubWordmark.css";

// Use the supplied artwork so the official letterforms and spacing stay intact.
export function HubWordmark() {
  return (
    <img
      className="hub-brand-wordmark"
      src={hubPreviewWordmarkUrl()}
      width={512}
      height={126}
      alt="Renaiss"
    />
  );
}
