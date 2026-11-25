import type { AppLocale } from '../../i18n/LocaleContext';
import type { ArchiveEventId } from './useHubArchiveRoute';
import { surfCampaign } from '../../../shared/surf-campaign.js';
import { worlds2026PrizeCount } from '../../event-archives/worlds2026';
import { bbwArchive } from '../../event-archives/bbw/archiveData';

export type EventCopy = {
  title: string; date: string; summary: string; story: string;
  highlights: string[]; prize: string; prizeDescription: string;
};
export type ArchivedEvent = { id: ArchiveEventId; category: string; copy: Record<AppLocale, EventCopy> };

export const archiveCopy = {
  'zh-TW': { label: '活動回顧', title: 'Renaiss 活動回顧', intro: '查看過去的社群活動、參與方式與獎項，以及已公開的得獎紀錄。', view: '查看活動回顧', back: '所有活動', story: '活動故事', highlights: '當時的參與方式', prize: '活動獎項', more: '下一段回憶', year: '2026 活動選集', ended: '活動已結束', preserved: '活動落幕，紀錄留下。', sections: '活動內容', collection: '過去的精彩', events: '場活動', edition: 'THE COLLECTION', footer: '故事與幸運，都值得被記得。' },
  en: { label: 'Past events', title: 'Renaiss Event Recaps', intro: 'Browse past community events, how to participate, prizes and published winner records.', view: 'Explore the event', back: 'All events', story: 'The story', highlights: 'How the community took part', prize: 'Event prizes', more: 'Another memory', year: '2026 EVENT COLLECTION', ended: 'Event ended', preserved: 'The event ends. The record stays.', sections: 'Event content', collection: 'MOMENTS TO REMEMBER', events: 'events', edition: 'THE COLLECTION', footer: 'Stories and lucky moments, remembered.' },
  ko: { label: '지난 이벤트', title: 'Renaiss 이벤트 돌아보기', intro: '지난 커뮤니티 이벤트의 참여 방식, 경품과 공개된 당첨 기록을 확인하세요.', view: '이벤트 돌아보기', back: '모든 이벤트', story: '이벤트 이야기', highlights: '참여 방식', prize: '이벤트 경품', more: '다른 추억', year: '2026 이벤트 모음', ended: '이벤트 종료', preserved: '이벤트는 끝나도 기록은 남습니다.', sections: '이벤트 내용', collection: '기억할 순간들', events: '이벤트', edition: 'THE COLLECTION', footer: '이야기와 행운의 순간을 기억합니다.' },
};

