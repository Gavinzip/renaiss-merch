import { type FormEvent, useEffect, useState } from 'react';
import {
  readStoredVipTicketClaim,
  submitVipTicketClaim,
  VipTicketClaimError
} from '../../lib/vipTicketClaim';
import { useLocale, type AppLocale } from '../../i18n/LocaleContext';

const emailInputPattern = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';
const generalTicketUrl = 'https://luma.com/event/evt-ZDncLzQG00j3dqY';

type TicketClaimState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'submitted'
  | 'error';

type TicketClaimErrorCode =
  | 'read_failed'
  | 'email_invalid'
  | 'vip_ticket_claim_already_submitted'
  | 'wallet_not_eligible'
  | 'unknown';

type VipTicketClaimFormProps = {
  claimName: string;
  minimumSbtBalance: number;
};

export function VipTicketClaimForm({
  claimName,
  minimumSbtBalance
}: VipTicketClaimFormProps) {
  const { locale } = useLocale();
  const copy = ticketCopy[locale];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<TicketClaimState>('loading');
  const [errorCode, setErrorCode] =
    useState<TicketClaimErrorCode | null>(null);

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
          setErrorCode('read_failed');
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

    setErrorCode(null);
    setState('submitting');

    try {
      const response = await submitVipTicketClaim(email);
      setEmail(response.claim?.email || email.trim().toLowerCase());
      setState('submitted');
    } catch (error) {
      setErrorCode(readClaimErrorCode(error));
      setState('error');
    }
  }

  const isSubmitted = state === 'submitted';
  const isSubmitting = state === 'submitting';

  return (
    <form
      aria-label={copy.formLabel(claimName)}
      className="qualified-result__shipping qualified-result__ticket-claim"
      onSubmit={handleSubmit}
    >
      <p className="qualified-result__eyebrow">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <p>
        {isSubmitted
          ? copy.submittedDescription
          : copy.description(minimumSbtBalance)}
      </p>

      <div className="qualified-result__ticket-instruction" role="note">
        <strong>{copy.instructionTitle}</strong>
        <p>
          {copy.instructionPrefix}
          <a
            href={generalTicketUrl}
            rel="noreferrer"
            target="_blank"
          >
            {copy.generalTicketLink}
          </a>
          {copy.instructionSuffix}
        </p>
      </div>

      <fieldset
        className="qualified-result__fields"
        disabled={state === 'loading' || isSubmitting || isSubmitted}
      >
        <label className="qualified-result__field-wide">
          {copy.emailLabel}
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.currentTarget.value)}
            pattern={emailInputPattern}
            placeholder="name@example.com"
            required
            title={copy.emailTitle}
            type="email"
            value={email}
          />
        </label>
      </fieldset>

      {!isSubmitted ? (
        <div className="qualified-result__actions">
          <button disabled={state === 'loading' || isSubmitting} type="submit">
            {isSubmitting ? copy.submitting : copy.submit}
          </button>
        </div>
      ) : null}

      <p
        className={`qualified-result__submit-status qualified-result__submit-status--${state}`}
        role="status"
      >
        {isSubmitted
          ? copy.registered(email)
          : state === 'loading'
            ? copy.loading
            : errorCode
              ? readClaimErrorMessage(errorCode, locale)
              : ''}
      </p>
    </form>
  );
}

function readClaimErrorCode(error: unknown): TicketClaimErrorCode {
  if (!(error instanceof VipTicketClaimError)) {
    return 'unknown';
  }

  return error.code === 'email_invalid' ||
    error.code === 'vip_ticket_claim_already_submitted' ||
    error.code === 'wallet_not_eligible'
    ? error.code
    : 'unknown';
}

function readClaimErrorMessage(
  errorCode: TicketClaimErrorCode,
  locale: AppLocale
) {
  return ticketCopy[locale].errors[errorCode];
}

