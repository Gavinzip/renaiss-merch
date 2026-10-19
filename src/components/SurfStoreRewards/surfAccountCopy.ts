export const surfAccountCopy = {
  'zh-TW': {
    gmail: 'SURF Gmail 帳號',
    gmailHint: '請確認與你的 SURF 登入帳號一致。',
    gmailInvalid: '請填寫有效的 @gmail.com 帳號。',
    gmailRequired: '請填寫你的 SURF Gmail 帳號。',
    unavailable: '兌換尚未開放',
    remaining: '剩餘名額', inventoryUnavailable: '無法取得', inventoryFailed: '無法取得即時名額，請重新整理。',
    note: '先到先得，每個帳號每項限領一次；送出後即占用名額。',
    submit: '確認送出', submitting: '送出中…', loading: '讀取名額中…', retry: '重新整理',
    submitted: '已完成登記，名額已保留。', submittedButton: '已完成登記', soldOut: '已全數領取',
    errors: { surf_gmail_invalid: '請填寫有效的 @gmail.com 帳號。', surf_sold_out: '名額已全數領取。',
      surf_already_submitted: '此帳號或錢包已領取過此商品，請重新整理查看紀錄。', surf_sbt_required: '目前 SBT 持有數未達此商品門檻。',
      surf_store_not_open: '尚未到開放時間。', unauthenticated: '請先登入 Renaiss。' },
    failed: '無法確認登記結果。請重新整理查看紀錄，或使用同一 Gmail 重試。'
  },
  en: {
    gmail: 'SURF Gmail account',
    gmailHint: 'Use the same account you sign in to SURF with.',
    gmailInvalid: 'Enter a valid @gmail.com address.',
    gmailRequired: 'Enter your SURF Gmail address.',
    unavailable: 'Redemption not open',
    remaining: 'Remaining allocations', inventoryUnavailable: 'Unavailable', inventoryFailed: 'Live availability is unavailable. Please refresh.',
    note: 'First come, first served. One claim per account per reward. Submission reserves your allocation.',
    submit: 'Confirm submission', submitting: 'Submitting…', loading: 'Checking availability…', retry: 'Refresh',
    submitted: 'Your registration is saved and your allocation is reserved.', submittedButton: 'Registered', soldOut: 'Fully claimed',
    errors: { surf_gmail_invalid: 'Enter a valid @gmail.com address.', surf_sold_out: 'All allocations have been claimed.',
      surf_already_submitted: 'This account or wallet has already claimed this reward. Refresh to view your record.', surf_sbt_required: 'Your current SBT holdings do not meet the requirement.',
      surf_store_not_open: 'This reward has not opened yet.', unauthenticated: 'Please sign in to Renaiss.' },
    failed: 'Your registration could not be confirmed. Refresh to check your record, or retry with the same Gmail address.'
  },
  ko: {
    gmail: 'SURF Gmail 계정',
    gmailHint: 'SURF 로그인 계정과 같은 주소인지 확인해 주세요.',
    gmailInvalid: '유효한 @gmail.com 주소를 입력해 주세요.',
    gmailRequired: 'SURF Gmail 주소를 입력해 주세요.',
    unavailable: '교환 준비 중',
    remaining: '남은 수량', inventoryUnavailable: '확인 불가', inventoryFailed: '실시간 수량을 확인할 수 없습니다. 새로고침해 주세요.',
    note: '선착순이며 계정당 각 상품 1회만 신청할 수 있습니다. 제출 시 수량이 확보됩니다.',
    submit: '신청 확인', submitting: '제출 중…', loading: '수량 확인 중…', retry: '새로고침',
    submitted: '신청이 저장되고 수량이 확보되었습니다.', submittedButton: '신청 완료', soldOut: '수량 소진',
    errors: { surf_gmail_invalid: '유효한 @gmail.com 주소를 입력해 주세요.', surf_sold_out: '모든 수량이 소진되었습니다.',
      surf_already_submitted: '이 계정 또는 지갑은 이미 신청했습니다. 새로고침하여 확인해 주세요.', surf_sbt_required: '현재 SBT 보유량이 조건에 미달합니다.',
      surf_store_not_open: '아직 오픈 시간이 아닙니다.', unauthenticated: 'Renaiss에 로그인해 주세요.' },
    failed: '신청 결과를 확인할 수 없습니다. 새로고침하거나 같은 Gmail 주소로 다시 시도해 주세요.'
  }
} as const;
