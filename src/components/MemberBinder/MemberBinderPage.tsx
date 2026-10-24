import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppLocale } from "../../i18n/LocaleContext";
import type { AccountState } from "../RenaissHub/RenaissHubFeatures";
import { HubSiteHeader } from "../RenaissHub/HubSiteHeader";
import {
  startRenaissLogin,
  RENAISS_ACCOUNT_SETTINGS_URL,
} from "../../lib/renaissAuth";
import { binderCopy } from "./binderCopy";
import { useMemberBinder } from "./useMemberBinder";
import { BinderWorkspace } from "./BinderWorkspace";
import { BinderPractice, practiceCopy } from "./BinderPractice";
import { BinderWordmark } from "./BinderWordmark";
import { BinderAccount } from "./BinderAccount";
import { BinderViewControls } from "./BinderViewControls";
import { BinderToolsPanel } from "./BinderToolsPanel";
import { binderFonts } from "./binderAssets";
import "./MemberBinder.css";

export function MemberBinderPage({
  locale,
  setLocale,
  account,
  navigation,
  accountAction,
  onBack,
  onDirtyChange,
  onRetryAccount,
}: {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  account: AccountState;
  navigation: ReactNode;
  accountAction: ReactNode;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onRetryAccount: () => void;
}) {
  const copy = binderCopy[locale];
  const user =
    account.status === "ready" && account.session.authenticated
      ? account.session.user
      : null;
  const identity = user
    ? JSON.stringify([user.sub, user.safeWalletAddress])
    : "";
  const data = useMemberBinder(identity, user?.safeWalletAddress || "");
  const [help, setHelp] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsId = useId();
  const [practice, setPractice] = useState(
    () => new URLSearchParams(location.search).get("binderPractice") === "1",
  );
  const [generation, setGeneration] = useState(0);
  const root = useRef<HTMLElement>(null);
  const binder = data.binder;
  const ready = Boolean(user?.safeWalletAddress && binder && data.library);
  const canvas = ready || practice;
  const used = new Set(
    binder?.pages.flatMap((p) =>
      p.slots.filter((t): t is string => t !== null),
    ) || [],
  );
  useLayoutEffect(() => {
    scrollTo({ top: 0, behavior: "instant" });
    root.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const theme = document.querySelector('meta[name="theme-color"]');
    const color = theme?.getAttribute("content");
    const viewport = document.querySelector('meta[name="viewport"]');
    const viewportContent = viewport?.getAttribute("content");
    html.dataset.memberBinder = "true";
    theme?.setAttribute("content", "#0b0812");
    // Paint edge to edge; the canvas applies safe-area padding once, while the
    // book measures the remaining space instead of subtracting the insets twice.
    viewport?.setAttribute(
      "content",
      `width=device-width, initial-scale=1.0, viewport-fit=${canvas ? "cover" : "contain"}`,
    );
    return () => {
      delete html.dataset.memberBinder;
      if (color !== null && color !== undefined)
        theme?.setAttribute("content", color);
      if (viewportContent !== null && viewportContent !== undefined)
        viewport?.setAttribute("content", viewportContent);
    };
  }, [canvas]);
  useEffect(() => {
    const previous = document.title;
    document.title = copy.title + " | Renaiss";
    return () => {
      document.title = previous;
    };
  }, [copy.title]);
  useEffect(() => {
    onDirtyChange(data.dirty);
    return () => onDirtyChange(false);
  }, [data.dirty, onDirtyChange]);
  const locked = data.saving || data.saveError === "conflict";
  function showPractice(value: boolean) {
    setHelp(false);
    setToolsOpen(false);
    setPractice(value);
    const url = new URL(location.href);
    if (value) url.searchParams.set("binderPractice", "1");
    else url.searchParams.delete("binderPractice");
    history.replaceState(history.state, "", url);
  }
  function reload() {
    if (!data.dirty || confirm(copy.reloadConfirm)) {
      setGeneration((value) => value + 1);
      data.reload();
    }
  }
  const saveStatus = data.saveError
    ? data.saveError === "conflict"
      ? copy.conflict
      : copy.saveError
    : data.saving
      ? copy.saving
      : data.dirty
        ? copy.unsaved
        : data.persisted
          ? copy.saved
          : "";
  const header = (
    <HubSiteHeader
      brand={<BinderWordmark />}
      locale={locale}
      setLocale={setLocale}
      location={user ? `${user.name || "Renaiss"}'s Binder` : copy.title}
      onBack={onBack}
      navigation={navigation}
      accountAction={
        user ? (
          <BinderAccount user={user}>{accountAction}</BinderAccount>
        ) : (
          accountAction
        )
      }
    />
  );
  function renderTools(contents: ReactNode) {
    if (!canvas) return <div className="binder-site-chrome">{header}</div>;
    return (
      <BinderToolsPanel id={toolsId} header={header} onOpenChange={setToolsOpen}>
        {contents}
      </BinderToolsPanel>
    );
  }
  function renderMemberTools() {
    return (
      <>
        <div className="binder-toolbar">
          <span
            className="binder-inventory"
            title={`${copy.wallet} · ${new Date(data.library!.checkedAt).toLocaleString(locale)}`}
          >
            {data.library!.badges.length} {copy.available} · {used.size}{" "}
            {copy.placed}
          </span>
          <div className="binder-save">
            <button type="button" onClick={() => showPractice(true)}>
              {practiceCopy[locale].start}
            </button>
            <span role="status">{saveStatus}</span>
            <button
              type="button"
              onClick={() => void data.save()}
              disabled={!data.dirty || locked}
            >
              {data.saving ? copy.saving : copy.save}
            </button>
            <button type="button" onClick={reload} disabled={data.saving}>
              {data.saveError === "conflict" ? copy.reload : copy.refresh}
            </button>
          </div>
        </div>
        <button
          className="binder-help"
          type="button"
          aria-expanded={help}
          onClick={() => setHelp(!help)}
        >
          ⓘ <span>{copy.help}</span>
        </button>
        {help ? (
          <aside className="binder-help-panel">
            <button
              type="button"
              onClick={() => setHelp(false)}
              aria-label={copy.close}
            >
              ×
            </button>
            <h2>{copy.help}</h2>
            <p>{copy.helpBody}</p>
          </aside>
        ) : null}
      </>
    );
  }
  return (
    <main
      className={`member-binder member-binder-page${canvas ? " binder-canvas" : ""}${toolsOpen ? " binder-tools-open" : ""}`}
      lang={locale}
      ref={root}
      tabIndex={-1}
      aria-label={copy.title}
    >
      <style>{binderFonts}</style>
      {!practice ? renderTools(ready ? renderMemberTools() : null) : null}
      {practice ? (
        <BinderPractice
          locale={locale}
          renderTools={renderTools}
          onExit={() => showPractice(false)}
        />
      ) : account.status !== "ready" ? (
        <section className="binder-state" aria-live="polite">
          <p>{account.status === "error" ? copy.error : copy.loading}</p>
          {account.status === "error" ? (
            <button type="button" onClick={onRetryAccount}>
              {copy.retry}
            </button>
          ) : null}
        </section>
      ) : !user ? (
        <section className="binder-state">
          <h1>{copy.login}</h1>
          <p>{copy.loginBody}</p>
          <button type="button" onClick={() => startRenaissLogin("/#binder")}>
            {copy.login}
          </button>
        </section>
      ) : !user.safeWalletAddress ? (
        <section className="binder-state">
          <p>{copy.walletPending}</p>
          <a href={RENAISS_ACCOUNT_SETTINGS_URL}>{copy.login}</a>
        </section>
      ) : !ready ? (
        <section className="binder-state" aria-live="polite">
          <p>{data.status === "error" ? copy.error : copy.loading}</p>
          {data.status === "error" ? (
            <button type="button" onClick={data.reload}>
              {copy.retry}
            </button>
          ) : null}
        </section>
      ) : (
        <BinderWorkspace
          key={generation}
          binder={binder!}
          badges={data.library!.badges}
          user={user}
          copy={copy}
          locked={locked}
          onChange={data.edit}
        />
      )}
      {canvas ? (
        <BinderViewControls
          locale={locale}
          toolsOpen={toolsOpen}
          toolsId={toolsId}
          dirty={!practice && data.dirty}
        />
      ) : null}
      {!ready && !practice ? (
        <div className="binder-practice-entry">
          <button type="button" onClick={() => showPractice(true)}>
            {practiceCopy[locale].start}
          </button>
        </div>
      ) : null}
    </main>
  );
}
