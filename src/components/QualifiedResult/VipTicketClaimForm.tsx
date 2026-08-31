import { type FormEvent, useEffect, useState } from 'react';
import {
  readStoredVipTicketClaim,
  submitVipTicketClaim,
  VipTicketClaimError
} from '../../lib/vipTicketClaim';

const emailInputPattern = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';
const generalTicketUrl = 'https://luma.com/event/evt-ZDncLzQG00j3dqY';

type TicketClaimState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'submitted'
  | 'error';

type VipTicketClaimFormProps = {
  claimName: string;
  minimumSbtBalance: number;
};

export function VipTicketClaimForm({
  claimName,
  minimumSbtBalance
}: VipTicketClaimFormProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<TicketClaimState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    void readStoredVipTicketClaim()
      .then((storedClaim) => {
        if (cancelled) {
          return;
        }

        if (storedClaim.claim) {
          setEmail(storedClaim.claim.email);
          setState('submitted');
          return;
        }

        setState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('目前無法讀取 VIP 票券登記狀態，請稍後再試。');
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state === 'submitting' || state === 'submitted') {
      return;
    }

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }

    setErrorMessage('');
    setState('submitting');

    try {
      const response = await submitVipTicketClaim(email);
      setEmail(response.claim?.email || email.trim().toLowerCase());
      setState('submitted');
    } catch (error) {
      setErrorMessage(readClaimErrorMessage(error));
      setState('error');
    }
  }

  const isSubmitted = state === 'submitted';
  const isSubmitting = state === 'submitting';

  return (
    <form
      aria-label={`Email registration for ${claimName}`}
      className="qualified-result__shipping qualified-result__ticket-claim"
      onSubmit={handleSubmit}
    >
      <p className="qualified-result__eyebrow">VIP claim</p>
      <h2>領取 VIP 票</h2>
      <p>
        {isSubmitted
          ? 'VIP 票券登記已送出，這個信箱已鎖定。'
          : `${minimumSbtBalance} SBT 資格已通過。請填寫當初登記一般票時使用的信箱。`}
      </p>

      <div className="qualified-result__ticket-instruction" role="note">
        <strong>申請 VIP 票前，請先領取一般票</strong>
        <p>
          如果尚未申請一般票，請先
          <a
            href={generalTicketUrl}
            rel="noreferrer"
            target="_blank"
          >
            申請並領取一般票
          </a>
          ；領取完成後，再回到這裡申請 VIP 票，並提供當初登記一般票時使用的信箱。
        </p>
      </div>

      <fieldset
        className="qualified-result__fields"
        disabled={state === 'loading' || isSubmitting || isSubmitted}
      >
        <label className="qualified-result__field-wide">
          當初登記一般票時使用的信箱
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            pattern={emailInputPattern}
            placeholder="name@example.com"
            required
            title="請輸入完整的信箱，例如 name@example.com。"
            type="email"
            value={email}
          />
        </label>
      </fieldset>

      {!isSubmitted ? (
        <div className="qualified-result__actions">
          <button disabled={state === 'loading' || isSubmitting} type="submit">
            {isSubmitting ? '送出中' : '確認領取 VIP 票'}
          </button>
        </div>
      ) : null}

      <p
        className={`qualified-result__submit-status qualified-result__submit-status--${state}`}
        role="status"
      >
        {isSubmitted
          ? `已登記：${email}`
          : state === 'loading'
            ? '正在讀取登記狀態。'
            : errorMessage}
      </p>
    </form>
  );
}

function readClaimErrorMessage(error: unknown) {
  if (!(error instanceof VipTicketClaimError)) {
    return 'VIP 票券登記失敗，請稍後再試。';
  }

  switch (error.code) {
    case 'email_invalid':
      return '請輸入完整的信箱，例如 name@example.com。';
    case 'vip_ticket_claim_already_submitted':
      return '這個錢包已完成 VIP 票券登記。';
    case 'wallet_not_eligible':
      return '這個錢包目前沒有 VIP 票券領取資格。';
    default:
      return 'VIP 票券登記失敗，請稍後再試。';
  }
}
