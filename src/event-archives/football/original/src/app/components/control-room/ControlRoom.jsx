import { ChevronDown, Home, Medal } from 'lucide-react';
import { useState } from 'react';
import { Magnet } from '../Magnet';
import { useCampaignCopy } from '../../i18n/useCampaignCopy';
const viewIcons = { home: Home, winners: Medal };
function ViewMenu({ activeViewId, id, onSelectView, t, views, winnersAlert = false }) {
  const activeIndex = Math.max(0, views.findIndex((view) => view.id === activeViewId));


  return (
    <menu className="command-menu pill-nav" id={id} aria-label={t("nav.aria")} data-active-index={activeIndex} data-view-count={views.length}>
      <span className="command-menu__indicator" aria-hidden="true" />
      {views.map((view) => {
        const Icon = viewIcons[view.id];
        const hasAlert = winnersAlert && view.id === "winners";
        return (
          <li key={view.id}>
            <Magnet
              as="button"
              className={[
                activeViewId === view.id ? "is-active" : "",
                hasAlert ? "has-alert" : "",
              ].filter(Boolean).join(" ")}
              type="button"
              strength={72}
              aria-current={activeViewId === view.id ? "page" : undefined}
              aria-label={hasAlert ? `${t(`nav.${view.id}`)} · ${t("winnerReveal.navAlert")}` : undefined}
              onClick={() => onSelectView(view.id)}
            >
              <Icon size={15} strokeWidth={2.1} />
              <span>{t(`nav.${view.id}`)}</span>
            </Magnet>
          </li>
        );
      })}
    </menu>
  );
}


function LanguageSwitch() {
  const { locale, locales, setLocale, t } = useCampaignCopy();
  const [open, setOpen] = useState(false);
  const activeOption = locales.find((option) => option.id === locale) ?? locales[0];
  const shortLabel = (option) => ({
    "zh-Hant": "CN",
    en: "EN",
    ko: "KR",
  })[option.id] ?? option.label;

  function handleSelect(nextLocale) {
    setLocale(nextLocale);
    setOpen(false);
  }

  return (
    <div
      className={open ? "language-switch language-switch--select language-switch--popover is-open" : "language-switch language-switch--select language-switch--popover"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        className="language-switch__trigger"
        type="button"
        aria-label={t("language.toggle")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{shortLabel(activeOption)}</span>
        <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {open ? (
        <menu className="language-switch__menu" role="menu" aria-label={t("language.label")}>
          {locales.map((option) => {
            const active = option.id === locale;
            return (
              <li key={option.id}>
                <button
                  className={active ? "is-active" : ""}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => handleSelect(option.id)}
                >
                  <span>{shortLabel(option)}</span>
                </button>
              </li>
            );
          })}
        </menu>
      ) : null}
    </div>
  );
}


export { ViewMenu, LanguageSwitch };
