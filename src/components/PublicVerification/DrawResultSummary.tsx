import { ArrowDown, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { AppLocale } from '../../i18n/LocaleContext';
import type { LoadedProof } from '../../../shared/public-proof/types';
import { fairCopy } from './fairCopy';
import { proofCopy } from './proofCopy';

const summaryCopy = {
  'zh-TW': {
    result: '抽獎結果', match: '場次', ticket: '正取票號', eligible: '張合格票券',
    passed: '六項驗證通過', pending: '正在核對證明', failed: '驗證未完成',
    details: '看六步驗證', rehearsal: '演練紀錄',
    quantity: (units: number) => `${units.toLocaleString('zh-TW')} 份獎品`,
  },
  en: {
    result: 'draw result', match: 'Match', ticket: 'Winning ticket', eligible: 'eligible tickets',
    passed: 'Six checks passed', pending: 'Checking the proof', failed: 'Verification incomplete',
    details: 'See the six checks', rehearsal: 'Rehearsal record',
    quantity: (units: number) => `${units.toLocaleString('en')} ${units === 1 ? 'prize' : 'prizes'}`,
  },
  ko: {
    result: '추첨 결과', match: '경기', ticket: '당첨 티켓', eligible: '장 적격 티켓',
    passed: '6단계 검증 완료', pending: '증명 확인 중', failed: '검증 미완료',
    details: '6단계 검증 보기', rehearsal: '리허설 기록',
    quantity: (units: number) => `${units.toLocaleString('ko')}개 경품`,
  },
} as const;

export function DrawResultSummary({proof, eventName, locale, transaction, completed, error, copied, copyError, onCopy}: {
  proof: LoadedProof; eventName: string; locale: AppLocale; transaction: string; completed: number; error: string | null;
  copied: boolean; copyError: string | null; onCopy: () => void;
}) {
  const {bundle, authority} = proof;
  const copy = summaryCopy[locale], t = fairCopy(locale);
  const proofLabels = proofCopy[locale];
  const title = [proofLabels[bundle.manifest.stage], copy.result].join(locale === 'zh-TW' ? '' : ' ');
  const winners = new Map(bundle.result.picks.filter(pick => pick.positionType === 'winner' && pick.rank === 0)
    .map(pick => [pick.matchId, pick.ticketNumber]));
  const isTestnet = bundle.chain.chainId === 97;
  const isCommitment = transaction.toLowerCase() === bundle.chain.commitmentTx.toLowerCase();
  const explorer = isTestnet ? 'https://testnet.bscscan.com' : 'https://bscscan.com';
  const passed = completed === 6;
  return <section id="draw-result" className="vf-draw-summary" aria-labelledby="vf-title">
    <div className="vf-draw-summary-head">
      <div>
        <div className="vf-kicker">{eventName}{authority.context === 'rehearsal' ? ` · ${copy.rehearsal}` : ''}</div>
        <h1 id="vf-title">{title}</h1>
        <p>{t(isTestnet ? "BSC TESTNET" : "BSC MAINNET")} · {bundle.commitment.ticketCount.toLocaleString(locale)} {copy.eligible}</p>
      </div>
      <div className="vf-draw-summary-status" role="status" data-state={passed ? 'passed' : error ? 'failed' : 'pending'}>
        <ShieldCheck size={17} aria-hidden="true"/>{passed ? copy.passed : error ? copy.failed : copy.pending}
      </div>
    </div>
    <p className="vf-draw-summary-description">{t(isCommitment ? "This transaction committed the roster and prizes before the draw." : "This transaction requested the draw for this round.")}{locale==='zh-TW'?'':' '}{t("Below are the published winning tickets and prizes by match.")}</p>
    <ul className="vf-draw-summary-tickets">
      {bundle.manifest.matches.map(match => <li key={match.matchId}>
        <span>{copy.match} <b>{match.matchId.toUpperCase()}</b></span>
        <span className="vf-draw-summary-prize">{match.prize.name}</span>
        <small>{copy.quantity(match.prize.units)}</small>
        <span>{copy.ticket} <strong>#{winners.get(match.matchId)}</strong></span>
      </li>)}
    </ul>
    <div className="vf-draw-summary-actions">
      <a href="#proof-steps">{copy.details}<ArrowDown size={16} aria-hidden="true"/></a>
      <a className="vf-draw-summary-chain" href={`${explorer}/tx/${transaction}`} target="_blank" rel="noopener noreferrer">{t("View transaction")}<ArrowUpRight size={15} aria-hidden="true"/></a>
      <button type="button" onClick={onCopy}>{copied ? proofLabels.copied : proofLabels.copy}</button>
    </div>
    {copyError && <p className="vf-error" role="alert">{copyError}</p>}
  </section>;
}
