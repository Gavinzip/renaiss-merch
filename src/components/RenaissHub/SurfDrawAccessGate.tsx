import { useState, type FormEvent } from 'react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { useSurfDrawAccess } from './useSurfDrawAccess';
import './SurfDrawAccessGate.css';

type Access = ReturnType<typeof useSurfDrawAccess>;

const copy = {
  'zh-TW': { eyebrow: 'RENAISS × SURF / PRIVATE DRAW', title: '進入開獎室',
    description: '使用開獎室專用帳號與密碼。',
    username: '帳號', password: '密碼', enter: '進入開獎室', entering: '驗證中…',
    loading: '正在確認開獎室權限…', unavailable: '目前無法驗證開獎室權限。',
    unconfigured: '開獎室帳密尚未在伺服器設定。', retry: '重新確認',
    invalid: '帳號或密碼不正確。', limited: '嘗試次數過多，請稍後再試。' },
  en: { eyebrow: 'RENAISS × SURF / PRIVATE DRAW', title: 'Enter the draw room',
    description: 'Use the draw room credentials.',
    username: 'Username', password: 'Password', enter: 'Enter draw room', entering: 'Checking…',
    loading: 'Checking draw room access…', unavailable: 'Draw room access is unavailable.',
    unconfigured: 'Draw room credentials are not configured on the server.', retry: 'Try again',
    invalid: 'Incorrect username or password.', limited: 'Too many attempts. Please try again later.' },
  ko: { eyebrow: 'RENAISS × SURF / PRIVATE DRAW', title: '추첨실 입장',
    description: '추첨실 전용 계정으로 로그인하세요.',
    username: '아이디', password: '비밀번호', enter: '추첨실 입장', entering: '확인 중…',
    loading: '추첨실 권한 확인 중…', unavailable: '추첨실 권한을 확인할 수 없습니다.',
    unconfigured: '서버에 추첨실 계정이 설정되지 않았습니다.', retry: '다시 확인',
    invalid: '아이디 또는 비밀번호가 올바르지 않습니다.', limited: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.' },
} as const;

export function SurfDrawAccessGate({ locale, access }: { locale: AppLocale; access: Access }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const words = copy[locale];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void access.login(username.trim(), password).then(success => { if (success) setPassword(''); });
  }
  const message = access.state.status === 'unconfigured' ? words.unconfigured :
    access.state.status === 'error' ? words.unavailable : access.state.status === 'loading' ? words.loading : null;
  const failure = access.error === 'surf_draw_invalid_credentials' ? words.invalid :
    access.error === 'surf_draw_login_rate_limited' ? words.limited : access.error ? words.unavailable : null;
  return <section className="surf-draw-access" aria-labelledby="surf-draw-access-title">
    <div className="surf-draw-access__copy">
      <span className="surf-draw-access__eyebrow">{words.eyebrow}</span>
      <h1 id="surf-draw-access-title">{words.title}</h1>
      <p>{words.description}</p>
    </div>
    <div className="surf-draw-access__panel">
      {access.state.status === 'locked' ? <form onSubmit={submit}>
        <label>{words.username}<input autoComplete="username" name="username" required maxLength={64} value={username} onChange={event => setUsername(event.target.value)} /></label>
        <label>{words.password}<input autoComplete="current-password" name="password" type="password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} /></label>
        {failure ? <p className="surf-draw-access__error" role="alert">{failure}</p> : null}
        <button type="submit" disabled={access.busy}>{access.busy ? words.entering : words.enter}<span aria-hidden="true">↗</span></button>
      </form> : <div className="surf-draw-access__status" role={access.state.status === 'loading' ? 'status' : 'alert'}>
        <p>{message}</p>
        {access.state.status !== 'loading' ? <button type="button" onClick={() => void access.refresh()}>{words.retry} ↗</button> : null}
      </div>}
    </div>
  </section>;
}
