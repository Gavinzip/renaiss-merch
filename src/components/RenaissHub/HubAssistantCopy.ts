export const hubAssistantCopy = {
  "zh-TW": {
    title: "問問 Renaiss。", intro: "從一個問題，開始探索。", description: "活動、SBT、產品與社群消息，都可以問。",
    beta: "Beta · 忙碌時回覆較慢。", placeholder: "輸入問題…", send: "送出問題", cancel: "停止", clear: "新對話",
    waiting: "正在查閱資料…", slow: "還在整理答案，請稍候。", sources: "參考來源", you: "你", answer: "Renaiss",
    unavailable: "暫時無法取得回答，請稍後再試。", busy: "目前使用人數較多，請稍後再試。", timeout: "等候時間較長，請稍後重新送出。",
    context: "回答附上公開資料來源，方便你接著閱讀。",
    copyAnswer: "複製回答", copied: "已複製", copyError: "無法存取剪貼簿，請直接選取文字複製。", newReply: "查看新回答",
    expand: "展開閱讀視窗", restore: "還原視窗", clearQuestion: "清除問題", characterCount: "已輸入字數", cancelled: "已停止。", cancelledDescription: "重試，或問下一題。", errorTitle: "暫時無法回答。", followUpLabel: "接著聊聊", followUpQuestions: ["有哪些社群活動可以參與？", "介紹一下 Renaiss Fair。"],
    launch: "問問 Renaiss", close: "關閉對話", retry: "重試", sourceCount: "個來源", sourceHint: "Community Hub 公開資訊", welcomeTitle: "問問 Renaiss。", welcomeDescription: "活動、SBT、產品近況。", suggestionLabels: ["社群消息", "SBT", "產品近況"],
    suggestions: ["最近有什麼消息？", "Renaiss 的 SBT 是什麼？", "產品有哪些新進展？"],
  },
  ko: {
    title: "Renaiss에게 물어보세요.", intro: "궁금한 것부터 물어보세요.", description: "활동, SBT, 제품과 커뮤니티 소식을 알아보세요.",
    beta: "베타 · 이용자가 많으면 답변이 늦어질 수 있습니다.", placeholder: "질문을 입력하세요…", send: "질문 보내기", cancel: "중지", clear: "새 대화",
    waiting: "자료를 확인하고 있습니다…", slow: "답변을 준비하고 있습니다. 잠시 기다려 주세요.", sources: "출처", you: "나", answer: "Renaiss",
    unavailable: "현재 답변을 제공할 수 없습니다. 나중에 다시 시도해 주세요.", busy: "서비스가 혼잡합니다. 나중에 다시 시도해 주세요.", timeout: "예상보다 시간이 오래 걸립니다. 나중에 다시 시도해 주세요.",
    context: "자세히 볼 수 있도록 출처 링크를 제공합니다.",
    copyAnswer: "답변 복사", copied: "복사 완료", copyError: "클립보드를 사용할 수 없습니다. 텍스트를 선택해 복사해 주세요.", newReply: "새 답변 보기",
    expand: "읽기 창 확대", restore: "창 복원", clearQuestion: "질문 지우기", characterCount: "입력한 글자 수", cancelled: "대기를 중지했습니다.", cancelledDescription: "다시 시도하거나 새로운 질문을 입력하세요.", errorTitle: "답변을 제공할 수 없습니다.", followUpLabel: "계속 둘러보기", followUpQuestions: ["참여할 수 있는 커뮤니티 활동은 무엇인가요?", "Renaiss Fair에 대해 알려 주세요."],
    launch: "Renaiss에게 질문하기", close: "대화 닫기", retry: "다시 시도", sourceCount: "개 출처", sourceHint: "Community Hub 자료", welcomeTitle: "Renaiss에게 물어보세요.", welcomeDescription: "활동, SBT와 제품 소식.", suggestionLabels: ["커뮤니티", "SBT", "제품"],
    suggestions: ["커뮤니티에 어떤 새 소식이 있나요?", "Renaiss SBT란 무엇인가요?", "제품의 새 소식을 알려 주세요."],
  },
  en: {
    title: "Ask Renaiss.", intro: "A question is a good place to start.", description: "Explore events, SBTs, products and community news.",
    beta: "Beta · Replies may be slower when busy.", placeholder: "Ask a question…", send: "Send question", cancel: "Stop", clear: "New chat",
    waiting: "Looking through the sources…", slow: "Still preparing your answer. Please wait.", sources: "Sources", you: "You", answer: "Renaiss",
    unavailable: "An answer is unavailable right now. Please try again later.", busy: "The service is busy. Please try again later.", timeout: "This is taking longer than expected. Please try again later.",
    context: "Source links are included so you can read further.",
    copyAnswer: "Copy answer", copied: "Copied", copyError: "Clipboard access is unavailable. Select the text to copy it.", newReply: "View new answer",
    expand: "Expand reading window", restore: "Restore window", clearQuestion: "Clear question", characterCount: "Characters entered", cancelled: "Waiting stopped.", cancelledDescription: "Retry, or ask something new.", errorTitle: "Answer unavailable.", followUpLabel: "Keep exploring", followUpQuestions: ["Which community events can I join?", "Tell me about Renaiss Fair."],
    launch: "Ask Renaiss", close: "Close conversation", retry: "Retry", sourceCount: "sources", sourceHint: "Community Hub sources", welcomeTitle: "Ask Renaiss.", welcomeDescription: "Events, SBTs and product updates.", suggestionLabels: ["Community", "SBTs", "Products"],
    suggestions: ["What's new in the community?", "What are Renaiss SBTs?", "Any product updates?"],
  },
} as const;

export type HubAssistantCopy = (typeof hubAssistantCopy)[keyof typeof hubAssistantCopy];
