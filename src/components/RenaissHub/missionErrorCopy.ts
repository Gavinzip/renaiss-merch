import type { AppLocale } from '../../i18n/LocaleContext';

export function isXIdentityError(code?: string | null) {
  return ['renaiss_x_mismatch', 'renaiss_x_not_linked', 'identity_mismatch', 'x_verified_account_locked'].includes(code || '');
}

export function missionErrorCopy(code: string, locale: AppLocale) {
  const messages: Record<string, Record<AppLocale, string>> = {
    renaiss_x_not_linked: { 'zh-TW': "請先在 Renaiss 綁定 X，再重新登入。", en: "Link X in Renaiss, then sign in again.", ko: "Renaiss에서 X를 연결한 후 다시 로그인해 주세요." },
    renaiss_x_mismatch: { 'zh-TW': "無法驗證：此 X 帳號與 Renaiss 綁定的帳號不同。請使用與 Renaiss 綁定相同的 X 帳號。", en: "Cannot verify: this X account differs from the one linked to Renaiss. Use the same linked X account.", ko: "인증할 수 없습니다. Renaiss에 연결된 X 계정과 다른 계정입니다. 연결된 동일한 X 계정을 사용해 주세요." },
    identity_mismatch: { 'zh-TW': "無法驗證：授權帳號與已連接的帳號不同。請重新授權 Renaiss 綁定的 X 帳號。", en: "Cannot verify: the authorized identity differs from the connected account. Reauthorize the X account linked to Renaiss.", ko: "인증할 수 없습니다. 인증에 사용한 계정이 연결된 계정과 다릅니다. Renaiss에 연결된 X 계정으로 다시 인증해 주세요." },
    x_verified_account_locked: { 'zh-TW': "此 X 帳號已通過驗證，無法更換。請重新授權原本驗證通過的 X 帳號。", en: "Your verified X account is locked. Reauthorize the original verified X account.", ko: "인증된 X 계정은 변경할 수 없습니다. 처음 인증한 X 계정으로 다시 연결해 주세요." },
    discord_verified_account_locked: { 'zh-TW': "此 Discord 帳號已通過驗證，無法更換。", en: "This verified Discord account cannot be changed.", ko: "인증된 Discord 계정은 변경할 수 없습니다." },
    social_account_already_connected: { 'zh-TW': "此帳號已連接另一位參加者。", en: "This account is linked to another participant.", ko: "이 계정은 다른 참가자에게 연결되어 있습니다." },
    social_authorization_cancelled: { 'zh-TW': "授權已取消，可再次連接。", en: "Authorization cancelled. You can reconnect.", ko: "인증이 취소되었습니다. 다시 연결할 수 있습니다." },
    invalid_social_oauth_state: { 'zh-TW': "授權已失效，請重新連接。", en: "Authorization expired. Please reconnect.", ko: "인증이 만료되었습니다. 다시 연결해 주세요." },
    mission_check_busy: { 'zh-TW': "請稍候再試，避免重複查核。", en: "Please wait a moment before checking again.", ko: "중복 확인을 방지하기 위해 잠시 후 다시 시도해 주세요." },
    provider_rate_limited: { 'zh-TW': "平台暫時限流，請稍後重試。", en: "The platform is rate limiting requests. Try again later.", ko: "플랫폼에서 요청을 제한하고 있습니다. 나중에 다시 시도해 주세요." },
    provider_access_denied: { 'zh-TW': "平台未允許查核，請稍後重試。", en: "The platform did not permit this check. Try again later.", ko: "플랫폼에서 확인을 허용하지 않았습니다. 나중에 다시 시도해 주세요." },
    following_check_incomplete: { 'zh-TW': "追蹤清單尚未查完，請稍後重新驗證。", en: "The following list check did not finish. Please try again.", ko: "팔로우 목록 확인을 완료하지 못했습니다. 다시 시도해 주세요." },
    x_relation_unavailable: { 'zh-TW': "X 未提供追蹤關係，這次無法驗證。請稍後再試。", en: "X did not provide the follow relationship, so this check could not be completed. Try again later.", ko: "X에서 팔로우 정보를 제공하지 않아 인증을 완료하지 못했습니다. 나중에 다시 시도해 주세요." },
    invalid_x_target_response: { 'zh-TW': "X 回傳的 Surf 帳號資料不正確，這次無法驗證。", en: "X returned unexpected Surf account data, so this check could not be completed.", ko: "X에서 잘못된 Surf 계정 정보를 반환해 인증을 완료하지 못했습니다." },
    not_following: { 'zh-TW': "尚未追蹤 Surf，追蹤後按驗證。", en: "Follow Surf, then verify again.", ko: "Surf를 팔로우한 후 다시 인증해 주세요." },
    not_a_member: { 'zh-TW': "尚未加入 Surf，加入後按驗證。", en: "Join Surf, then verify again.", ko: "Surf 커뮤니티에 가입한 후 다시 인증해 주세요." },
    membership_screening_pending: { 'zh-TW': "請先完成 Surf 伺服器的規則確認。", en: "Complete Surf’s server membership screening.", ko: "Surf 서버의 가입 규칙 확인을 완료해 주세요." },
    authorization_expired: { 'zh-TW': "授權已失效，請重新連接。", en: "Authorization expired. Please reconnect.", ko: "인증이 만료되었습니다. 다시 연결해 주세요." },
    permission_required: { 'zh-TW': "需要重新授權查核權限。", en: "Reconnect to grant verification access.", ko: "인증 권한을 허용하려면 다시 연결해 주세요." },
    connection_required: { 'zh-TW': "請先連接帳號。", en: "Connect your account first.", ko: "먼저 계정을 연결해 주세요." },
    unauthenticated: { 'zh-TW': "請重新登入 Renaiss。", en: "Please sign in to Renaiss again.", ko: "Renaiss에 다시 로그인해 주세요." },
    demo_missions_disabled: { 'zh-TW': "Demo 無法驗證活動任務。", en: "Demo cannot verify campaign tasks.", ko: "데모 계정은 활동 미션을 인증할 수 없습니다." },
    mission_state_unavailable: { 'zh-TW': "任務狀態讀取失敗，請重試。", en: "Could not load task status. Try again.", ko: "미션 상태를 불러올 수 없습니다. 다시 시도해 주세요." },
    renaiss_email_missing: { 'zh-TW': "Renaiss 未提供登入信箱，請先綁定信箱後重新登入。", en: "Add an email to Renaiss, then sign in again.", ko: "Renaiss에서 이메일을 연결한 후 다시 로그인해 주세요." },
    renaiss_email_invalid: { 'zh-TW': "Renaiss 回傳的信箱格式不正確，請到帳號設定確認，再重新登入。", en: "Renaiss returned an invalid email. Check account settings, then sign in again.", ko: "Renaiss에서 올바르지 않은 이메일을 전달했습니다. 계정 설정을 확인한 후 다시 로그인해 주세요." },
    renaiss_email_changed: { 'zh-TW': "登入信箱已變更，請重新登入後驗證。", en: "Your sign-in email changed. Sign in again before verifying.", ko: "로그인 이메일이 변경되었습니다. 다시 로그인한 후 인증해 주세요." },
    surf_email_invalid: { 'zh-TW': "Renaiss 回傳的信箱格式不正確，請到帳號設定確認。", en: "Check the email in Renaiss account settings.", ko: "Renaiss 계정 설정에서 이메일을 확인해 주세요." },
    surf_not_registered: { 'zh-TW': "Surf 未找到此信箱的有效帳號。請以相同信箱登入或註冊 Surf 後重新驗證。", en: "Surf found no active account for this email. Sign in or register with the same email, then recheck.", ko: "Surf에서 이 이메일의 활성 계정을 찾지 못했습니다. 같은 이메일로 Surf에 로그인하거나 가입한 후 다시 인증해 주세요." },
    surf_account_already_connected: { 'zh-TW': "此 Surf 信箱已用於另一個 Renaiss 參加帳號。", en: "This Surf email is already linked to another Renaiss participant.", ko: "이 Surf 이메일은 다른 Renaiss 참가자에게 연결되어 있습니다." },
    surf_not_configured: { 'zh-TW': "Surf 查核尚未設定完成，請稍後再試。", en: "Surf verification is not configured yet. Please try later.", ko: "Surf 인증 설정이 아직 완료되지 않았습니다. 나중에 다시 시도해 주세요." },
    surf_key_configuration_conflict: { 'zh-TW': "Surf 查核設定有誤，需要管理者處理。", en: "Surf verification needs an administrator to fix its configuration.", ko: "Surf 인증 설정에 문제가 있습니다. 관리자의 조치가 필요합니다." },
    surf_key_file_unavailable: { 'zh-TW': "Surf 查核設定有誤，需要管理者處理。", en: "Surf verification needs an administrator to fix its configuration.", ko: "Surf 인증 설정에 문제가 있습니다. 관리자의 조치가 필요합니다." },
    surf_key_invalid: { 'zh-TW': "Surf 查核設定有誤，需要管理者處理。", en: "Surf verification needs an administrator to fix its configuration.", ko: "Surf 인증 설정에 문제가 있습니다. 관리자의 조치가 필요합니다." },
    surf_partner_key_rejected: { 'zh-TW': "Surf 查核憑證已失效，需要管理者更新。", en: "The Surf verification credential was rejected. An administrator must update it.", ko: "Surf 인증 정보가 거부되었습니다. 관리자의 업데이트가 필요합니다." },
    surf_rate_limited: { 'zh-TW': "Surf 暫時限流，請依提示時間重試。", en: "Surf is rate limiting checks. Retry after the indicated time.", ko: "Surf에서 인증 요청을 제한하고 있습니다. 안내된 시간 이후 다시 시도해 주세요." },
    surf_provider_unreachable: { 'zh-TW': "暫時連不上 Surf，請稍後重試。", en: "Could not reach Surf. Please try again later.", ko: "Surf에 연결할 수 없습니다. 나중에 다시 시도해 주세요." },
    surf_email_rejected: { 'zh-TW': "Surf 無法查核此登入信箱，請稍後重試或聯絡支援。", en: "Surf could not check this sign-in email. Try again later or contact support.", ko: "Surf에서 이 이메일을 확인하지 못했습니다. 나중에 다시 시도하거나 지원팀에 문의해 주세요." },
    surf_provider_error: { 'zh-TW': "Surf 服務暫時無法查核，請稍後重試。", en: "Surf verification is temporarily unavailable. Please try again later.", ko: "현재 Surf 인증을 사용할 수 없습니다. 나중에 다시 시도해 주세요." },
    surf_response_invalid: { 'zh-TW': "Surf 回傳的查核資料不完整，請稍後重試。", en: "Surf returned an invalid verification response. Please try again later.", ko: "Surf에서 올바르지 않은 인증 정보를 반환했습니다. 나중에 다시 시도해 주세요." },
    x_not_configured: { 'zh-TW': "X 查核暫時無法使用。", en: "X verification is currently unavailable.", ko: "현재 X 인증을 사용할 수 없습니다." },
    discord_not_configured: { 'zh-TW': "Discord 查核暫時無法使用。", en: "Discord verification is currently unavailable.", ko: "현재 Discord 인증을 사용할 수 없습니다." },
    discord_rule_not_configured: { 'zh-TW': "Discord 查核規則尚未設定。", en: "Discord verification rules are not configured.", ko: "Discord 인증 규칙이 아직 설정되지 않았습니다." },
  };
  const pair = messages[code];
  return pair ? pair[locale] : unavailableCopy[locale];
}

const unavailableCopy = { en: 'Verification is unavailable. Please try again later.', 'zh-TW': '暫時無法完成查核，請稍後重試。', ko: '현재 인증할 수 없습니다. 나중에 다시 시도해 주세요.' } as const;
