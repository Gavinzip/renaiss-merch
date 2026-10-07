"use client";

// Adapted from agent-ui's local Loading State (MIT; see LICENSE.txt).
// Mount only while a real request is pending. No simulated work stages.
import { useEffect, useState } from "react";
import "./LoadingState.css";

const delays = /* @__PURE__ */ Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  return (index % 3 + Math.abs(row - 1)) * 90;
});

export function LoadingState({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds((Date.now() - started) / 1000), 100);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
  return <div className="assistant-working" role="status" aria-live="polite">
    <span className="assistant-working__grid" aria-hidden="true">{delays.map((delay, index) => <i key={index} style={{ animationDelay: `${delay}ms` }} />)}</span>
    <span className="assistant-working__label">{label}</span>
    <span className="assistant-working__elapsed" aria-hidden="true">{elapsed}</span>
  </div>;
}
