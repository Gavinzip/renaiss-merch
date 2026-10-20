import { usePokemon30I18n } from "../i18n/Pokemon30I18n";

const LANGUAGE_NAME_KEYS = {
  "zh-TW": "traditionalChinese",
  en: "english",
  ko: "korean",
};

export function LanguageSelector() {
  const { locale, localeMeta, locales, setLocale, t } = usePokemon30I18n();

  return (
    <div className="pokemon-language-selector" aria-label={t("language.switcher")}>
      {locales.map((nextLocale) => {
        const active = locale === nextLocale;
        const label = localeMeta[nextLocale].label;
        const languageName = t(`language.names.${LANGUAGE_NAME_KEYS[nextLocale]}`);

        return (
          <button
            aria-label={active ? t("language.current", { language: languageName }) : t("language.select", { language: languageName })}
            aria-pressed={active}
            className={active ? "is-active" : ""}
            key={nextLocale}
            onClick={() => setLocale(nextLocale)}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
