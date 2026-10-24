import { useMemo, type CSSProperties } from "react";

export function BinderPocketShine() {
  const sparks = useMemo(() => Array.from({ length: 5 }, () => ({
    left: 14 + 72 * Math.random(), top: 14 + 72 * Math.random(),
    size: 5 + 6 * Math.random(), delay: 300 * Math.random(),
  })), []);
  return <>
    <span className="bnd-slot-shine" aria-hidden="true" />
    {sparks.map((spark, index) => <span key={index}
      className="bnd-slot-spark" aria-hidden="true"
      style={{ left: `${spark.left}%`, top: `${spark.top}%`,
        "--sz": `${spark.size}px`, animationDelay: `${spark.delay}ms`,
      } as CSSProperties}
    />)}
  </>;
}
