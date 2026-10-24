import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import {
  BAND_SEGMENTS,
  createElasticBand,
  elasticBandPath,
  stepElasticBand,
  type ElasticPull,
} from "./elasticBandPhysics";
import "./BinderElasticBand.css";

export type ElasticBandHandle = { release: (resume: () => void) => () => void };
export function BinderElasticBand({
  closed,
  label,
  onOpen,
  onBusyChange,
  ref,
}: {
  closed: boolean;
  label: string;
  onOpen: () => void;
  onBusyChange: (value: boolean) => void;
  ref: Ref<ElasticBandHandle>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const paths = useRef<SVGGElement>(null);
  const nodes = useRef(createElasticBand());
  const pull = useRef<ElasticPull | null>(null);
  const pointer = useRef<number | null>(null);
  const moved = useRef(false);
  const frame = useRef(0),
    last = useRef(0),
    timer = useRef(0);
  const current = useRef({ closed, onOpen, onBusyChange });
  current.current = { closed, onOpen, onBusyChange };
  const size = useRef({ width: 300, height: 500 });
  const [unfastening, setUnfastening] = useState(false);
  const releasing = useRef(false);
  const continuation = useRef<(() => void) | null>(null);
  const rawId = useId(),
    id = "band-" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const reduced = useRef(
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  function paint() {
    const { width, height } = size.current;
    const d = elasticBandPath(nodes.current, width * 0.88, height);
    paths.current
      ?.querySelectorAll("path")
      .forEach((path) => path.setAttribute("d", d));
    const gradient = svg.current?.querySelector("linearGradient");
    gradient?.setAttribute("x1", String(width * 0.88 - 9));
    gradient?.setAttribute("x2", String(width * 0.88 + 9));
  }
  function animate(now: number) {
    const moving = stepElasticBand(
      nodes.current,
      last.current ? Math.min(0.04, (now - last.current) / 1000) : 1 / 60,
      pull.current,
    );
    last.current = now;
    paint();
    if (moving || pull.current) frame.current = requestAnimationFrame(animate);
    else {
      frame.current = 0;
      last.current = 0;
    }
  }
  function wake() {
    if (!frame.current) frame.current = requestAnimationFrame(animate);
  }
  function cancelRelease() {
    clearTimeout(timer.current);
    releasing.current = false;
    continuation.current = null;
    setUnfastening(false);
    current.current.onBusyChange(false);
  }
  function release(resume: () => void) {
    if (releasing.current || !current.current.closed) return cancelRelease;
    releasing.current = true;
    pointer.current = null;
    pull.current = null;
    continuation.current = resume;
    setUnfastening(true);
    current.current.onBusyChange(true);
    timer.current = window.setTimeout(
      () => {
        flushSync(() => current.current.onBusyChange(false));
        if (current.current.closed) continuation.current?.();
      },
      reduced.current ? 0 : 280,
    );
    return cancelRelease;
  }
  useImperativeHandle(ref, () => ({ release }));
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const resize = new ResizeObserver(() => {
      size.current = { width: el.clientWidth, height: el.clientHeight };
      el.setAttribute(
        "viewBox",
        `0 0 ${size.current.width} ${size.current.height}`,
      );
      paint();
    });
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    cancelAnimationFrame(frame.current);
    clearTimeout(timer.current);
    frame.current = 0;
    last.current = 0;
    pull.current = null;
    pointer.current = null;
    nodes.current = createElasticBand();
    releasing.current = false;
    setUnfastening(!closed);
    paint();
    current.current.onBusyChange(false);
  }, [closed]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.current = media.matches;
    };
    const cancel = () => {
      pointer.current = null;
      pull.current = null;
      current.current.onBusyChange(false);
    };
    media.addEventListener("change", sync);
    window.addEventListener("blur", cancel);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("blur", cancel);
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
      current.current.onBusyChange(false);
    };
  }, []);
  function letGo(cancelled: boolean) {
    if (pointer.current === null) return;
    pointer.current = null;
    pull.current = null;
    current.current.onBusyChange(false);
    if (cancelled) moved.current = true;
    if (reduced.current) {
      nodes.current = createElasticBand();
      paint();
    } else wake();
  }
  return (
    <svg
      ref={svg}
      className={`binder-elastic-band ${unfastening ? "is-unfastening" : ""}`}
      aria-hidden={!closed}
    >
      <defs>
        <linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1="255"
          x2="273"
          y1="0"
          y2="0"
        >
          <stop offset="0" stopColor="#15141d" />
          <stop offset=".18" stopColor="#52434f" />
          <stop offset=".5" stopColor="#29202e" />
          <stop offset=".82" stopColor="#493a47" />
          <stop offset="1" stopColor="#100f17" />
        </linearGradient>
      </defs>
      <g ref={paths}>
        <path className="band-shadow" stroke="#0007" strokeWidth="24" />
        <path stroke={`url(#${id})`} strokeWidth="17" />
        <path
          className="band-weave"
          stroke="#c0a0b441"
          strokeWidth="13"
          strokeDasharray=".7 2.8"
        />
        <path className="band-stitch" stroke="#d1b5c02b" strokeWidth="1" />
        <path
          className="band-hit"
          stroke="transparent"
          strokeWidth="42"
          role="button"
          tabIndex={closed ? 0 : -1}
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              current.current.onOpen();
            }
          }}
          onPointerDown={(event) => {
            if (
              !closed ||
              releasing.current ||
              !event.isPrimary ||
              event.button !== 0
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = event.pointerId;
            moved.current = false;
            const rect = svg.current!.getBoundingClientRect();
            pull.current = {
              position: Math.max(
                0.06,
                Math.min(0.94, (event.clientY - rect.top) / rect.height),
              ),
              offset: 0,
            };
            current.current.onBusyChange(true);
            if (!reduced.current) wake();
          }}
          onPointerMove={(event) => {
            if (pointer.current !== event.pointerId || !pull.current) return;
            const rect = svg.current!.getBoundingClientRect();
            pull.current.offset = Math.max(
              -size.current.width * 0.42,
              Math.min(
                size.current.width * 0.35,
                ((event.clientX - rect.left) * size.current.width) /
                  rect.width -
                  size.current.width * 0.88,
              ),
            );
            if (Math.abs(pull.current.offset) > 3) moved.current = true;
            if (reduced.current) {
              nodes.current.forEach((node, i) => {
                node.offset =
                  i === 0 || i === BAND_SEGMENTS
                    ? 0
                    : pull.current!.offset *
                      Math.max(
                        0,
                        1 -
                          Math.abs(i / BAND_SEGMENTS - pull.current!.position) *
                            3,
                      );
              });
              paint();
            }
          }}
          onPointerUp={() => letGo(false)}
          onPointerCancel={() => letGo(true)}
          onLostPointerCapture={() => letGo(true)}
          onClick={(event) => {
            event.stopPropagation();
            if (!moved.current && !reduced.current && !releasing.current) {
              nodes.current.forEach((node, i) => {
                node.offset = -32 * Math.max(0, 1 - Math.abs(i - 12) / 5);
              });
              wake();
            }
          }}
        />
      </g>
    </svg>
  );
}
