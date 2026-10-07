import type { PointerEvent } from "react";
import "./ComposerBorderGlow.css";

// BorderGlow pointer geometry adapted from React Bits, copyright David Haz.
// MIT + Commons Clause; see ReactBits-LICENSE.md in this folder.
// https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Components/BorderGlow
// The product variant masks out the entire interior and uses no inner fill.
export function trackComposerGlow(event: PointerEvent<HTMLFormElement>) {
  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const form = event.currentTarget;
  const rect = form.getBoundingClientRect();
  const dx = event.clientX - rect.left - rect.width / 2;
  const dy = event.clientY - rect.top - rect.height / 2;
  const proximity = Math.min(1, Math.max(Math.abs(dx) / (rect.width / 2), Math.abs(dy) / (rect.height / 2)));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  form.style.setProperty("--composer-glow-angle", `${angle}deg`);
  form.style.setProperty("--composer-glow-strength", String(.5 + proximity * .4));
}

export function resetComposerGlow(event: PointerEvent<HTMLFormElement>) {
  event.currentTarget.style.removeProperty("--composer-glow-strength");
}

export function ComposerBorderGlow() {
  return <span className="composer-border-glow" aria-hidden="true">
    <span className="composer-border-glow__halo" />
    <span className="composer-border-glow__edge" />
  </span>;
}
