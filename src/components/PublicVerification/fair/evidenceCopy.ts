import type { ProofPick, VerificationCheck } from '../../../../shared/public-proof/types';
import type { AppLocale } from '../../../i18n/LocaleContext';

const fields = {
  chain: ['鏈 ID', '체인 ID', '從設定的公開 RPC 獨立讀取的鏈。', '설정된 공개 RPC에서 독립적으로 확인한 체인입니다.'],
  contract: ['合約', '계약', '在已確認的區塊核對核准的合約程式及協議。', '확정된 블록에서 승인된 계약 코드와 규약을 확인합니다.'],
  'request tx': ['抽獎請求交易', '추첨 요청 거래', '本輪已最終確認的抽獎請求交易。', '최종 확정된 이 회차의 추첨 요청 거래입니다.'],
  'block hash': ['區塊雜湊', '블록 해시', '名冊存證之後，抽獎請求所在的已確認區塊。', '명단을 기록한 뒤 추첨을 요청한 확정 블록입니다.'],
  root: ['Merkle 根', 'Merkle 루트', '依 Worlds 的六欄 ABI 編碼重算票券名冊的 Merkle 根。', 'Worlds ABI 필드 6개로 티켓 명단의 Merkle 루트를 다시 계산합니다.'],
  'α': ['輸入 α', '입력 α', '由協議、合約、輪次、名冊、獎項、票數、公鑰及請求區塊重算。', '규약, 계약, 회차, 명단, 경품, 티켓 수, 공개키와 요청 블록으로 재계산합니다.'],
  round: ['輪次識別碼', '회차 식별자', '鏈上的名冊承諾與抽獎請求屬於同一輪。', '온체인 명단 커밋과 추첨 요청이 같은 회차에 속합니다.'],
  PK: ['公鑰 PK', '공개키 PK', '抽獎請求前已在鏈上鎖定的公鑰。', '추첨 요청 전에 온체인에 확정한 공개키입니다.'],
  'π': ['證明 π', '증명 π', '活動公布的 80 位元組 ECVRF 證明。', '이벤트가 공개한 80바이트 ECVRF 증명입니다.'],
  'β': ['輸出 β', '출력 β', '瀏覽器依 RFC 9381 驗證證明後重算的輸出。', '브라우저가 RFC 9381에 따라 증명을 확인해 계산한 출력입니다.'],
  stream: ['隨機值序列', '난수 시퀀스', '以 SHA-512、拒絕取樣及正向 Fisher–Yates 重算抽選。', 'SHA-512, 거부 샘플링과 순방향 Fisher–Yates로 추첨을 재계산합니다.'],
  words: ['讀取的隨機值數', '읽은 난수 개수', '每讀取一個值，計數器都會遞增，包含遭拒絕的值。', '거부된 값을 포함해 값을 읽을 때마다 카운터가 증가합니다.'],
  'result hash': ['結果雜湊', '결과 해시', '重算結果的雜湊，並與活動公布的資料比對。', '재계산 결과의 해시를 이벤트 공개 데이터와 비교합니다.'],
  'bundle hash': ['證明檔雜湊', '증명 파일 해시', '重算完整證明檔的 SHA-256。', '전체 증명 파일의 SHA-256을 다시 계산합니다.'],
  inclusions: ['已核對的票券', '검증한 티켓', '逐一核對每張抽出票券的 Merkle 路徑。', '추첨된 각 티켓의 Merkle 경로를 확인합니다.'],
} as const;

export function localizedEvidence(locale: AppLocale, step: number, chip: VerificationCheck['chips'][number], pick?: ProofPick) {
  if (locale === 'en') return {label: chip.label, note: chip.detail};
  const korean = locale === 'ko';
  if (step === 5 && pick) return {
    label: `${pick.matchId.toUpperCase()} · ${pick.rank === 0 ? (korean ? '당첨' : '正取') : (korean ? '예비' : '候補') + ' ' + pick.rank}`,
    note: korean ? '사전에 확정한 티켓 순서와 경품 규칙으로 재계산했습니다.' : '依抽獎前鎖定的票券順序和獎項規則重算。',
  };
  if (step === 6 && chip.label === 'root') return {
    label: fields.root[korean ? 1 : 0],
    note: korean ? '각 당첨 티켓의 경로가 온체인 루트와 일치합니다.' : '每張中獎票券的路徑都能算回同一個鏈上 Merkle 根。',
  };
  const field = fields[chip.label as keyof typeof fields];
  return field ? {label: field[korean ? 1 : 0], note: field[korean ? 3 : 2]} : {label: chip.label, note: chip.detail};
}
