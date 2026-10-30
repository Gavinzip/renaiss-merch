import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import "./proof-flow.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function motionPhase(progress: number, start: number, end: number) {
  const t = clamp((progress - start) / (end - start));
  return t * t * (3 - 2 * t);
}

// Keep evidence legible before its turn; scroll changes attention, not availability.
export function focusStyle(progress: number, start: number, end: number): CSSProperties {
  const amount = motionPhase(progress, start, end);
  return {
    opacity: 0.78 + amount * 0.22,
    transform: `translateY(${(1 - amount) * 9}px)`,
  };
}

export function ProofFlowArrow({ progress, start, end, className = "", label }: {
  progress: number;
  start: number;
  end: number;
  className?: string;
  label?: string;
}) {
  const amount = motionPhase(progress, start, end);
  return <span className={`ps-flow-arrow ${className}`} aria-hidden="true">
    <span className="ps-flow-arrow-motion" style={{ opacity: 0.08 + amount * 0.92, transform: `translateX(${(amount - 1) * 10}px)` }}>
      <i style={{ transform: `scaleX(${amount})` }} />
      <ChevronRight size={18} strokeWidth={1.6} />
    </span>
    {label && <small style={{ opacity: amount }}>{label}</small>}
  </span>;
}
