import type { AppLocale } from '../../i18n/LocaleContext';
import type { ArchiveEventId } from './useHubArchiveRoute';

type EventCopy = {
  title: string; date: string; summary: string; story: string;
  highlights: string[]; prize: string; prizeDescription: string;
};
type ArchivedEvent = { id: ArchiveEventId; category: string; copy: Record<AppLocale, EventCopy> };

export const archiveCopy = {
  'zh-TW': { label: '活動回顧', title: '值得收藏的，不只有卡牌。', intro: '那些一起期待、一起揭曉的時刻。活動落幕，故事與得獎紀錄留在這裡。', view: '查看活動回顧', back: '所有活動', story: '活動故事', highlights: '當時的參與方式', prize: '活動獎項', more: '下一段回憶', year: '2026 活動選集', ended: '活動已結束', preserved: '活動落幕，紀錄留下。', sections: '活動內容', collection: '過去的精彩', events: '場活動', edition: 'THE COLLECTION', footer: '故事與幸運，都值得被記得。' },
  en: { label: 'Past events', title: 'More than cards to collect.', intro: 'The anticipation. The reveal. The moments we shared. The event ends; its stories and winner records stay.', view: 'Explore the event', back: 'All events', story: 'The story', highlights: 'How the community took part', prize: 'Event prizes', more: 'Another memory', year: '2026 EVENT COLLECTION', ended: 'Event ended', preserved: 'The event ends. The record stays.', sections: 'Event content', collection: 'MOMENTS TO REMEMBER', events: 'events', edition: 'THE COLLECTION', footer: 'Stories and lucky moments, remembered.' },
  ko: { label: '지난 이벤트', title: '카드 그 이상의 컬렉션.', intro: '함께 기대하고, 함께 확인했던 순간들. 이벤트가 끝나도 이야기와 당첨 기록은 남습니다.', view: '이벤트 돌아보기', back: '모든 이벤트', story: '이벤트 이야기', highlights: '참여 방식', prize: '이벤트 경품', more: '다른 추억', year: '2026 이벤트 모음', ended: '이벤트 종료', preserved: '이벤트는 끝나도 기록은 남습니다.', sections: '이벤트 내용', collection: '기억할 순간들', events: '이벤트', edition: 'THE COLLECTION', footer: '이야기와 행운의 순간을 기억합니다.' },
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
];
