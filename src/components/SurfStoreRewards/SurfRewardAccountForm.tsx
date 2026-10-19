import { useId, useLayoutEffect, useState, type FormEvent } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import type { SurfActiveStoreReward } from '../../../shared/surf-store-rewards.js';
import { surfPreviewLogoUrl } from '../RenaissHub/hubPreviewAssets';
import { SurfRewardFacts } from './SurfRewardFacts';
import { surfAccountCopy } from './surfAccountCopy';
import { useElementPresence } from '../../hooks/useElementPresence';
import './SurfRewardControls.css';
import './SurfRewardAccountForm.css';
import { useSurfStoreClaim } from './useSurfStoreClaim';
import { useSurfStoreInventory } from './SurfStoreInventoryContext';

type Props = {
  reward: SurfActiveStoreReward;
  title: string;
  description: string;
  showLogo?: boolean;
  className?: string;
  open?: boolean;
  onHidden?: () => void;
};
// The title was last to leave in the old 880 ms reverse stagger. Clear every
// leaf within 120 ms so the returning card cannot cross lingering text.
const ACCOUNT_EXIT_TIMING = { duration: 90, stagger: 5, maxDelay: 30 };

export function SurfRewardAccountForm({ reward, title, description, showLogo = true, className = '', open = true, onHidden }: Props) {
  const { locale } = useLocale();
  const copy = surfAccountCopy[locale];
  const presence = useElementPresence<HTMLFormElement>(open, ACCOUNT_EXIT_TIMING);
  const id = useId();
  const [gmail, setGmail] = useState('');
  const [touched, setTouched] = useState(false);
  const claim = useSurfStoreClaim(reward.id, open);
  const valid = /^[a-z0-9][a-z0-9.+_-]*@gmail\.com$/i.test(gmail.trim());
  const error = touched && !valid ? (gmail.trim() ? copy.gmailInvalid : copy.gmailRequired) : '';
  const serverError = claim.error ? copy.errors[claim.error as keyof typeof copy.errors] || copy.failed : '';
  const submitted = claim.data?.claim;
  const inventory = useSurfStoreInventory();
  const stock = inventory.rewards[reward.id];
  const soldOut = stock?.soldOut || claim.error === 'surf_sold_out';
  const stockReady = inventory.status === 'ready' && !!stock;

  useLayoutEffect(() => {
    if (!open && presence.phase === 'hidden') onHidden?.();
  }, [open, presence.phase, onHidden]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (valid && !claim.loading && !claim.submitting && claim.data && stockReady && !submitted && !soldOut) {
      void claim.submit(gmail.trim().toLowerCase());
    }
  }

  return (
    <form ref={presence.ref} className={`surf-reward-account ${className}`} data-open={open}
      data-presence={presence.phase} aria-hidden={!open} inert={!open} onSubmit={handleSubmit} noValidate>
      {showLogo ? <img data-motion-item className="surf-reward-account__logo" src={surfPreviewLogoUrl()} width={400} height={400} alt="Surf" /> : null}
      <h2 data-motion-item id={`${id}-title`} tabIndex={-1}>{title}</h2>
      <p data-motion-item className="surf-reward-account__description">{description}</p>
      <SurfRewardFacts reward={reward} animate inventory={stock} inventoryStatus={inventory.status} />
      <section className="surf-reward-account__field">
        <label data-motion-item htmlFor={`${id}-gmail`}>{copy.gmail}</label>
        <input
          data-motion-item
          id={`${id}-gmail`} name="surfGmail" type="email" inputMode="email"
          autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required
          placeholder="yourname@gmail.com" value={submitted?.gmail ?? gmail}
          disabled={claim.loading || claim.submitting || !stockReady || !!submitted || !!soldOut}
          aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={event => setGmail(event.target.value)}
          onBlur={() => { setTouched(true); setGmail(value => value.trim().toLowerCase()); }}
        />
        <p data-motion-item id={`${id}-hint`} className="surf-reward-account__hint">{copy.gmailHint}</p>
        {error ? <p data-motion-item id={`${id}-error`} className="surf-reward-account__error" role="alert">{error}</p> : null}
      </section>
      <button data-motion-item className="surf-reward-account__submit" type="submit"
        disabled={claim.loading || claim.submitting || !claim.data || !stockReady || !!submitted || !!soldOut}>
        {claim.submitting ? copy.submitting : submitted ? copy.submittedButton : soldOut ? copy.soldOut : claim.loading || inventory.status === 'loading' ? copy.loading : copy.submit}
      </button>
      {submitted ? <p data-motion-item className="surf-reward-account__hint" role="status">{copy.submitted}</p> : null}
      {serverError ? <p data-motion-item className="surf-reward-account__error" role="alert">{serverError}</p> : null}
      {inventory.status === 'error' ? <p data-motion-item className="surf-reward-account__error" role="alert">{copy.inventoryFailed}</p> : null}
      {claim.error || inventory.status === 'error' ? <button data-motion-item type="button"
        onClick={() => { claim.retry(); void inventory.refresh(); }} disabled={claim.submitting}>{copy.retry}</button> : null}
      <p data-motion-item className="surf-reward-account__note">{copy.note}</p>
    </form>
  );
}