export const archivedEvents: ArchivedEvent[] = [
  {
    id: 'football', category: 'FOOTBALL / WORLD CUP',
    copy: {
      'zh-TW': {
        title: '2026 世界盃足球活動', date: '2026 · 世界盃',
        summary: '為看好的隊伍投下一票，和社群一起追逐晉級與冠軍。',
        story: 'Renaiss 將世界盃賽程、隊伍預測與社群抽獎結合。玩家把票券分配給支持的隊伍，在每一輪淘汰賽中，一起等待晉級結果揭曉。',
        highlights: ['選擇看好的晉級隊伍', '分配票券，參與賽事預測', '符合晉級條件的選票進入對應賽事抽獎'],
        prize: '各輪賽事獎池',
        prizeDescription: '活動依輪次與賽事設置獎池；比賽結果確認後，符合條件的票券參與對應抽獎。',
      },
      en: {
        title: '2026 World Cup Football', date: '2026 · WORLD CUP',
        summary: 'Back your team and follow every step toward the final with the community.',
        story: 'Renaiss brought match schedules, team predictions and community draws together. Participants allocated tickets to the teams they supported and followed each knockout round.',
        highlights: ['Choose the teams you expect to advance', 'Allocate tickets to match predictions', 'Qualifying predictions enter the corresponding match draw'],
        prize: 'Round and match prize pools',
        prizeDescription: 'Prize pools were organized by round and match. Eligible tickets entered the corresponding draws after results were confirmed.',
      },
      ko: {
        title: '2026 월드컵 축구 이벤트', date: '2026 · WORLD CUP',
        summary: '응원하는 팀을 선택하고 커뮤니티와 함께 결승까지의 여정을 즐겼습니다.',
        story: 'Renaiss는 월드컵 일정, 승리팀 예측과 커뮤니티 추첨을 연결했습니다. 참가자는 응원하는 팀에 티켓을 배분하며 토너먼트 결과를 기다렸습니다.',
        highlights: ['진출할 팀 선택', '경기 예측에 티켓 배분', '진출 조건을 충족한 티켓으로 해당 경기 추첨 참여'],
        prize: '라운드별 경기 상금 풀',
        prizeDescription: '경기와 라운드별로 상금 풀이 마련되었으며, 결과 확인 후 조건을 충족한 티켓이 해당 추첨에 참여했습니다.',
      },
    },
  },
  {
    id: 'pokemon-30', category: 'POKÉMON / 30TH CELEBRATION',
    copy: {
      'zh-TW': {
        title: 'Pokémon 三十週年', date: '2026.09.16 — 09.23',
        summary: '讓每一次 Tier C 的抽中時刻，成為周年收藏的另一個機會。',
        story: '為慶祝 Pokémon 三十週年，Renaiss 推出周年禮盒抽獎。活動期間，在指定卡機抽中 Tier C，即可依卡機規則累積抽獎券。',
        highlights: ['參與指定卡機的活動', '抽中 Tier C，累積對應抽獎券', '參與 Pokémon 30th Celebration Box 抽獎'],
        prize: '十份周年禮盒，還有更多驚喜。',
        prizeDescription: '十份 Pokémon 30th Celebration Box、噴火龍典藏公仔禮盒，以及二十二筆加碼得獎紀錄，已收錄於公開公告。',
      },
      en: {
        title: 'Pokémon 30th Anniversary', date: 'SEP 16 — SEP 23, 2026',
        summary: 'Every Tier C pull became another chance to celebrate a collecting milestone.',
        story: 'Renaiss celebrated Pokémon’s 30th anniversary with a gift-box raffle. During the event, Tier C wins from designated machines earned raffle tickets according to each machine’s rules.',
        highlights: ['Take part through designated machines', 'Earn raffle tickets with Tier C wins', 'Enter the Pokémon 30th Celebration Box raffle'],
        prize: 'Ten anniversary boxes. More surprises.',
        prizeDescription: 'The public announcement records ten Pokémon 30th Celebration Boxes, a Charizard Collector Gift Box and twenty-two bonus winners.',
      },
      ko: {
        title: '포켓몬 30주년', date: '2026.09.16 — 09.23',
        summary: 'Tier C 당첨의 순간이 특별한 주년 컬렉션의 기회가 되었습니다.',
        story: 'Renaiss는 포켓몬 30주년을 기념해 기프트 박스 추첨을 진행했습니다. 이벤트 기간 동안 지정 머신에서 Tier C에 당첨되면 각 머신 규칙에 따라 추첨권이 쌓였습니다.',
        highlights: ['지정 머신으로 참여', 'Tier C 당첨으로 추첨권 적립', '포켓몬 30th Celebration Box 추첨 참여'],
        prize: '주년 박스 열 개와 더 많은 선물.',
        prizeDescription: '공개 공지에는 Pokémon 30th Celebration Box 10개, 리자몽 컬렉터 기프트 박스, 추가 당첨 기록 22건이 포함되어 있습니다.',
      },
    },
  },
  {
    id: 'surf', category: 'RENAISS × SURF',
    copy: {
      'zh-TW': {
        title: 'Renaiss × Surf 聯名活動', date: '2026.10.08 — 10.15',
        summary: `這次和 Surf 合作，準備了 ${surfCampaign.plannedRewards.mysteryBoxes} 份 Mystery Box 大獎，還有 ${surfCampaign.plannedRewards.proMonthTrials} 份 Pro 一個月會員體驗。`,
        story: '這場活動在 10 月舉辦。只要 Renaiss 和 Surf 綁的是同一個信箱，就能驗證帳號、拿到第一張抽獎票。已經有帳號的人也能參加，不必重新註冊。想多拿票，還可以追蹤 Surf 官方 X、加入 Discord；兩項各通過一次驗證，就各多一張，最多三張。',
        highlights: ['使用相同信箱註冊 Renaiss 與 Surf，通過帳號驗證', '追蹤 Surf 官方 X，完成追蹤驗證', '加入 Surf Discord，完成會員驗證'],
        prize: `${surfCampaign.plannedRewards.mysteryBoxes} 份大獎、${surfCampaign.plannedRewards.proMonthTrials} 份體驗獎`,
        prizeDescription: '7 份 Mystery Box 是這次的大獎，另外 20 份是 Surf Pro 一個月會員體驗。這 27 份都屬於活動抽獎獎項，跟商店另外開放兌換的名額分開計算。',
      },
      en: {
        title: 'Renaiss × Surf Campaign', date: 'OCT 8 — OCT 15, 2026',
        summary: `${surfCampaign.plannedRewards.mysteryBoxes} Mystery Boxes and ${surfCampaign.plannedRewards.proMonthTrials} one-month Pro trials, with raffle tickets earned through three campaign tasks.`,
        story: 'Renaiss and Surf ran a community campaign in October. Participants registered with Surf, followed its official X account and joined its Discord. Verifying Renaiss and Surf accounts linked to the same email earned the first raffle ticket. The X and Discord tasks each added one ticket, up to three per person.',
        highlights: ['Verify Renaiss and Surf accounts using the same email', 'Follow Surf on X and verify the follow', 'Join Surf Discord and verify membership'],
        prize: `${surfCampaign.plannedRewards.mysteryBoxes} main prizes and ${surfCampaign.plannedRewards.proMonthTrials} trial prizes`,
        prizeDescription: 'The main prizes were Surf Mystery Boxes. Trial prizes were one month of Surf Pro membership. Store redemption allocations are separate from this campaign raffle.',
      },
      ko: {
        title: 'Renaiss × Surf 협업 이벤트', date: '2026.10.08 — 10.15',
        summary: `세 가지 미션으로 추첨에 참여하는 이벤트로, Mystery Box ${surfCampaign.plannedRewards.mysteryBoxes}개와 Pro 1개월 체험권 ${surfCampaign.plannedRewards.proMonthTrials}개가 준비되었습니다.`,
        story: 'Renaiss와 Surf는 10월에 커뮤니티 협업 이벤트를 진행했습니다. 같은 이메일로 연결한 Renaiss와 Surf 계정을 인증하면 첫 추첨권을 받았습니다. Surf 공식 X 팔로우와 Discord 가입을 인증하면 각각 추첨권 한 장이 추가되어, 한 사람당 최대 세 장을 받을 수 있었습니다.',
        highlights: ['같은 이메일로 Renaiss와 Surf 계정 인증', 'Surf 공식 X 팔로우 및 인증', 'Surf Discord 가입 및 회원 인증'],
        prize: `주요 경품 ${surfCampaign.plannedRewards.mysteryBoxes}개와 체험권 ${surfCampaign.plannedRewards.proMonthTrials}개`,
        prizeDescription: '주요 경품은 Surf Mystery Box이며, 체험권은 Surf Pro 1개월 멤버십입니다. 스토어 교환 수량은 이벤트 추첨과 별도로 운영됩니다.',
      },
    },
  },
  {
    id: 'worlds-2026', category: 'LEAGUE OF LEGENDS / WORLDS 2026',
    copy: {
      'zh-TW': {
        title: 'Renaiss Worlds 2026', date: '2026.11.02 — 11.15',
        summary: `從八強到總決賽，7 場比賽各抽出 1 位正取，獎品合計 ${worlds2026PrizeCount} 盒 Riftbound 卡牌。`,
        story: '活動從淘汰賽開始，參與者將票券投給支持的隊伍，符合條件的票券參與各場抽獎。八強、四強與總決賽分別準備了不同版本的 Riftbound 卡牌補充盒。',
        highlights: ['八強 4 場，每場 1 盒繁中《起源》', '四強 2 場，每場 1 盒簡中《破限》Jumbo', '總決賽 1 場，送出英文《起源》24 包裝補充盒'],
        prize: '7 場比賽，7 盒獎品',
        prizeDescription: '八強 4 盒、四強 2 盒、總決賽 1 盒。這次公開結果共 7 席正取，沒有抽出備取。',
      },
      en: {
        title: 'Renaiss Worlds 2026', date: 'NOV 2 — NOV 15, 2026',
        summary: `${worlds2026PrizeCount} Riftbound boxes across seven knockout matches, with one main winner per match.`,
        story: 'Participants allocated tickets to the teams they supported in the knockout stage. Eligible tickets entered each match draw, with a different Riftbound edition offered in the quarterfinals, semifinals and final.',
        highlights: ['Quarterfinals: four Traditional Chinese Origins boxes', 'Semifinals: two Simplified Chinese Unleashed Jumbo boxes', 'Final: one English Origins 24-pack display'],
        prize: '7 matches, 7 prize boxes',
        prizeDescription: 'Four quarterfinal boxes, two semifinal boxes and one final box. The published results contain seven main winners and no alternates.',
      },
      ko: {
        title: 'Renaiss Worlds 2026', date: '2026.11.02 — 11.15',
        summary: `토너먼트 7경기에서 경기당 한 명씩 추첨해 Riftbound 박스 총 ${worlds2026PrizeCount}개를 제공했습니다.`,
        story: '참가자는 토너먼트에서 응원하는 팀에 티켓을 배분했습니다. 조건을 충족한 티켓이 각 경기 추첨에 참여했으며, 8강·4강·결승마다 다른 Riftbound 제품이 준비되었습니다.',
        highlights: ['8강: 번체 중국어 Origins 박스 4개', '4강: 간체 중국어 Unleashed Jumbo 박스 2개', '결승: 영어 Origins 24팩 디스플레이 1개'],
        prize: '7경기, 경품 박스 7개',
        prizeDescription: '8강 4개, 4강 2개, 결승 1개입니다. 공개된 결과는 당첨 7건이며 예비 당첨자는 없습니다.',
      },
    },
  },
  {
    id:'bbw', category:'RENAISS × FOUR.MEME / BBW BANGKOK',
    copy:{
      'zh-TW':{title:'Renaiss × Four.meme · BBW Bangkok',date:'2026.11 · BBW Bangkok',summary:`${bbwArchive.uniqueWinnerCount} 位社群得獎者，赴曼谷可領機票與住宿補助，不赴曼谷可領 300 USDT。`,story:'社群透過創作投稿參與活動，合資格帳戶依實付抽卡消費級距與 SBT 加成取得票數。此處保留公開得獎名單與原活動旅遊獎勵卡。',highlights:['社群創作投稿','消費基本票數 × SBT 級距加成','公開得獎名單'],prize:'曼谷旅遊獎勵',prizeDescription:'赴曼谷的得獎者可領最高 1,000 USDT 機票與住宿補助；不赴曼谷可領 300 USDT，兩者擇一。'},
      en:{title:'Renaiss × Four.meme · BBW Bangkok',date:'NOV 2026 · BBW Bangkok',summary:`${bbwArchive.uniqueWinnerCount} community winners, with flight and hotel support for attending Bangkok or 300 USDT for those not travelling.`,story:'Community creators earned weighted tickets through eligible paid pack spending tiers and SBT multipliers. The archive retains the published winners and original travel award cards.',highlights:['Community creations','Spending-tier base tickets × SBT multiplier','Published winners'],prize:'Bangkok travel awards',prizeDescription:'Up to 1,000 USDT for flight and hotel support when attending Bangkok, or 300 USDT for winners not travelling. Choose one reward.'},
      ko:{title:'Renaiss × Four.meme · BBW Bangkok',date:'2026.11 · BBW Bangkok',summary:`커뮤니티 당첨자 ${bbwArchive.uniqueWinnerCount}명에게 방콕 항공권과 숙박 지원 또는 미방문 시 300 USDT를 제공합니다.`,story:'커뮤니티 창작 참가자는 유료 팩 소비 구간과 SBT 배수에 따라 가중 티켓을 받았습니다. 공개 당첨자 명단과 기존 여행 리워드 카드를 보존합니다.',highlights:['커뮤니티 창작','소비 구간 기본 티켓 × SBT 배수','공개 당첨자 명단'],prize:'방콕 여행 리워드',prizeDescription:'방콕 방문 시 항공권과 숙박 최대 1,000 USDT 지원 또는 미방문 당첨자 300 USDT 중 하나를 선택합니다.'},
    },
  },
];
