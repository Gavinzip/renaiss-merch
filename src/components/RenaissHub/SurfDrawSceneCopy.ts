import type { AppLocale } from '../../i18n/LocaleContext';

const copy = {
  en: {
    title: 'The Surf reveal.', subtitle: '27 prizes. A little anticipation.', live: 'On-chain draw',
    box: 'Mystery Box', pro: 'Surf Pro', boxDetail: 'One year of Surf Pro, inside.', proDetail: 'One month. More possibilities.',
    next: 'UP NEXT', latest: 'JUST REVEALED', waiting: 'The next ticket is waiting.', spinning: 'Finding the moment…',
    ticket: 'WINNING TICKET', pending: 'AWAITING THE DRAW', winner: 'Confirmed on BSC',
    winnerLabel: 'THE WINNER', namePending: 'The winner is about to appear.', nameUnavailable: 'Display name not provided',
    simulate: 'Simulate the draw', simulating: 'Simulating…', demoEntry: 'Enter demo mode',
    simulation: 'Demo mode', simulationNote: 'Demo tickets only · no on-chain action', simulationNext: 'Simulate next prize',
    simulationExit: 'Return to live status', simulationComplete: 'Simulation complete', simulationResults: 'Simulated results',
    revealNote: 'Waiting for the confirmed ticket', preparing: 'Preparing the reveal…',
    results: 'The reveals', empty: 'Your anticipation has a place here.', verify: 'Verify the draw',
    rule: 'One ticket, one prize. Different tickets can win again.', prize: 'PRIZE', tickets: 'YOUR TICKETS',
    boxCount: '7 Mystery Boxes', proCount: '20 Pro memberships', phase: ['Preparing', 'Ledger committed', 'Waiting for VRF', 'Ready to reveal', 'Complete'],
  },
  'zh-TW': {
    title: 'Surf，揭曉時刻。', subtitle: '27 份獎品，等一個幸運的瞬間。', live: '鏈上開獎',
    box: 'Mystery Box', pro: 'Surf Pro', boxDetail: '盒內，還有一年 Surf Pro。', proDetail: '一個月，更多可能。',
    next: '下一份獎品', latest: '剛剛揭曉', waiting: '下一張幸運票，等你揭曉。', spinning: '幸運，正在靠近…',
    ticket: '中獎票號', pending: '等待正式開獎', winner: 'BSC 鏈上已確認',
    winnerLabel: '幸運得主', namePending: '幸運得主，即將揭曉。', nameUnavailable: '未提供顯示名稱',
    simulate: '模擬抽獎', simulating: '模擬抽獎中…', demoEntry: '進入 Demo 模式',
    simulation: 'Demo 模式', simulationNote: '僅使用示範票券，不會執行鏈上交易', simulationNext: '模擬下一份獎品',
    simulationExit: '回到正式狀態', simulationComplete: '模擬完成', simulationResults: '模擬中獎結果',
    revealNote: '等待已確認的中獎票號', preparing: '正在準備開獎動畫…',
    results: '已揭曉的幸運', empty: '每一份期待，都有它的位置。', verify: '查看開獎證明',
    rule: '一張票中一個獎，不同票可以再次中獎。', prize: '獎位', tickets: '我的票號',
    boxCount: '7 個 Mystery Box', proCount: '20 個月會員', phase: ['準備開獎', '名單已上鏈', '等待 VRF', '準備揭曉', '全部揭曉'],
  },
  ko: {
    title: 'Surf, 공개의 순간.', subtitle: '27개의 경품, 행운을 기다리는 순간.', live: '온체인 추첨',
    box: 'Mystery Box', pro: 'Surf Pro', boxDetail: 'Surf Pro 1년 이용권이 담겨 있습니다.', proDetail: '한 달, 더 많은 가능성.',
    next: '다음 경품', latest: '최근 공개', waiting: '다음 행운의 응모권을 기다립니다.', spinning: '행운이 다가오고 있어요…',
    ticket: '당첨 응모권', pending: '정식 추첨 대기', winner: 'BSC에서 확인됨',
    winnerLabel: '당첨자', namePending: '당첨자가 곧 공개됩니다.', nameUnavailable: '표시 이름이 제공되지 않았습니다',
    simulate: '모의 추첨', simulating: '모의 추첨 중…', demoEntry: '데모 모드 시작',
    simulation: '데모 모드', simulationNote: '예시 응모권만 사용 · 온체인 작업 없음', simulationNext: '다음 경품 모의 추첨',
    simulationExit: '실제 상태로 돌아가기', simulationComplete: '모의 추첨 완료', simulationResults: '모의 추첨 결과',
    revealNote: '확인된 당첨 응모권을 기다립니다', preparing: '공개 애니메이션 준비 중…',
    results: '공개된 행운', empty: '모든 기대에는 자리가 있습니다.', verify: '추첨 검증',
    rule: '응모권 한 장당 경품 하나. 다른 응모권으로 다시 당첨될 수 있습니다.', prize: '경품', tickets: '내 응모권',
    boxCount: 'Mystery Box 7개', proCount: 'Pro 이용권 20개', phase: ['준비 중', '명단 등록됨', 'VRF 대기', '공개 준비됨', '모두 공개됨'],
  },
} as const;

export function surfDrawSceneCopy(locale: AppLocale) { return copy[locale]; }
