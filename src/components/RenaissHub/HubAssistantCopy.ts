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
