import { useEffect, useRef, useState } from "react";
import type { BinderBadge } from "./binderApi";
import type { BinderCopy } from "./binderCopy";

export function BinderPicker({
  badges,
  used,
  current,
  copy,
  onSelect,
  onClose,
}: {
  badges: BinderBadge[];
  used: Set<string>;
  current: string | null;
  copy: BinderCopy;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [hideAdded, setHideAdded] = useState(true);
  const [failed, setFailed] = useState(new Set<string>());
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const matches = badges
    .filter(
      (badge) =>
        (!hideAdded || !used.has(badge.tokenId) || badge.tokenId === current) &&
        (badge.name + " " + badge.description)
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <dialog
      ref={dialog}
      className="member-binder-picker"
      aria-labelledby="binder-picker-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <div className="member-binder-picker__header">
        <div>
          <h2 id="binder-picker-title">{copy.choose}</h2>
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label={copy.close}
        >
          ×
        </button>
      </div>
      <div className="member-binder-picker__search">
        <input
          type="search"
          placeholder={copy.search}
          aria-label={copy.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={matchMedia("(pointer: fine)").matches}
        />
      </div>
      <div className="member-binder-picker__tools">
        <label>
          <input
            type="checkbox"
            checked={hideAdded}
            onChange={(event) => setHideAdded(event.target.checked)}
          />
          {copy.hideAdded}
        </label>
        <span>{matches.length} SBT</span>
      </div>
      <div className="member-binder-picker__scroll">
        {current !== null ? (
          <button
            className="member-binder-picker__remove"
            type="button"
            onClick={() => onSelect(null)}
          >
            {copy.remove}
          </button>
        ) : null}
        <div className="member-binder-picker__grid">
          {matches.map((badge) => (
            <button
              type="button"
              key={badge.tokenId}
              disabled={
                failed.has(badge.tokenId) ||
                (used.has(badge.tokenId) && badge.tokenId !== current)
              }
              aria-label={badge.name}
              aria-pressed={current === badge.tokenId}
              onClick={() => onSelect(badge.tokenId)}
            >
              <img
                src={badge.imageUrl}
                alt=""
                loading="lazy"
                width="150"
                height="150"
                onError={() =>
                  setFailed((value) => new Set(value).add(badge.tokenId))
                }
              />
              <span>{badge.name}</span>
              {failed.has(badge.tokenId) ? (
                <small role="alert">{copy.error}</small>
              ) : null}
            </button>
          ))}
        </div>
        {!matches.length ? (
          <p className="member-binder-picker__empty">
            {badges.length ? copy.empty : copy.noBadges}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