const ticketCopy = {
  ko: {
    description: (minimum: number) =>
      `${minimum} SBT 자격이 확인되었습니다. 일반 입장권 신청에 사용한 이메일을 입력해 주세요.`,
    emailLabel: "일반 입장권 신청에 사용한 이메일",
    emailTitle: "완전한 이메일 주소를 입력해 주세요. 예: name@example.com",
    errors: {
      email_invalid: "완전한 이메일 주소를 입력해 주세요. 예: name@example.com",
      read_failed: "VIP 티켓 신청 상태를 확인할 수 없습니다. 나중에 다시 시도해 주세요.",
      unknown: "VIP 티켓 신청에 실패했습니다. 나중에 다시 시도해 주세요.",
      vip_ticket_claim_already_submitted: "이 지갑은 이미 VIP 티켓 신청을 완료했습니다.",
      wallet_not_eligible: "이 지갑은 현재 VIP 티켓 수령 자격을 충족하지 않습니다."
    },
    eyebrow: "VIP 티켓 신청",
    formLabel: (_claimName: string) => "VIP 티켓 이메일 등록",
    generalTicketLink: "일반 입장권을 신청해 주세요",
    instructionPrefix: "일반 입장권을 아직 신청하지 않았다면 먼저 ",
    instructionSuffix:
      ". 신청 후 이곳으로 돌아와 동일한 이메일로 VIP 티켓을 신청하세요.",
    instructionTitle: "VIP 티켓 신청 전에 일반 입장권을 신청해 주세요",
    loading: "신청 상태를 불러오고 있습니다.",
    registered: (email: string) => `등록 완료: ${email}`,
    submit: "VIP 티켓 수령 확인",
    submittedDescription:
      "VIP 티켓 신청이 제출되어 이메일을 변경할 수 없습니다.",
    submitting: "제출 중",
    title: "VIP 티켓 수령"
  },
  en: {
    description: (minimum: number) =>
      `${minimum} SBT access approved. Enter the email used for your general admission registration.`,
    emailLabel: 'Email used for your general admission registration',
    emailTitle: 'Enter a complete email address, for example name@example.com.',
    errors: {
      email_invalid: 'Enter a complete email address, for example name@example.com.',
      read_failed: 'VIP ticket registration status is unavailable right now. Please try again later.',
      unknown: 'VIP ticket registration failed. Please try again later.',
      vip_ticket_claim_already_submitted: 'This wallet has already completed VIP ticket registration.',
      wallet_not_eligible: 'This wallet is not currently eligible to claim a VIP ticket.'
    },
    eyebrow: 'VIP claim',
    formLabel: (_claimName: string) => 'Email registration for the VIP ticket',
    generalTicketLink: 'apply for general admission',
    instructionPrefix: 'If you have not applied for general admission, first ',
    instructionSuffix:
      '. After submitting the application, return here to apply for the VIP ticket entering the same registration email.',
    instructionTitle: 'Claim general admission before applying for VIP access',
    loading: 'Loading registration status.',
    registered: (email: string) => `Registered: ${email}`,
    submit: 'Confirm VIP ticket claim',
    submittedDescription:
      'Your VIP ticket registration has been submitted and this email is now locked.',
    submitting: 'Submitting',
    title: 'Claim VIP ticket'
  },
  'zh-TW': {
    description: (minimum: number) =>
      `已通過 ${minimum} SBT 資格。請填寫當初登記一般票時使用的信箱。`,
    emailLabel: '當初登記一般票時使用的信箱',
    emailTitle: '請輸入完整的信箱，例如 name@example.com。',
    errors: {
      email_invalid: '請輸入完整的信箱，例如 name@example.com。',
      read_failed: '目前無法讀取 VIP 票券登記狀態，請稍後再試。',
      unknown: 'VIP 票券登記失敗，請稍後再試。',
      vip_ticket_claim_already_submitted: '這個錢包已完成 VIP 票券登記。',
      wallet_not_eligible: '這個錢包目前沒有 VIP 票券領取資格。'
    },
    eyebrow: 'VIP 票券領取',
    formLabel: (_claimName: string) => 'VIP 票券信箱登記',
    generalTicketLink: '申請並領取一般票',
    instructionPrefix: '如果尚未申請一般票，請先',
    instructionSuffix:
      '；領取完成後，再回到這裡申請 VIP 票，並提供當初登記一般票時使用的信箱。',
    instructionTitle: '申請 VIP 票前，請先領取一般票',
    loading: '正在讀取登記狀態。',
    registered: (email: string) => `已登記：${email}`,
    submit: '確認領取 VIP 票',
    submittedDescription: 'VIP 票券登記已送出，這個信箱已鎖定。',
    submitting: '送出中',
    title: '領取 VIP 票'
  }
} as const;
