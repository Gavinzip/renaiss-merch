/** A readable text layer with a separate, decorative iridescent hover layer. */
export function HubMotionText({ children }: { children: string }) {
  return (
    <span className="hub-motion-text">
      <span className="hub-motion-text__ink">{children}</span>
      <span className="hub-motion-text__color" aria-hidden="true">{children}</span>
    </span>
  );
}
