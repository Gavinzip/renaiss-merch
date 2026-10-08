import { useEffect, useRef, useState } from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import { hubAssetUrl } from "../../lib/hubAssets";
import { HubMotionText } from "./HubMotionText";

export function HubMerchHero({
  locale,
  eyebrow,
}: {
  locale: AppLocale;
  eyebrow: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const playhead = useRef(0);
  const mounted = useRef(true);
  const generation = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  generation.current = attempt;

  useEffect(() => {
    mounted.current = true;
    const element = container.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      const widthScale = entry.contentRect.width / 960;
      const heightScale = entry.contentRect.height / 540;
      element.style.setProperty(
        "--hero-scale",
        String(Math.max(widthScale, heightScale)),
      );
      // The overview fits the complete composition inside its shorter hero.
      element.style.setProperty("--hero-fit-scale", String(Math.min(widthScale, heightScale)));
    });
    resize.observe(element);
    const observer = new IntersectionObserver(
      ([entry]) =>
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.1),
      { threshold: 0.1 },
    );
    observer.observe(element);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(media.matches);
    const onVisibility = () => setPageVisible(!document.hidden);
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      resize.disconnect();
      observer.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (phase !== "loading" || !pageVisible) return;
    const timeout = window.setTimeout(() => setPhase("error"), 15_000);
    return () => window.clearTimeout(timeout);
  }, [phase, attempt, pageVisible]);

  const playing =
    phase === "ready" && visible && pageVisible && !reducedMotion;
  useEffect(() => {
    const camera = image.current;
    if (!playing || !camera) return;
    let request = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      playhead.current =
        (playhead.current + Math.min((now - previous) / 1000, 0.1)) % 8;
      previous = now;
      // The reviewed 8-second sine camera push / return: 1 → 1.02 → 1.
      const scale = 1 + .01 * (1 - Math.cos(2 * Math.PI * playhead.current / 8));
      camera.style.transform = `scale(${scale})`;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing]);

  async function prepare() {
    const activeAttempt = attempt;
    try {
      const camera = image.current;
      if (!camera) throw new Error("hero_image_missing");
      await camera.decode();
      camera.style.transform = 'scale(1)';
      // Decode the first image without waiting for a paint in background tabs.
      if (mounted.current && generation.current === activeAttempt) {
        playhead.current = 0;
        setPhase("ready");
      }
    } catch {
      if (mounted.current && generation.current === activeAttempt)
        setPhase("error");
    }
  }

  const zh = locale === "zh-TW";
  return (
    <div
      className="renaiss-hub__merch-visual hub-merch-hero"
      ref={container}
      data-phase={phase}
      data-playing={playing}
    >
      <div className="hub-merch-hero__scene">
        <img
          key={attempt}
          ref={image}
          className="hub-merch-hero__camera"
          src={hubAssetUrl('sealedBoxHero')}
          width={960}
          height={540}
          alt={zh ? "Renaiss 封盒循環展示" : "Renaiss sealed edition loop"}
          decoding="async"
          onLoad={() => { void prepare(); }}
          onError={() => setPhase("error")}
        />
      </div>
      <span className="hub-widget-title hub-merch-hero__title"><HubMotionText>{eyebrow}</HubMotionText></span>
      {phase === "loading" ? (
        <span className="hub-merch-hero__message" role="status">
          {zh ? "準備展示…" : "Preparing the edition…"}
        </span>
      ) : phase === "error" ? (
        <div className="hub-merch-hero__message" role="alert">
          <span>{zh ? "展示無法載入" : "The hero could not be loaded"}</span>
          <button
            type="button"
            onClick={() => {
              setPhase("loading");
              setAttempt((value) => value + 1);
            }}
          >
            {zh ? "再試一次" : "Try again"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
