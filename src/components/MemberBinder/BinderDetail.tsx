import { useEffect, useRef, useState } from "react";
import { isSampleCard, isPortraitCard, type BinderCollectible } from "./binderCollectible";
import { BinderCollectibleArt } from "./BinderCollectibleArt";
import type { BinderCopy } from "./binderCopy";
import type { RenaissUser } from "../../lib/renaissAuth";
import "./BinderDetail.css";

export function BinderDetail({
  badge,
  user,
  copy,
  onClose,
  onReplace,
  onRemove,
  practice = false,
}: {
  badge: BinderCollectible;
  user: RenaissUser;
  copy: BinderCopy;
  onClose: () => void;
  onReplace: () => void;
  onRemove: () => void;
  practice?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    art = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [entering, setEntering] = useState(true),
    [closing, setClosing] = useState(false);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const intro = setTimeout(() => setEntering(false), 850);
    return () => {
      clearTimeout(intro);
      clearTimeout(timer.current);
      node?.close();
    };
  }, []);
  function close(after = onClose) {
    if (closing) return;
    if (reduced) {
      after();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(after, 420);
  }
  const wallet = user.safeWalletAddress || "";
  return (
    <dialog
      ref={dialog}
      className={`binder-detail detail ${isPortraitCard(badge) ? "sample-card" : "sbt"} on ${closing ? "closing" : ""}`}
      aria-label={copy.detail}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <button
        className="d-close"
        type="button"
        aria-label={copy.close}
        onClick={() => close()}
      >
        ×
      </button>
      <div className="d-wrap">
        <div
          className="d-card"
          onPointerMove={(event) => {
            if (reduced || entering || closing || !art.current) return;
            const rect = art.current.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width,
              y = (event.clientY - rect.top) / rect.height;
            art.current.style.transform = `rotateY(${(x - 0.5) * 16}deg) rotateX(${(0.5 - y) * 16}deg)`;
          }}
          onPointerLeave={() => {
            art.current?.style.removeProperty("transform");
          }}
        >
          <div ref={art} className={`d-card-inner ${entering ? "enter" : ""}`}>
            <BinderCollectibleArt item={badge} />
            <div className="d-glare" />
          </div>
        </div>
        <div className="d-info">
          <span className="d-setline">
            {practice ? copy.practice : badge.card ? [badge.card.gradingCompany, badge.card.grade].filter(Boolean).join(" · ") : "Soulbound"}
          </span>
          <h2 className="d-name">{badge.name}</h2>
          <div className="d-ownerrow">
            <div className="d-owner">
              <span className="d-owner-av">
                {user.picture ? (
                  <img src={user.picture} alt="" />
                ) : (
                  user.name?.charAt(0)
                )}
              </span>
              <span className="d-cell">
                <span className="d-lbl">
                  {practice ? copy.title : copy.ownedBy}
                </span>
                <span className="d-val">{user.name}</span>
              </span>
            </div>
            <span className="d-cell">
              <span className="d-lbl">
                {practice ? copy.practice : copy.address}
              </span>
              <span className="d-val" title={wallet}>
                {practice
                  ? copy.sampleOnly
                  : `${wallet.slice(0, 6)}…${wallet.slice(-4)}`}
              </span>
            </span>
            <span className="d-cell">
              <span className="d-lbl">{copy.tokenId}</span>
              <span className="d-val" title={badge.card?.tokenId}>{isSampleCard(badge) ? `SAMPLE-${String(badge.sampleCard.edition).padStart(3, "0")}` : badge.card ? `${badge.card.tokenId.slice(0,8)}…${badge.card.tokenId.slice(-6)}` : `SBT-${badge.tokenId}`}</span>
            </span>
          </div>
          <div className="d-sbt-about">
            <p className="d-sbt-desc">{badge.description}</p>
            {badge.howToEarn ? (
              <div className="d-sbt-earn">
                <span className="d-lbl">{copy.howToEarn}</span>
                <span className="d-sbt-earn-val">{badge.howToEarn}</span>
              </div>
            ) : null}
          </div>
          <div className="d-actions">
            <button
              className="d-remove"
              type="button"
              onClick={() => close(onReplace)}
            >
              {copy.replace} →
            </button>
            <button
              className="d-remove"
              type="button"
              onClick={() => close(onRemove)}
            >
              {copy.remove} →
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
