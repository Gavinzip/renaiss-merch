import { useLayoutEffect, useState, type ReactNode } from "react";
import {
  BINDER_MAX_PAGES,
  type BinderPage,
  type MemberBinder,
} from "../../../shared/member-binder.js";
import type { RenaissUser } from "../../lib/renaissAuth";
import type { BinderCollectible } from "./binderCollectible";
import type { BinderCopy } from "./binderCopy";
import { BinderBook, type PocketTarget } from "./BinderBook";
import { BinderDetail } from "./BinderDetail";
import { BinderPicker } from "./BinderPicker";
import { pocketKey, useBinderPocketMotion } from "./useBinderPocketMotion";

// Real collections and the explicitly selected practice use the same book,
// pocket editing and animation. Only their data and persistence owners differ.
export function BinderWorkspace({
  viewControls,
  binder,
  badges,
  user,
  copy,
  locked = false,
  practice = false,
  onChange,
  onMotionBusyChange,
}: {
  viewControls: ReactNode;
  binder: MemberBinder;
  badges: BinderCollectible[];
  user: RenaissUser;
  copy: BinderCopy;
  locked?: boolean;
  practice?: boolean;
  onChange: (binder: MemberBinder) => void;
  onMotionBusyChange?: (busy: boolean) => void;
}) {
  const [picker, setPicker] = useState<PocketTarget | null>(null);
  const [detail, setDetail] = useState<{ target: PocketTarget; item: BinderCollectible } | null>(null);
  const library = new Map(badges.map((b) => [b.tokenId, b]));
  const used = new Set(
    binder.pages.flatMap((p) => p.slots.filter((t): t is string => t !== null)),
  );
  const pickerPage = binder.pages.find((p) => p.id === picker?.page);
  const pocketMotion = useBinderPocketMotion((target, expectedToken) => {
    editPage(target.page, (page) => ({ ...page, slots: page.slots.map((token, index) =>
      index === target.pocket && token === expectedToken ? null : token),
    }));
  });
  const motionBusy = pocketMotion.leaving.size > 0;
  useLayoutEffect(() => {
    onMotionBusyChange?.(motionBusy);
    return () => onMotionBusyChange?.(false);
  }, [motionBusy, onMotionBusyChange]);
  function editPage(id: string, update: (page: BinderPage) => BinderPage) {
    if (!locked)
      onChange({
        ...binder,
        pages: binder.pages.map((p) => (p.id === id ? update(p) : p)),
      });
  }
  function choose(target: PocketTarget, token: string | null) {
    if (pocketMotion.leaving.has(pocketKey(target))) return;
    editPage(target.page, (p) => ({
      ...p,
      slots: p.slots.map((v, i) => (i === target.pocket ? token : v)),
    }));
  }
  function remove(target: PocketTarget) {
    if (locked) return;
    const token = binder.pages.find((page) => page.id === target.page)?.slots[target.pocket];
    if (token) pocketMotion.remove(target, token);
  }
  function move(from: PocketTarget, to: PocketTarget) {
    if (locked || pocketMotion.leaving.has(pocketKey(from)) ||
      pocketMotion.leaving.has(pocketKey(to)) ||
      (from.page === to.page && from.pocket === to.pocket)) return;
    const source = binder.pages.find((p) => p.id === from.page),
      target = binder.pages.find((p) => p.id === to.page);
    if (
      !source ||
      !target ||
      from.pocket < 0 ||
      from.pocket >= source.size ||
      to.pocket < 0 ||
      to.pocket >= target.size ||
      !source.slots[from.pocket]
    )
      return;
    onChange({
      ...binder,
      pages: binder.pages.map((p) => ({
        ...p,
        slots: p.slots.map((token, i) =>
          p.id === from.page && i === from.pocket
            ? target.slots[to.pocket]
            : p.id === to.page && i === to.pocket
              ? source.slots[from.pocket]
              : token,
        ),
      })),
    });
  }
  return (
    <div className={`binder-workspace ${picker ? "picking" : ""}`}>
      <BinderBook
        viewControls={viewControls}
        binder={binder}
        badges={badges}
        user={user}
        copy={copy}
        disabled={locked}
        picking={picker}
        onWriting={(writing) => {
          if (!locked) onChange({ ...binder, writing });
        }}
        onPocket={setPicker}
        onDetail={(target) => {
          const token = binder.pages.find((p) => p.id === target.page)?.slots[target.pocket];
          const item = token ? library.get(token) : undefined;
          if (item) setDetail({ target, item });
        }}
        onMove={move}
        onEmpty={remove}
        leaving={pocketMotion.leaving}
        onLayout={(id, size) => {
          const page = binder.pages.find((p) => p.id === id);
          if (
            !page ||
            locked ||
            (page.slots.slice(size).some(Boolean) &&
              !confirm(copy.layoutConfirm))
          )
            return;
          editPage(id, (p) => ({
            ...p,
            size,
            slots: Array.from({ length: size }, (_, i) => p.slots[i] ?? null),
          }));
        }}
        onRemove={(id) => {
          const page = binder.pages.find((p) => p.id === id);
          if (
            !page ||
            locked ||
            binder.pages.length <= 1 ||
            ((page.slots.some(Boolean) ||
              binder.writing?.["page:" + id]?.length) &&
              !confirm(copy.removeConfirm))
          )
            return;
          onChange({
            ...binder,
            pages: binder.pages.filter((p) => p.id !== id),
            ...(binder.writing
              ? {
                  writing: Object.fromEntries(
                    Object.entries(binder.writing).filter(
                      ([surface]) => surface !== "page:" + id,
                    ),
                  ),
                }
              : {}),
          });
        }}
        onAdd={() => {
          if (locked || binder.pages.length >= BINDER_MAX_PAGES) return;
          onChange({
            ...binder,
            pages: [
              ...binder.pages,
              { id: crypto.randomUUID(), size: 9, slots: Array(9).fill(null) },
            ],
          });
        }}
      />
      {picker && pickerPage ? (
        <BinderPicker
          badges={badges}
          used={used}
          current={pickerPage.slots[picker.pocket]}
          copy={copy}
          onClose={() => setPicker(null)}
          onSelect={(token) => {
            choose(picker, token);
            setPicker(null);
          }}
        />
      ) : null}
      {detail ? (
        <BinderDetail
          badge={detail.item}
          user={user}
          copy={copy}
          practice={practice}
          onClose={() => setDetail(null)}
          onReplace={() => {
            setDetail(null);
            setPicker(detail.target);
          }}
          onRemove={() => {
            remove(detail.target);
          }}
        />
      ) : null}
    </div>
  );
}
