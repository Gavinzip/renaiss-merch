import { useEffect, useRef } from "react";
import { createBinderTitle } from "./binderTitleRenderer";
export function BinderTitle({ name }: { name: string }) {
  const container = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (
      !container.current ||
      !heading.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const renderer = createBinderTitle(container.current, heading.current);
    if (!renderer) return;
    renderer.setText(name);
    const observer = new ResizeObserver(() => renderer.refresh());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      renderer.destroy();
    };
  }, [name]);
  return (
    <div className="stage-title" ref={container} aria-hidden="true">
      <span className="stage-eyebrow">Collection of</span>
      <h2 className="stage-name" ref={heading}>
        {name}
      </h2>
    </div>
  );
}
