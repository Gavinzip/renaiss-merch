import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { returnToHub } from './hubReturnMotion';
import './HubReturnButton.css';

const returningLabels = { 'zh-TW': '正在返回', 'zh-Hant': '正在返回', en: 'Returning…', ko: '돌아가는 중' };

export function HubReturnButton({ href, locale, children, className = '' }) {
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    const reset = () => setReturning(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  function handleClick(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    if (returning) return;
    setReturning(true);
    void returnToHub(href);
  }

  return <a className={'hub-return-button ' + className} href={href} onClick={handleClick}
    aria-label={children} aria-disabled={returning || undefined} data-returning={returning}>
    <span className="hub-return-button__arrow" aria-hidden="true"><ArrowLeft size={16} strokeWidth={1.8}/></span>
    <span className="hub-return-button__label">{returning ? returningLabels[locale] : children}</span>
  </a>;
}
