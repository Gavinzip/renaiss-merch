import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { appLanguages as languages, type AppLocale } from '../../i18n/LocaleContext';
import './HubLanguageMenu.css';

export function HubLanguageMenu({ locale, setLocale }: {
  locale: AppLocale; setLocale: (locale: AppLocale) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [active, setActive] = useState(0);
  const open = phase === 'open';
  const language = languages.find(language => language.value === locale)!;
  const label = language.menuLabel;

  function show() {
    setActive(languages.findIndex(language => language.value === locale));
    setPhase('open');
  }
  function close(restoreFocus = false) {
    setPhase('closing');
    if (restoreFocus) trigger.current?.focus();
  }
  useEffect(() => {
    if (phase === 'open') options.current[active]?.focus();
    if (phase !== 'closing' || !root.current) return;
    const duration = getComputedStyle(root.current).getPropertyValue('--dropdown-close-dur').trim();
    const milliseconds = parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000);
    if (!Number.isFinite(milliseconds)) throw new Error('Missing language menu transition duration');
    const timer = window.setTimeout(() => setPhase('closed'), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : milliseconds);
    return () => window.clearTimeout(timer);
  }, [phase, active]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); close(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? languages.length - 1 :
        (active + (event.key === 'ArrowDown' ? 1 : -1) + languages.length) % languages.length;
      setActive(next);
    }
  }

  return <div className="hub-language" ref={root} onKeyDown={keyDown} onBlur={event => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  }}>
    <button className="hub-language__trigger" ref={trigger} type="button" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => open ? close(true) : show()}>
      <span>{language.shortLabel}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6 3 3 3-3" /></svg>
    </button>
    <div id={id} className={`hub-language__list t-dropdown${open ? ' is-open' : phase === 'closing' ? ' is-closing' : ''}`}
      data-origin="top-right" data-phase={phase} role="listbox" aria-label={label} aria-hidden={!open} inert={!open}>
      {languages.map((language, index) => <button key={language.value} ref={element => { options.current[index] = element; }}
        className="hub-language__option" type="button" role="option" aria-selected={locale === language.value}
        tabIndex={open && active === index ? 0 : -1} lang={language.value} onFocus={() => setActive(index)}
        onClick={() => { setLocale(language.value); close(true); }}>
        <span>{language.label}</span>
        {locale === language.value ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg> : null}
      </button>)}
    </div>
  </div>;
}
